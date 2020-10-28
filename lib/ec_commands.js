'use strict'

/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').ResourceInfo } ResourceInfo */
/** @typedef { import('./types').ResourceSizes } ResourceSizes */
/** @typedef { import('./types').DeploymentOptions } DeploymentOptions */

const { spawnSync } = require('child_process')

const pkg = require('../package.json')
const logger = require('./logger')

const InstancePrefix = '💪'

module.exports = {
  createDeployment,
  deleteDeployment,
  getDeployment,
  listDeployments,
  waitForDeploymentHealthy,
}

/** @type { (config: string, id: string) => Promise<any> } */
async function deleteDeployment(config, id) {
  const args = ['deployment', 'shutdown', id]
  args.push('--message', `${pkg.name}: deleting deployment ${id}`)
  args.push('--output', 'json')
  args.push('--force')

  return await ecctlRun(`deleting deployment ${id}`, args)
}

/** @type { (config: string) => Promise<Map<string, string>> } */
async function listDeployments(config) {
  const args = ['deployment', 'list']
  args.push('--message', `${pkg.name}: listing deployments`)
  args.push('--output', 'json')

  return await ecctlRun(`listing deployments`, args)
}

/** @type { (config: string, date: Date, options: DeploymentOptions) => Promise<Deployment> } */
async function createDeployment(config, date, options) {
  const args = ['deployment', 'create']

  if (config) args.push('--config', config)

  const name = deploymentName(date, options)
  args.push('--message', `${pkg.name}: creating deployment ${name}`)
  args.push('--output', 'json')
  args.push('--name', name)
  args.push('--es-size', `${ecctlSize(options.elasticsearch.sizes)}g`)
  args.push('--kibana-size', `${ecctlSize(options.kibana.sizes)}g`)

  const result = await ecctlRun(`creating deployment ${name}`, args)
  return deploymentFromCreateDeploymentResult(options, result)
}

/** @type { (deployment: Deployment, wait: number, interval: number) => Promise<Deployment> } */
async function waitForDeploymentHealthy(deployment, wait = 1000 * 60 * 5, interval = 5000) {
  if (wait <= 0) throw new Error(`timeout waiting for ${deployment.name}`)

  deployment = await getDeployment(deployment)
  if (deployment.healthy === true) {
    logger.log(`deployment ${deployment.name} healthy`)
    return deployment
  }

  const secondsLeft = Math.round(wait / 1000)
  logger.log(`deployment "${deployment.name}" ${deployment.status}; waiting ${secondsLeft} more seconds`)
  await delay(interval)
  return waitForDeploymentHealthy(deployment, wait - interval, interval)
}

/** @type { (deployment: Deployment) => Promise<Deployment> } */
async function getDeployment(deployment) {
  const { id } = deployment
  const args = ['deployment', 'show', id]
  if (deployment.config) args.push('--config', deployment.config)

  args.push('--output', 'json')
  const result = await ecctlRun(`getting deployment ${id}`, args)
  return deploymentFromShowDeploymentResult(deployment, result)
}

/** @type { (description: string, args: string[]) => Promise<any> } */
async function ecctlRun(description, args) {
  logger.debug(`spawnSync('ecctl', ${JSON.stringify(args)})`)
  try {
    var ecctl = spawnSync('ecctl', args, {
      maxBuffer: 20 * 1000 * 1000,
      encoding: 'utf8'
    })
  } catch(err) {
    return logger.logErrorAndExit(`error ${description}, running ecctl via spawnSync: ${err.message}`)
  }

  logger.debug(`spawnSync('ecctl', ${JSON.stringify(args)}) result:\n${ecctl.stdout}`)

  if (ecctl.signal || ecctl.status) {
    const message = [
      `error ${description}`,
      `signal: ${ecctl.signal}`,
      `status: ${ecctl.status}`,
      `error: ${ecctl.error}`,
      `stderr:`,
      ecctl.stderr,
      `stdout:`,
      ecctl.stdout,
    ].join('\n')
    return logger.logErrorAndExit(message)
  }

  try {
    return JSON.parse(ecctl.stdout)
  } catch (err) {
    return logger.logErrorAndExit(`error ${description}, parsing JSON: ${err}: ${ecctl.stdout}`)
  }
}

/** @type { (date: Date, options: DeploymentOptions) => string } */
function deploymentName(date, options) {
  const dateString = date.toISOString()
    .substr(5,14)
    .replace(/-/g,'')
    .replace(/:/g,'')  
    .replace('T','-')
  const eSize = ecctlSize(options.elasticsearch.sizes)
  const kSize = ecctlSize(options.kibana.sizes)

  return `${InstancePrefix}-${dateString}-e${eSize}-k${kSize}`
}

// returns the "size" parameter ecctl wants
/** @type { ({ instances, ram }: ResourceSizes) => number } */
function ecctlSize({ instances, ram }) {
  if (instances > 1) return 8 * instances // need 8GB ram for > 1 instance
  if (ram === 1) return 1
  if (ram <= 2) return 2
  if (ram <= 4) return 4
  return 8
}

/** @type { (options: DeploymentOptions, result: any) => Deployment } */
function deploymentFromCreateDeploymentResult(options, result) {
  if (result == null) throw new Error('unexpected null')

  const created = !!result.created
  const id = `${result.id}`
  const name = `${result.name}`
  const resources = result.resources || []
  const esResource = resources.find(resource => resource.kind === 'elasticsearch')
  if (esResource == null) throw new Error('no elasticsearch resource')

  const credentials = esResource.credentials || {}
  const username = credentials.username
  const password = credentials.password
  if (username == null) throw new Error('username not set')
  if (password == null) throw new Error('password not set')

  return {
    id,
    name,
    created,
    healthy: false,
    status: 'just created',
    credentials: {
      username,
      password,
    },
    elasticsearch: {
      sizes: options.elasticsearch.sizes,
      healthy: false,
      status: 'just created',
      url: '',
    },
    kibana: {
      sizes: options.kibana.sizes,
      healthy: false,
      status: 'just created',
      url: '',
    }
  }
}

/** @type { (deployment: Deployment, result: any) => Deployment } */
function deploymentFromShowDeploymentResult(deployment, result) {
  if (result == null) throw new Error('unexpected null')
  if (result.resources == null) throw new Error('unexpected null resources')

  // return a deep copy
  deployment = JSON.parse(JSON.stringify(deployment))

  deployment.elasticsearch = getResourceInfo('elasticsearch', deployment, result)
  deployment.kibana = getResourceInfo('kibana', deployment, result)
  deployment.healthy = deployment.elasticsearch.healthy && deployment.kibana.healthy
  deployment.status = [
    'elasticsearch: ',
    deployment.elasticsearch.healthy ? 'healthy' : 'unhealthy',
    ': ',
    deployment.elasticsearch.status,
    '; ',
    'kibana: ',
    deployment.kibana.healthy ? 'healthy' : 'unhealthy',
    ': ',
    deployment.kibana.status,
  ].join('')
  
  return deployment
}
  
/** @type { (key: string, deployment: Deployment, result: any) => ResourceInfo } */
function getResourceInfo(key, deployment, showDeployment) {
  /** @type { ResourceSizes } */
  let sizes
  if (key === 'elasticsearch') {
    sizes = deployment.elasticsearch.sizes
  } else if (key === 'kibana') {
    sizes = deployment.kibana.sizes
  } else {
    throw new Error(`unexpected key "${key}"`)
  }

  const allResources = (showDeployment || {}).resources || {}
  const resource = (allResources[key] || [])[0] || {}
  const info = resource.info || {}
  const metadata = info.metadata || {}
  const username = deployment.credentials.username
  const password = deployment.credentials.password
  const endpoint = metadata.endpoint
  const port = metadata.ports.https
  const url = `https://${username}:${password}@${endpoint}:${port}`

  return {
    sizes,
    healthy: (info.healthy || false) && (info.status === 'started'),
    status: info.status || 'unknown',
    url,
  }

}

/** @type { (ms: number) => Promise<void> } */
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}