'use strict'

/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').CommandHandler } CommandHandler */
/** @typedef { import('./types').EventLogRecord } EventLogRecord */

const pkg = require('../package.json')
const logger = require('./logger')
const ecCommands = require('./ec_commands')
const { createDeployment, splitX, InstancePrefix } = require('./deployment')
const parseArgs = require('./parse_args')
const scenarios = require('./scenarios')
const { createAlert } = require('./kb')
const { getEventLog } = require('./es')
const { generateReport } = require('./report')
const { delay, sortById, shortDateString } = require('./utils')

module.exports = {
  commands: [
    run,
    help,
    ls,
    lsd,
    rmd,
    rmdall,
  ]
}

/** @type { CommandHandler } */
async function ls({ config, stack }, args) {
  for (const scenario of scenarios.getScenarios()) {
    console.log('')
    const { id, alerts, minutes } = scenario
    console.log(`${id}`)
    console.log(`  ${alerts} alerts for ${minutes} minutes`)
    for (const { es, kb } of scenario.deployments) {
      const [esN, esM] = splitX(es)
      const [kbN, kbM] = splitX(kb)
      console.log(`    es: ${esN} x ${esM}GB;  kb: ${kbN} x ${kbM}GB`)
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

  await listOldDeployments(config)

  const date = new Date()
  const runName = shortDateString(date)
  const deploymentSpecs = scenario.deployments

  logger.log(`creating deployments for stack ${stack || '(default)'}`)
  const deploymentPromises = deploymentSpecs.map(spec => createDeployment(config, stack, runName, spec))
  
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
  deployments.sort(sortById)

  logger.log('')
  for (const deployment of deployments) {
    logger.log(`deployment ${deployment.id}`)
    logger.log(`  es: ${deployment.esUrl}`)
    logger.log(`  kb: ${deployment.kbUrl}`)
    logger.log('')
  }

  logger.log(`TBD ... creating alert input indices`)
  
  logger.log(`creating index alerts`)
  /** @type { Array<Promise<string>> } */
  const alertPromises = []
  for (const deployment of deployments) {
    for (let i = 0; i < scenario.alerts; i++) {
      const name = `${i}`.padStart(4, '0')
      alertPromises.push(createAlert(deployment.kbUrl, name, 'ignored-for-now'))
    }
  }
  await Promise.all(alertPromises)

  logger.log(`TBD ... starting capture of task manager stats`)
  
  const waitMinutes = minutes || scenario.minutes 
  logger.log(`running for ${waitMinutes} minute(s)`)
  await delay(waitMinutes * 60 * 1000)
  
  logger.log(`capturing event logs`)
  /** @type { EventLogRecord[] } */
  let completeLog = []
  for (const deployment of deployments) {
    const eventLog = await getEventLog(deployment.name, deployment.esUrl)
    completeLog = completeLog.concat(eventLog)
  }

  logger.log(`generating report`)
  generateReport(runName, scenario, deployments, completeLog)

  logger.log('')
  logger.log(`deleting deployments`)
  const deletePromises = deployments.map(deployment => deployment.delete())
  await Promise.all(deletePromises)
  logger.log(`deployments deleted`)

  await listOldDeployments(config)
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
