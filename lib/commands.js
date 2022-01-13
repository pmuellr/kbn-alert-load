'use strict'

/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').CommandHandler } CommandHandler */
/** @typedef { import('./types').EventLogRecord } EventLogRecord */
/** @typedef { import('./types').TaskManagerStats } TaskManagerStats */

const path = require('path')
const { homedir } = require('os')
const pkg = require('../package.json')
const logger = require('./logger')
const ecCommands = require('./ec-commands')
const { createDeployment, DeploymentPrefix } = require('./deployment')
const parseArgs = require('./parse_args')
const { getSuite, getSuites, validateSuite } = require('./suites')
const { createRule, createConnector, getKbStatus, getKbTaskManagerStatus } = require('./kb')
const { getEventLog, getEsStatus } = require('./es')
const { generateReport } = require('./report')
const { delay, shortDateString, arrayFrom, sortByDate } = require('./utils')
const { runQueue } = require('./work-queue')

module.exports = {
  commands: [
    run,
    help,
    ls,
    lsv,
    lsd,
    lst,
    rmd,
    rmdall,
    env,
  ]
}

const CONCURRENT_RULE_CREATION = 40
const STATS_INTERVAL_MILLIS = 15 * 1000

/** @type { CommandHandler } */
async function run({ config, template, minutes, percentFiring }, [ suiteId ]) {
  if (suiteId == null) {
    return logger.logErrorAndExit('suite id must passed as an parameter')
  }

  const suite = getSuite(suiteId)
  if (suite == null) {
    return logger.logErrorAndExit(`no suite with id "${suiteId}"`)
  }

  try {
    validateSuite(suite)
  } catch (err) {
    return logger.logErrorAndExit(`invalid suite: ${err.message}`)
  }

  if (percentFiring < 0 || percentFiring > 100) {
    return logger.logErrorAndExit(`invalid percentFiring: ${percentFiring}. Value must be between 0 and 100`)
  }

  logger.printTime(true)
  await listOldDeployments(config)

  const date = new Date()
  const runName = shortDateString(date)
  const scenarios = suite.scenarios

  logger.log(`creating deployments for config ${config}`)
  
  /** @type { Promise<Deployment>[] } */
  const deploymentPromises = []
  for (const scenario of scenarios) {
    const scenarioTemplate = scenario.template || template || undefined
    deploymentPromises.push(createDeployment(config, scenarioTemplate, runName, suite, scenario))

    // some kind of race delay creating multiple so close together?
    await delay(1000)
  }

  try {
    await Promise.all(deploymentPromises)
  } catch (err) {
    logger.log(`error creating deployments: ${err}`)
    logger.log(``)
    return logger.logErrorAndExit(`You will need to manually shutdown any deployments that started.`)
  }
  
  /** @type { Deployment[] } */
  const deployments = []
  for (const deploymentPromise of deploymentPromises) {
    deployments.push(await deploymentPromise)
  }

  logger.log('')
  for (const deployment of deployments) {
    logger.log(`deployment ${deployment.id} ${deployment.scenario.name}`)
    logger.log(`  es: ${deployment.esUrl}`)
    logger.log(`  kb: ${deployment.kbUrl}`)
    logger.log('')
  }

  logger.log('starting stats collection')
  /** @type { any[] } */
  const kbStatusList = []
  /** @type { Map<string, Map<string, TaskManagerStats[]>> } */
  const kbTaskManagerStatusList = new Map()
  /** @type { any[] } */
  const esStatusList = []


  /** @type { () => Promise<any> } */
  const cancelPollingForStats = startPollingForStats(() => {
    return Promise.all([
      updateKbStatus(deployments, kbStatusList),
      updateKbTMStatus(deployments, kbTaskManagerStatusList),
      updateEsStatus(deployments, esStatusList)
    ])
  }, logger)
  
  // logger.log(`TBD ... creating input indices`)
  
  logger.log(`creating rules and connectors`)
  const queues = deployments.map(async deployment => {
    const createdConnectorId = await createConnector(deployment.kbUrl, `index connector`, `write-index`)
    const ruleNames = arrayFrom(deployment.scenario.ruleCount, (i) => `${i}`.padStart(5, '0'))
    return await runQueue(ruleNames, CONCURRENT_RULE_CREATION, async (ruleName, i) => {
      try {
        const firing = ((i + 1) / deployment.scenario.ruleCount) <= (percentFiring / 100);
        return await createRule(deployment.kbUrl, ruleName, '.kibana-event-log*', firing, [{
          id: createdConnectorId,
          group: 'threshold met',
          params: {
            documents: [{
              scheduledDate: '{{date}}',
              fromRuleId: '{{ruleId}}',
              fromRuleName: ruleName,
            }],
          },
        }])
      } catch (err) {
        logger.log(`error creating rule ${ruleName} in ${deployment.scenario.name}, but continuing: ${err.message}`)
        // Next time we need to dig in the response to get the actual error message, figure out how to do that!
        // For now, I can't remember WHERE in the `err` I saw the error message (in the response body), but it 
        // is there, but buried ...
        console.log(err)
      }
    })
  })
  await Promise.all(queues)

  logger.log(`running for ${minutes} minute(s)`)
  await delay(minutes * 60 * 1000)
  
  logger.log(`waiting for current stats capturing to complete`)
  // wait for current stats capturing cycle to complete
  await cancelPollingForStats()

  logger.log(`capturing event logs`)
  /** @type { EventLogRecord[] } */
  let completeLog = []
  for (const deployment of deployments) {
    const eventLog = await getEventLog(`${deployment.scenario.sortName}`, deployment.esUrl)
    completeLog = completeLog.concat(eventLog)
  }

  completeLog.sort(sortByDate)
  logger.log(`generating report`)
  generateReport(runName, template, suite, deployments, completeLog, kbStatusList, esStatusList, kbTaskManagerStatusList)

  logger.log('')
  logger.log(`deleting deployments`)
  const deletePromises = deployments.map(deployment => deployment.delete())
  await Promise.all(deletePromises)
  logger.log(`deployments deleted`)

  await listOldDeployments(config)

  /** @type { (deployments: Deployment[], kbStatusList: any[]) => Promise<void> } */
  async function updateKbStatus(deployments, kbStatusList) {
    for (const deployment of deployments) {
      try {
        const status = await getKbStatus(deployment.kbUrl)
        status.scenario = deployment.scenario.sortName
        delete status.status // don't need this info, save some space
        kbStatusList.push(status)
      } catch (err) {
        logger.log(`error getting kb stats from ${deployment.scenario.name}: ${err}`)
      }
    }
  }

  /** @type { (deployments: Deployment[], kbTaskManagerStatusList: Map<string, Map<string, TaskManagerStats[]>>) => Promise<void> } */
  async function updateKbTMStatus(deployments, kbTaskManagerStatusList) {
    for (const deployment of deployments) {
      if(!kbTaskManagerStatusList.has(deployment.scenario.sortName)){
        kbTaskManagerStatusList.set(deployment.scenario.sortName, new Map())
      }
      const scenarioTmStats = kbTaskManagerStatusList.get(deployment.scenario.sortName)
      const tmIDsInScenaio = Array.from(scenarioTmStats.keys())

      try {
        const statusMap = new Map()
        logger.log(`collecting stats from ${deployment.kbInstances} Task Managers`)
        
        await retryMaxTimes(async () => {
          const tmStats = await getKbTaskManagerStatus(deployment.kbUrl)
          if(!statusMap.has(tmStats.id)){
            tmStats.scenario = deployment.scenario.sortName
            statusMap.set(tmStats.id, tmStats)
          }
          return statusMap.size === deployment.kbInstances
        }, deployment.kbInstances * 4)

        if(statusMap.size !== deployment.kbInstances){
          const missingTMs = tmIDsInScenaio.filter(tmId => !statusMap.has(tmId))
          const missingCount = deployment.kbInstances - statusMap.size
          logger.log(`failed to find ${missingCount} Task managers (${missingTMs.join(', ')}${ missingCount > missingTMs.length ? ` and ${missingCount - missingTMs.length} more` : ``})`)
        }

        statusMap.forEach((stat, tmId) => {
          if(!scenarioTmStats.has(tmId)){
            scenarioTmStats.set(tmId, [])
          }
          scenarioTmStats.get(tmId).push(stat)
        })
      } catch (err) {
        logger.log(`error getting kb stats from ${deployment.scenario.name}: ${err}`)
      }
    }
  }

  /** @type { (deployments: Deployment[], esStatusList: any[]) => Promise<void> } */
  async function updateEsStatus(deployments, esStatusList) {
    for (const deployment of deployments) {
      try {
        const statuses = await getEsStatus(deployment.esUrl)
        for (const status of statuses) {
          status.scenario = deployment.scenario.sortName
          status.date = new Date().toISOString()
          esStatusList.push(status)
        }
      } catch (err) {
        logger.log(`error getting es stats from ${deployment.scenario.name}: ${err}`)
      }
    }
  }
}

/** @type { CommandHandler } */
// @ts-ignore
async function env({ config, minutes }, [ suiteId ]) {
  logger.log('current environment:')
  logger.log(`  minutes:   ${minutes}`)
  logger.log(`  config:    ${config}`)

  const configFile = path.join(homedir(), '.ecctl', `${config}.json`)
  /** @type { any } */
  let configData = {}
  try {
    configData = require(configFile)
    logger.log(`     host:   ${configData.host}`)
    logger.log(`     region: ${configData.region}`)
  } catch (err) {
    logger.log(`    error reading config file "${configFile}": ${err}`)
  }
}

/** @type { CommandHandler } */
// @ts-ignore
async function ls({ config }, args) {
  const suites = getSuites()
  for (const { id, description, scenarios } of suites) {
    logger.log(`suite: ${id} - ${description}`)
    for (const scenario of scenarios) {
      logger.log(`    ${scenario.name}`)
    }
  }

  for (const suite of suites) {
    try {
      validateSuite(suite)
    } catch (err) {
      logger.log(`error: ${err.message}`)
    }
  }
}

/** @type { CommandHandler } */
// @ts-ignore
async function lsv({ config }) {
  const suites = getSuites()
  for (const { id, description, scenarios } of suites) {
    logger.log(`suite: ${id} - ${description}`)
    for (const scenario of scenarios) {
      const prefix1 = `    `
      const prefix2 = `${prefix1}${prefix1}`
      logger.log(`${prefix1}${scenario.name}`)
      logger.log(`${prefix2}version:        ${scenario.version}`)
      logger.log(`${prefix2}esSpec:         ${scenario.esSpec}`)
      logger.log(`${prefix2}kbSpec:         ${scenario.kbSpec}`)
      logger.log(`${prefix2}rules:          ${scenario.ruleCount}`)
      logger.log(`${prefix2}ruleInterval:   ${scenario.ruleInterval}`)
      logger.log(`${prefix2}tmPollInterval: ${scenario.tmPollInterval}`)
      logger.log(`${prefix2}tmMaxWorkers:   ${scenario.tmMaxWorkers}`)
    }
    logger.log('')
  }

  for (const suite of suites) {
    try {
      validateSuite(suite)
    } catch (err) {
      logger.log(`error: ${err.message}`)
    }
  }
}

/** @type { CommandHandler } */
async function lsd({ config }) {
  const deployments = await getDeployments(config)
  for (const { name, id } of deployments) {
    logger.log(`${id} - ${name}`)
  }
}

/** @type { CommandHandler } */
async function lst({ config }) {
  const deployments = await ecCommands.listTemplates({ config })
  for (const { description, id } of deployments) {
    logger.log(`${id} - ${description}`)
  }
}

/** @type { CommandHandler } */
async function rmd({ config }, [pattern]) {
  if (pattern == null) {
    return logger.logErrorAndExit('deployment pattern must be passed as a parameter')
  }

  const deployments = await getDeployments(config)
  for (const { name, id } of deployments) {
    if ((pattern !== '*') && (name.indexOf(pattern) === -1)) continue

    logger.log(`deleting deployment ${id} - ${name}`)

    try {
      await ecCommands.deleteDeployment({ config, id, name })
    } catch (err) {
      logger.log(`error deleting deployment: ${err}`)
    }
  }
}

/** @type { CommandHandler } */
async function rmdall({ config }) {
  return await rmd({ config, minutes: 0, percentFiring: 0 }, ['*'])
}

/** @type { CommandHandler } */
async function help() {
  console.log(parseArgs.help)
}

/** @type { (config: string) => Promise<{ id: string, name: string }[]> } */
async function getDeployments(config) {
  /** @type { { deployments: { id: string, name: string }[] } } */
  const { deployments } = await ecCommands.listDeployments({ config })

  return deployments
    .filter(({ name }) => name.startsWith(DeploymentPrefix))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** @type { (config: string) => Promise<void> } */
async function listOldDeployments(config) {
  const deployments = await getDeployments(config)
  if (deployments.length === 0) return

  logger.log('')
  logger.log('currently running (old?) deployments:')
  await lsd({ config, minutes: 0, percentFiring: 0 })
  logger.log(`(use "${pkg.name} rmd" or "${pkg.name} rmdall" to delete)`)
  logger.log('')
}


/** @type { (retryPredicate: () => Promise<boolean>, times: number) => Promise<void> } */
async function retryMaxTimes(retryPredicate, times) {
  const result = await retryPredicate()
  if(!result && times > 0){
    await retryMaxTimes(retryPredicate, times - 1)
  }
}

/** @type { (fetchStats: () => Promise<any>, logger: { log: (message: string) => void} ) => () => Promise<void> } */
function startPollingForStats(fetchStats, logger) {
  /** @type { Promise<void> } */
  let statsCollectionInProgress = null

  const interval = setInterval(async () => {
    statsCollectionInProgress = fetchStats()
    await statsCollectionInProgress

  }, STATS_INTERVAL_MILLIS).unref()

  return async () => {
    logger.log(`canceling stats collection`)
    clearInterval(interval)
    if(statsCollectionInProgress){
      logger.log(`waiting for current stats collection to end`)
      await statsCollectionInProgress
      logger.log(`stats collection complete`)
    }
  }
}