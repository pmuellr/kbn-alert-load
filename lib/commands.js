'use strict'

/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').ResourceInfo } ResourceInfo */
/** @typedef { import('./types').ResourceSizes } ResourceSizes */
/** @typedef { import('./types').DeploymentOptions } DeploymentOptions */
/** @typedef { import('./types').CommandHandler } CommandHandler */

const pkg = require('../package.json')
const logger = require('./logger')
const ecCommands = require('./ec_commands')

module.exports = {
  run,
  help,
}

/** @type { CommandHandler } */
async function run(config, args) {
  const date = new Date()

  const deploymentSpec = {
    elasticsearch: {
      sizes: {
        instances: 1,
        ram: 1,
      }
    },
    kibana: {
      sizes: {
        instances: 1,
        ram: 1,
      }
    }
  }
  logger.log(`creating deployment: ${JSON.stringify(deploymentSpec)}`)
  const createdDeployment = await ecCommands.createDeployment(config, date, deploymentSpec)

  logger.log(`waiting for healthy deployment: ${JSON.stringify(createdDeployment, null, 4)}`)
  const runningDeployment = await ecCommands.waitForDeploymentHealthy(createdDeployment)
  logger.log(`done waiting for healthy deployment: ${JSON.stringify(runningDeployment, null, 4)}`)

  logger.log(`TBD ... create indices`)
  logger.log(`TBD ... create index action`)
  logger.log(`TBD ... create index alerts`)
  logger.log(`TBD ... start feeding alert index`)
  logger.log(`TBD ... capture event log / task manager stats`)

  logger.log(`deleting deployment`)
  const deletedDeployment = await ecCommands.deleteDeployment(config, createdDeployment.id)
  logger.log(`deployment deleted: ${JSON.stringify(deletedDeployment, null, 4)}`)
}

/** @type { CommandHandler } */
async function help(config, args) {
  console.log(`
${pkg.name}: ${pkg.description}
v${pkg.version}

usage:
    ${pkg.name} run <args>
`.trim())
  
  process.exit(1)
}