'use strict'

/** @typedef { import('./types').Scenario } Scenario */

const Scenarios = require('../scenarios')
const { splitX } = require('./utils')
const logger = require('./logger')

module.exports = {
  getScenario,
  getScenarios,
}

/** @type { Map<string, Scenario> } */
let ScenariosMap = new Map()
for (const scenario of Scenarios) {
  ScenariosMap.set(scenario.id, scenario)

  const { deployments } = scenario
  for (const deployment of deployments) {
    const esSizes = splitX(deployment.es)
    const kbSizes = splitX(deployment.kb)
    if (esSizes == null) {
      logger.logErrorAndExit(`scenario ${scenario.id} es deployment spec ${deployment.es} is invalid`)
    }
    if (kbSizes == null) {
      logger.logErrorAndExit(`scenario ${scenario.id} kb deployment spec ${deployment.kb} is invalid`)
    }
  }
}

/** @type { () => Array<Scenario> } */
function getScenarios() {
  return clone(Scenarios)
}

/** @type { (id: string) => Scenario | undefined } */
function getScenario(id) {
  return clone(ScenariosMap.get(id))
}

/**
 * @template T 
 * @type { (object: T) => T } 
 * */
function clone(object) {
  if (object == null) return object
  return JSON.parse(JSON.stringify(object))
}

