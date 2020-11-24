'use strict'

const https = require('https')
const axios = require('axios').default
const pkg = require('../package.json')
const { retry } = require('./utils')

module.exports = {
  createAlert,
  createAction,
  getKbStatus,
}

const alertTypeId = '.index-threshold'
const actionTypeId = '.index'

const axiosConfig = {
  headers: {
    'kbn-xsrf': `${pkg.name}@${pkg.version}`,
    'content-type': 'application/json',
  },
  httpsAgent: new https.Agent ({
    rejectUnauthorized: false
  })
}

const httpClient = axios.create(axiosConfig)

/** @type { (kbUrl: string, name: string, inputIndex: string, firing: boolean, actions: Array<{ id: string, group: string, params: any }>) => Promise<string> } */
async function createAlert(kbUrl, name, inputIndex, firing = false, actions = []) {
  /** @type {any} */
  const data = {
    enabled: true,
    name,
    alertTypeId,
    consumer: 'alerts',
    schedule: { interval: '1m' },
    actions,
    params: {
      index: '.kibana-event-log*',
      timeField: '@timestamp',
      aggType: 'count',
      groupBy: 'all',
      termSize: 5,
      timeWindowSize: 5,
      timeWindowUnit: 'm',
      thresholdComparator: firing ? '>' : '<',
      threshold: [-1],
    },
  }

  const response = await retry(120, 5, `creating alert`, async () => 
    await httpClient.post(`${kbUrl}/api/alerts/alert`, data)
  )

  const { id } = response.data || {}
  return id
}

/** @type { (kbUrl: string, name: string, outputIndex: string) => Promise<string> } */
async function createAction(kbUrl, name, outputIndex) {
  /** @type {any} */
  const data = {
    name,
    actionTypeId,
    config: {
      index: outputIndex,
      executionTimeField: '@timestamp',
    },
  }

  const response = await retry(120, 5, `creating action`, async () =>
    await httpClient.post(`${kbUrl}/api/actions/action`, data)
  )

  const { id } = response.data || {}
  return id
}

/** @type { (kbUrl: string) => Promise<any> } */
async function getKbStatus(kbUrl) {
  const response = await retry(10, 2, `getting kibana status`, async () =>
    await httpClient.get(`${kbUrl}/api/status`)
  )
  return response.data || {}
}

// @ts-ignore
if (require.main === module) test()

async function test() {
  const url = 'https://elastic:changeme@localhost:5601'
  const name = __filename
  const inputIndex = `${pkg.name}-alert-input`
  try {
    const id = await createAlert(url, name, inputIndex)
    console.log(`created alert:`, id)
  } catch (err) {
    const { status, statusText, data} = err.response
    console.log('error:', status, statusText)
    console.log(JSON.stringify(data, null, 4))
  }
}