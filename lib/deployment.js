'use strict'

/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').DeploymentSpec } DeploymentSpec */
/** @typedef { import('./types').DeploymentCtorOptions } DeploymentCtorOptions */
/** @typedef { import('./types').GetDeploymentResult } GetDeploymentResult */

const logger = require('./logger')
const ecCommands = require('./ec-commands')
const { splitX, delay } = require('./utils')

const InstancePrefix = '💪KAL-'

module.exports = {
  createDeployment,
  splitX,
  InstancePrefix,
}

/** @type { (config: string, stack: string | undefined, runName: string, spec: DeploymentSpec) => Promise<Deployment> } */
async function createDeployment(config, stack, runName, spec) {
  config = config || 'config'
  const name = `${runName}-e${spec.es}-k${spec.kb}`
  const deploymentName = `${InstancePrefix}${name}`
  const esSize = ecctlSize(spec.es, 'elasticsearch')
  const kbSize = ecctlSize(spec.kb, 'kibana')

  const { id, username, password } = await ecCommands.createDeployment({
    config,
    stack,
    name,
    deploymentName,
    esSize,
    kbSize,
  })

  const info = await waitForHealthyDeployment(config, id, name)
  const { healthy, status, esEndpoint, esPort, kbEndpoint, kbPort, version, zone } = info
  const esUrl = `https://${username}:${password}@${esEndpoint}:${esPort}`
  const kbUrl = `https://${username}:${password}@${kbEndpoint}:${kbPort}`

  const deployment = new DeploymentImpl({config, id, name, esUrl, kbUrl, healthy, status, version, zone})
  logger.log(`deployment created: ${deployment}`)
  return deployment
}

/** @extends Deployment } */
class DeploymentImpl {
  /**
   * @param {DeploymentCtorOptions} options
   */  
  constructor(options) {
    const { config, id, name, esUrl, kbUrl, healthy, status, version, zone } = options
  
    this.config = config
    this.id = id
    this.name = name
    this.healthy = healthy
    this.status = status
    this.version = version
    this.zone = zone
    this.esUrl = esUrl
    this.kbUrl = kbUrl
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
async function waitForHealthyDeployment(config, id, name, wait = 1000 * 60 * 5, interval = 10000) {
  if (wait <= 0) throw new Error(`timeout waiting for ${name} to become healthy`)

  const info = await ecCommands.getDeployment({ config, name, id })
  if (info.healthy) {
    logger.log(`deployment "${name}" ready: ${info.status}`)
    return info
  }

  const secondsLeft = Math.round(wait / 1000)
  logger.log(`deployment "${name}" not ready: ${info.status}; waiting ${secondsLeft} more seconds`)
  await delay(interval)
  return waitForHealthyDeployment(config, id, name, wait - interval, interval)
}

/** @type { (spec: string, type: 'kibana' | 'elasticsearch') => number } */
function ecctlSize(spec, type) {
  const rams = type === 'elasticsearch' ? [1, 2, 4, 8, 15, 29, 58] : [1, 2, 4, 8]
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
