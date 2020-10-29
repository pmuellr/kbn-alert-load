'use strict'

/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').CommandHandler } CommandHandler */
/** @typedef { import('./types').EventLogRecord } EventLogRecord */

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
async function lsd({ config, stack }, args) {
  const { deployments } = await ecCommands.listDeployments({ config })

  for (const deployment of deployments) {
    /** @type { string } */
    const name = `${deployment.name}`
    if (!name.startsWith(InstancePrefix)) continue
    console.log(name.substr(2))
  }
}

/** @type { CommandHandler } */
async function rmdall({ config, stack }, args) {
  const { deployments } = await ecCommands.listDeployments({ config })

  for (const deployment of deployments) {
    const id = `${deployment.id}`
    const name = `${deployment.name}`
    if (!name.startsWith(InstancePrefix)) continue

    logger.log(`deleting deployment ${name} ; id: ${id}`)

    try {
      await ecCommands.deleteDeployment({ config, id, name })
    } catch (err) {
      logger.log(`error deleting deployment: ${err}`)
    }
  }
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

  const date = new Date()
  const runName = shortDateString(date)
  const deploymentSpecs = scenario.deployments

  logger.log(`creating deployments for stack ${stack || '(default)'}`)
  const deploymentPromises = deploymentSpecs.map(spec => createDeployment(config, stack, runName, spec))
  await Promise.all(deploymentPromises)
  
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
}

/** @type { CommandHandler } */
async function help() {
  console.log(parseArgs.help)
}