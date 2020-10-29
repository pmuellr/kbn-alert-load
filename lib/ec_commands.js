'use strict'

/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').CreateDeploymentOptions } CreateDeploymentOptions */
/** @typedef { import('./types').CreateDeploymentResult } CreateDeploymentResult */
/** @typedef { import('./types').GetDeploymentOptions } GetDeploymentOptions */
/** @typedef { import('./types').GetDeploymentResult } GetDeploymentResult */
/** @typedef { import('./types').DeleteDeploymentOptions } DeleteDeploymentOptions */

const { execFile } = require('child_process')

const pkg = require('../package.json')
const logger = require('./logger')
const { resolveable } = require('./utils')

module.exports = {
  createDeployment,
  deleteDeployment,
  getDeployment,
}

/** @type { (options: CreateDeploymentOptions) => Promise<CreateDeploymentResult> } */
async function createDeployment({ config, stack, name, deploymentName, esSize, kbSize }) {
  const args = ['deployment', 'create']
  args.push('--config', config)
  if (stack) args.push('--version', stack)
  args.push('--message', `${pkg.name}: creating deployment ${name}`)
  args.push('--output', 'json')
  args.push('--name', deploymentName)
  args.push('--es-size', `${esSize}g`)
  args.push('--kibana-size', `${kbSize}g`)

  return asCreateDeploymentResult(await ecctlRun(args))
}

/** @type { (options: GetDeploymentOptions) => Promise<GetDeploymentResult> } */
async function getDeployment({ config, name, id }) {
  const args = ['deployment', 'show', id]
  args.push('--config', config)
  args.push('--message', `${pkg.name}: getting deployment ${id} ${name}`)
  args.push('--output', 'json')

  return asGetDeploymentResult(await ecctlRun(args))
}

/** @type { (options: DeleteDeploymentOptions) => Promise<any> } */
async function deleteDeployment({ config, id, name }) {
  const args = ['deployment', 'shutdown', id]
  args.push('--config', config)
  args.push('--message', `${pkg.name}: deleting deployment ${id} ${name}`)
  args.push('--output', 'json')
  args.push('--force')

  return await ecctlRun(args)
}

/** @type { (args: string[]) => Promise<any> } */
async function ecctlRun(args) {
  const file = 'ecctl'
  const result = resolveable()
  const execOptions = {
    maxBuffer: 20 * 1000 * 1000,
    encoding: 'utf8'
  }
  const errMessagePrefix = `error running "${file} ${args.join(' ')}"`

  try {
    execFile(file, args, execOptions, (err, stdout, stderr) => {
      if (err) {
        logger.debug(`${errMessagePrefix}: stderr:\n${stderr}`)
        return result.reject(`${errMessagePrefix}: ${err}}`) 
      }

      try {
        result.resolve(JSON.parse(stdout))
      } catch (err) {
        logger.debug(`${errMessagePrefix}: error parsing JSON: ${err}:\n${stdout}`)
        return result.reject(`${errMessagePrefix}: error parsing JSON: ${err}}`) 
      }
    })
  } catch (err) {
    result.reject(`${errMessagePrefix}: ${err}}`) 
    return
  }

  return result.promise
}

/** @type { (result: any) => CreateDeploymentResult } */
function asCreateDeploymentResult(result) {
  if (result == null) throw new Error('unexpected null from create deployment')
  if (result.id == null) throw new Error('id null from create deployment')

  const id = `${result.id}`
  /** @type { any[] } */
  const resources = result.resources || []
  const esResource = resources.find(resource => resource.kind === 'elasticsearch')
  if (esResource == null) throw new Error('no elasticsearch resource from create deployment')

  const credentials = esResource.credentials || {}
  const username = credentials.username
  const password = credentials.password
  if (username == null) throw new Error('username not set from create deploymeent')
  if (password == null) throw new Error('password not set from create deployment')

  return { id, username, password }
}

/** @type { (result: any) => GetDeploymentResult } */
function asGetDeploymentResult(result) {
  if (result == null) throw new Error('unexpected null from get deployment')
  if (result.resources == null) throw new Error('unexpected null resources from get deployment')

  // return a deep copy
  const esInfo = getResourceInfo('elasticsearch', result)
  const kbInfo = getResourceInfo('kibana', result)
  const healthy = esInfo.healthy && esInfo.status === 'started' && kbInfo.healthy && kbInfo.status === 'started'
  const status = [
    `es: ${esInfo.healthy ? 'healthy' : 'unhealthy'}: ${esInfo.status}`,
    `kb: ${esInfo.healthy ? 'healthy' : 'unhealthy'}: ${kbInfo.status}`,
  ].join('; ')
  
  return {
    healthy,
    status,
    esEndpoint: esInfo.endpoint,
    esPort: esInfo.port,
    kbEndpoint: kbInfo.endpoint,
    kbPort: kbInfo.port,
    version: esInfo.version,
    zone: esInfo.zone,
  }
}
  
/** @type { (key: string, result: any) => { endpoint: string, port: number, healthy: boolean, status: string, version: string, zone: string } } */
function getResourceInfo(key, showDeployment) {
  const allResources = (showDeployment || {}).resources || {}
  const resource = (allResources[key] || [])[0] || {}

  const info = resource.info || {}
  const healthy = !!(info.healthy || false)
  const status = `${info.status || 'unknown'}`
  
  const metadata = info.metadata || {}
  const endpoint = `${metadata.endpoint}`
  const port = parseInt(metadata.ports.https, 10)

  const topology = info.topology || {}
  const instance = (topology.instances || [])[0] || {}
  const version = instance.service_version || 'unknown'
  const zone = instance.zone || 'unknown'

  return { endpoint, port, healthy, status, version, zone }
}
