'use strict'

/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').ResourceSizes } ResourceSizes */
/** @typedef { import('./types').DeploymentOptions } DeploymentOptions */
/** @typedef { import('./types').DeploymentCtorOptions } DeploymentCtorOptions */
/** @typedef { import('./types').GetDeploymentResult } GetDeploymentResult */

const pkg = require('../package.json')
const logger = require('./logger')
const ecCommands = require('./ec_commands')

const InstancePrefix = '💪'

module.exports = {
  createDeployment,
}

/** @type { (config: string, date: Date, options: DeploymentOptions) => Promise<Deployment> } */
async function createDeployment(config, date, options) {
  config = config || 'config'
  const name = getName(date, options)
  const deploymentName = `${InstancePrefix}${name}`
  const esSizes = ecctlSizeNormalize(options.es.sizes, 'elasticsearch')
  const kbSizes = ecctlSizeNormalize(options.kb.sizes, 'kibana')

  const { id, username, password } = await ecCommands.createDeployment({
    config,
    name,
    deploymentName,
    esSize: esSizes.instances * esSizes.ram,
    kbSize: kbSizes.instances * kbSizes.ram,
  })

  const info = await waitForHealthyDeployment(config, id, name)
  const { healthy, status, esEndpoint, esPort, kbEndpoint, kbPort } = info
  const esUrl = `https://${username}:${password}@${esEndpoint}:${esPort}`
  const kbUrl = `https://${username}:${password}@${kbEndpoint}:${kbPort}`

  return new DeploymentImpl({config, id, name, esUrl, kbUrl, healthy, status})
}

/** @extends Deployment } */
class DeploymentImpl {
  /**
   * @param {DeploymentCtorOptions} options
   */  
  constructor(options) {
    const { config, id, name, esUrl, kbUrl, healthy, status } = options
  
    this.config = config
    this.id = id
    this.name = name
    this.healthy = healthy
    this.status = status

    /** @private */
    this.esUrl = esUrl
    /** @private */
    this.kbUrl = kbUrl
  }

  async delete() {
    const { config, id, name } = this
    await ecCommands.deleteDeployment({ config, id, name })
  }

  /** @private */
  async _updateStatus() {
    const info = await ecCommands.getDeployment({
      config: this.config,
      id: this.id,
      name: this.name, 
     })

    this.healthy = info.healthy
    this.status = info.status
  }
}

/** @type { (config: string, id: string, name: string, wait: number, interval: number) => Promise<GetDeploymentResult> } */
async function waitForHealthyDeployment(config, id, name, wait = 1000 * 60 * 5, interval = 5000) {
  if (wait <= 0) throw new Error(`timeout waiting for ${name} to become healthy`)

  const info = await ecCommands.getDeployment({ config, name, id })
  if (info.healthy) {
    logger.log(`deployment "${name}" healthy: ${info.status}`)
    return info
  }

  const secondsLeft = Math.round(wait / 1000)
  logger.log(`deployment "${name}" not healthy: ${info.status}; waiting ${secondsLeft} more seconds`)
  await delay(interval)
  return waitForHealthyDeployment(config, id, name, wait - interval, interval)

}

/** @type { (date: Date, options: DeploymentOptions) => string } */
function getName(date, options) {
  const dateString = date.toISOString()
    .substr(5,14)      // mm-ddThh:mm:ss
    .replace(/-/g,'')  // mmddThh:mm:ss
    .replace(/:/g,'')  // mmddThhmmss
    .replace('T','-')  // mmdd-hhmmss
  const eSize = ecctlSizeString(options.es.sizes)
  const kSize = ecctlSizeString(options.kb.sizes)

  return `${dateString}-e${eSize}-k${kSize}`
}

/** @type { ({ instances, ram }: ResourceSizes) => string } */
function ecctlSizeString({ instances, ram }) {
  return `${instances}x${ram}`
}

/** @type { ({ instances, ram }: Partial<ResourceSizes>, type: 'kibana' | 'elasticsearch') => ResourceSizes } */
function ecctlSizeNormalize({ instances, ram }, type) {
  const rams = type === 'elasticsearch' ? [1, 2, 4, 8, 15, 29, 58] : [1, 2, 4, 8]
  const ramMax = rams[rams.length - 1]

  if (instances == null) instances = 1
  if (ram == null) ram = 1

  if (instances > 1 && ram !== ramMax) {
    throw new Error(`must specify ${ramMax}GB of ram for > 1 ${type} instance`)
  }

  if (rams.find(validRam => ram === validRam)) {
    return { instances, ram }
  }

  throw new Error(`invalid ${type} ram size: ${ram}; valid values: ${rams.join(' ')}`)
}

/** @type { (ms: number) => Promise<void> } */
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
