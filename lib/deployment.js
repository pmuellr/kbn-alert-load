'use strict'

/** @typedef { import('./types').Suite } Suite */
/** @typedef { import('./types').Scenario } Scenario */
/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').DeploymentCtorOptions } DeploymentCtorOptions */
/** @typedef { import('./types').GetDeploymentResult } GetDeploymentResult */

const logger = require('./logger')
const ecCommands = require('./ec-commands')
const { splitX, delay } = require('./utils')

const DeploymentPrefix = '💪KAL-'
const DeployWaitMinutes = 10
const DeployWaitMillis = DeployWaitMinutes * 60 * 1000

module.exports = {
  createDeployment,
  splitX,
  DeploymentPrefix,
  ecctlSize,
}

/** @type { (config: string, template: string | null, runName: string, suite: Suite, scenario: Scenario) => Promise<Deployment> } */
async function createDeployment(config, template, runName, suite, scenario) {
  const { id: suiteId } = suite
  const { name: scenarioName, esSpec, kbSpec, version: scenarioVersion } = scenario
  const { tmMaxWorkers, tmPollInterval } = scenario
  const name = `${runName}-${suiteId} ${scenarioName}`
  const deploymentName = `${DeploymentPrefix}-${name}`
  const esSize = ecctlSize(esSpec, 'elasticsearch')
  const kbSize = ecctlSize(kbSpec, 'kibana')
  let [kbInstances] = splitX(kbSpec)

  const { id, username, password } = await ecCommands.createDeployment({
    config,
    template,
    stack: scenarioVersion,
    name,
    deploymentName,
    esSize,
    kbSize,
    tmMaxWorkers,
    tmPollInterval
  })

  const info = await waitForHealthyDeployment(config, id, name)
  const { healthy, status, esEndpoint, esPort, kbEndpoint, kbPort, version, zone } = info
  const esUrl = `https://${username}:${password}@${esEndpoint}:${esPort}`
  const kbUrl = `https://${username}:${password}@${kbEndpoint}:${kbPort}`

  const deployment = new DeploymentImpl({config, id, name, esUrl, kbUrl, healthy, status, version, zone, scenario, kbInstances })
  return deployment
}

/** @extends Deployment } */
class DeploymentImpl {
  /**
   * @param {DeploymentCtorOptions} options
   */  
  constructor(options) {
    const { config, id, name, esUrl, kbUrl, healthy, status, version, zone, scenario, kbInstances } = options
  
    this.config = config
    this.id = id
    this.name = name
    this.healthy = healthy
    this.status = status
    this.version = version
    this.zone = zone
    this.esUrl = esUrl
    this.kbUrl = kbUrl
    this.scenario = scenario
    this.kbInstances = kbInstances
  }

  toString() {
    return `${this.version} ${this.zone} ${this.name} -- ${this.status}`
  }

  async delete() {
    const { config, id, name } = this
    await ecCommands.deleteDeployment({ config, id, name })
  }
}

/** @type { (config: string, id: string, name: string, wait: number, interval: number) => Promise<GetDeploymentResult> } */
async function waitForHealthyDeployment(config, id, name, wait = DeployWaitMillis, interval = 10000) {
  if (wait <= 0) throw new Error(`timeout waiting for ${name} to become healthy`)

  const info = await ecCommands.getDeployment({ config, name, id })
  if (info.healthy) {
    logger.log(`deployment complete "${name}" - ${info.status}`)
    return info
  }

  const secondsLeft = Math.round(wait / 1000)
  logger.log(`deployment waiting  "${name}" - ${info.status}; waiting ${secondsLeft} more seconds`)
  await delay(interval)
  return waitForHealthyDeployment(config, id, name, wait - interval, interval)
}

/** @type { (spec: string, type: 'kibana' | 'elasticsearch') => number } */
function ecctlSize(spec, type) {
  // const rams = type === 'elasticsearch' ? [1, 2, 4, 8, 15, 29, 58] : [1, 2, 4, 8]
  const rams = type === 'elasticsearch' ? [1, 2, 4, 8, 16, 32, 64] : [1, 2, 4, 8]
  const ramMax = rams[rams.length - 1]

  let [instances, ram] = splitX(spec)
  if (instances == null) instances = 1
  if (ram == null) ram = 1

  if (instances > 1 && ram !== ramMax) {
    throw new Error(`must specify ${ramMax}GB of ram for > 1 ${type} instance`)
  }

  if (rams.find(validRam => ram === validRam)) {
    return instances * ram
  }

  throw new Error(`invalid ${type} ram size: ${ram}; valid values: ${rams.join(' ')}`)
}
