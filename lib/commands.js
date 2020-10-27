'use strict'

/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').ResourceInfo } ResourceInfo */
/** @typedef { import('./types').ResourceSizes } ResourceSizes */
/** @typedef { import('./types').DeploymentOptions } DeploymentOptions */

const pkg = require('../package.json')
const logger = require('./logger')
const ecCommands = require('./ec_commands')

module.exports = {
  run,
}

/** @type { (config: string, args: string[]) => Promise<void> } */
async function run(config, args) {
  const date = new Date()
  let deployment = await ecCommands.createDeployment(config, date, {
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
  })
  logger.debug(`deployment: ${JSON.stringify(deployment, null, 4)}`)

  logger.log(`deployment: ${JSON.stringify(deployment, null, 4)}`)

  deployment = await ecCommands.waitForDeploymentHealthy(deployment)
  logger.log(`healthy deployment: ${JSON.stringify(deployment, null, 4)}`)

  logger.log(`TBD ... create indices`)
  logger.log(`TBD ... create index action`)
  logger.log(`TBD ... create index alerts`)
  logger.log(`TBD ... start feeding alert index`)
  logger.log(`TBD ... capture event log / task manager stats`)
  logger.log(`TBD ... delete deployment`)
}