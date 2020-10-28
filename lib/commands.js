'use strict'

/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').ResourceSizes } ResourceSizes */
/** @typedef { import('./types').DeploymentOptions } DeploymentOptions */
/** @typedef { import('./types').CommandHandler } CommandHandler */

const pkg = require('../package.json')
const logger = require('./logger')
const { createDeployment } = require('./deployment')
const parseArgs = require('./parse_args')

module.exports = {
  run,
  help,
}

/** @type { CommandHandler } */
async function run(config, args) {
  const date = new Date()

  const deploymentSpecs = [
    { es: { sizes: { instances: 1, ram: 1 } }, kb: { sizes: { instances: 1, ram: 1 } } },
    { es: { sizes: { instances: 1, ram: 4 } }, kb: { sizes: { instances: 1, ram: 4 } } },
    { es: { sizes: { instances: 1, ram: 8 } }, kb: { sizes: { instances: 2, ram: 8 } } },
    { es: { sizes: { instances: 1, ram: 8 } }, kb: { sizes: { instances: 4, ram: 8 } } },
  ].slice(0, 1) // just run one till everything's working

  logger.log(`creating deployments`)
  const deploymentPromises = deploymentSpecs.map(spec => createDeployment(config, date, spec))
  await Promise.all(deploymentPromises)
  
  /** @type { Deployment[] } */
  const deployments = []
  for (const deploymentPromise of deploymentPromises) {
    deployments.push(await deploymentPromise)
  }

  logger.log(`deployments created`)

  logger.log(`TBD ... create alert input indices`)
  logger.log(`TBD ... create index actions`)
  logger.log(`TBD ... create index alerts`)
  logger.log(`TBD ... start capturing task manager stats`)
  logger.log(`TBD ... run for ~10 minutes`)
  logger.log(`TBD ... capture event logs`)

  logger.log(`deleting deployments`)
  const deletePromises = deployments.map(deployment => deployment.delete())
  await Promise.all(deletePromises)
  logger.log(`deployments deleted`)
}

/** @type { CommandHandler } */
async function help(config, args) {
  console.log(parseArgs.help)
  process.exit(1)
}