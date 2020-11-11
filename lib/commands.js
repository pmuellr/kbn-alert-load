'use strict'

/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').CommandHandler } CommandHandler */
/** @typedef { import('./types').EventLogRecord } EventLogRecord */

const pkg = require('../package.json')
const logger = require('./logger')
const ecCommands = require('./ec-commands')
const { createDeployment, splitX, InstancePrefix } = require('./deployment')
const parseArgs = require('./parse_args')
const scenarios = require('./scenarios')
const { createAlert, getKbStatus } = require('./kb')
const { getEventLog, getEsStatus } = require('./es')
const { generateReport } = require('./report')
const { delay, shortDateString, arrayFrom, sortBySemver, sortByDate } = require('./utils')
const { runQueue } = require('./work-queue')

module.exports = {
  commands: [
    run,
    help,
    ls,
    lsd,
    lss,
    rmd,
    rmdall,
    env,
  ]
}

const STATS_INTERVAL_MILLIS = 15 * 1000

/** @type { CommandHandler } */
async function env({ config, stack, minutes }, [ scenarioId ]) {
  logger.log('current environment:')
  logger.log(`  config:  ${config}`)
  logger.log(`  stack:   ${stack}`)
  logger.log(`  minutes: ${minutes}`)
}

/** @type { CommandHandler } */
async function ls({ config, stack }, args) {
  for (const scenario of scenarios.getScenarios()) {
    logger.log('')
    const { id, alerts, minutes } = scenario
    logger.log(`${id}`)
    logger.log(`  ${alerts} alerts for ${minutes} minutes`)
    for (const { es, kb } of scenario.deployments) {
      const [esN, esM] = splitX(es)
      const [kbN, kbM] = splitX(kb)
      logger.log(`    es: ${esN} x ${esM}GB;  kb: ${kbN} x ${kbM}GB`)
    }
  }
}

/** @type { CommandHandler } */
async function lsd({ config }) {
  const deployments = await getDeployments(config)

  for (const [name, id] of deployments) {
    logger.log(`${name}    id: ${id}`)
  }
}

/** @type { CommandHandler } */
async function lss({ config }) {
  const stacks = await ecCommands.listStacks({ config })

  const versions = []
  for (const { version } of stacks.stacks) {
    if (version.startsWith('2.')) continue
    if (version.startsWith('5.')) continue
    if (version.startsWith('6.')) continue
    if (version.startsWith('7.0.')) continue
    if (version.startsWith('7.1.')) continue
    if (version.startsWith('7.2.')) continue
    if (version.startsWith('7.3.')) continue
    if (version.startsWith('7.4.')) continue
    if (version.startsWith('7.5.')) continue

    versions.push(version)
  }

  versions.sort(sortBySemver).reverse()
  versions.forEach(version => console.log(version))
}

/** @type { CommandHandler } */
async function rmd({ config }, [match]) {
  if (match == null) {
    return logger.logErrorAndExit('deployment must be passed as a parameter')
  }

  const deployments = await getDeployments(config)

  for (const [name, id] of deployments) {
    if ((match !== '*') && (name.indexOf(match) === -1)) continue

    logger.log(`deleting deployment ${name}    id: ${id}`)

    try {
      await ecCommands.deleteDeployment({ config, id, name })
    } catch (err) {
      logger.log(`error deleting deployment: ${err}`)
    }
  }
}

/** @type { CommandHandler } */
async function rmdall({ config }) {
  return await rmd({ config, stack: '', minutes: 0 }, ['*'])
}

/** @type { CommandHandler } */
async function run({ config, stack, minutes }, [ scenarioId ]) {
  if (scenarioId == null) {
    return logger.logErrorAndExit('scenario must passed as an parameter')
  }

  const scenario = scenarios.getScenario(scenarioId)
  if (scenario == null) {
    return logger.logErrorAndExit(`no scenario with id ${scenarioId}`)
  }

  logger.printTime(true)
  await listOldDeployments(config)

  const date = new Date()
  const runName = shortDateString(date)
  const deploymentSpecs = scenario.deployments

  logger.log(`creating deployments for config ${config || '(default)'}, stack ${stack || '(default)'}`)
  const deploymentPromises = deploymentSpecs.map((spec, index) => createDeployment(config, stack, `${runName}-${index}`, spec))
  
  try {
    await Promise.all(deploymentPromises)
  } catch (err) {
    return logger.logErrorAndExit(`error creating deployments: ${err}`)
  }
  
  /** @type { Deployment[] } */
  const deployments = []
  for (const deploymentPromise of deploymentPromises) {
    deployments.push(await deploymentPromise)
  }

  logger.log('')
  for (const deployment of deployments) {
    logger.log(`deployment ${deployment.id} ${deployment.name}`)
    logger.log(`  es: ${deployment.esUrl}`)
    logger.log(`  kb: ${deployment.kbUrl}`)
    logger.log('')
  }

  logger.log(`TBD ... creating alert input indices`)
  
  logger.log('starting stats collection')
  /** @type { any[] } */
  const kbStatusList = []
  /** @type { any[] } */
  const esStatusList = []
  const interval = setInterval(async () => {
    updateKbStatus(deployments, kbStatusList)
    updateEsStatus(deployments, esStatusList)
  }, STATS_INTERVAL_MILLIS).unref()

  logger.log(`creating ${scenario.alerts} index alerts`)
  const alertNames = arrayFrom(scenario.alerts, (i) => `${i}`.padStart(4, '0'))
  const queues = []
  for (const deployment of deployments) {
    const queue = runQueue(alertNames, 20, async (alertName) => {
      return await createAlert(deployment.kbUrl, alertName, 'ignored-for-now')
    })
    queues.push(queue)
  }
  await Promise.all(queues)

  const waitMinutes = minutes || scenario.minutes 
  logger.log(`running for ${waitMinutes} minute(s)`)
  await delay(waitMinutes * 60 * 1000)
  
  clearInterval(interval)

  logger.log(`capturing event logs`)
  /** @type { EventLogRecord[] } */
  let completeLog = []
  for (const deployment of deployments) {
    const eventLog = await getEventLog(`${deployment.name}`, deployment.esUrl)
    completeLog = completeLog.concat(eventLog)
  }

  completeLog.sort(sortByDate)
  logger.log(`generating report`)
  generateReport(runName, scenario, deployments, completeLog, kbStatusList, esStatusList)

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
        status.deployment = deployment.name
        delete status.status // don't need this info, save some space
        kbStatusList.push(status)
      } catch (err) {
        logger.log(`error getting kb stats from ${deployment.name}: ${err}`)
      }
    }
  }

  /** @type { (deployments: Deployment[], esStatusList: any[]) => Promise<void> } */
  async function updateEsStatus(deployments, esStatusList) {
    for (const deployment of deployments) {
      try {
        const statuses = await getEsStatus(deployment.esUrl)
        for (const status of statuses) {
          status.deployment = deployment.name
          status.date = new Date().toISOString()
          esStatusList.push(status)
        }
      } catch (err) {
        logger.log(`error getting es stats from ${deployment.name}: ${err}`)
      }
    }
  }
}

/** @type { CommandHandler } */
async function help() {
  console.log(parseArgs.help)
}

/** @type { (config: string) => Promise<string[][]> } */
async function getDeployments(config) {
  const { deployments } = await ecCommands.listDeployments({ config })

  let maxNameLength = 0
  for (const deployment of deployments) {
    const name = `${deployment.name}`.substr(2) // remove InstancePrefix
    if (!name.startsWith(InstancePrefix)) continue

    maxNameLength = Math.max(maxNameLength, name.length)
  }

  /** @type { string[][] } */
  const result = []
  for (const deployment of deployments) {
    const id = `${deployment.id}`
    const name = `${deployment.name}`
    if (!name.startsWith(InstancePrefix)) continue

    result.push([name.substr(2), id])
  }

  return result.sort((a, b) => a[0].localeCompare(b[0]))
}

/** @type { (config: string) => Promise<void> } */
async function listOldDeployments(config) {
  const deployments = await getDeployments(config)
  if (deployments.length === 0) return

  logger.log('')
  logger.log('currently running (old?) deployments:')
  await lsd({ config, minutes: 0, stack: '' })
  logger.log(`(use "${pkg.name} rmd" or "${pkg.name} rmdall" to delete)`)
  logger.log('')
}
