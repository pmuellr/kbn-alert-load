'use strict'

const https = require('https')
const axios = require('axios').default
const pkg = require('../package.json')

module.exports = {
  createAlert,
}

const alertTypeId = '.index-threshold'

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

/** @type { (kbUrl: string, name: string, inputIndex: string) => Promise<string> } */
async function createAlert(kbUrl, name, inputIndex) {
  /** @type {any} */
  const data = {
    enabled: true,
    name,
    alertTypeId,
    consumer: 'alerts',
    schedule: { interval: '1m' },
    throttle: '1m',
    actions: [
      // TODO: add a server log action, to generate more tasks
    ],
    params: {
      index: inputIndex,
      timeField: '@timestamp',
      aggType: 'count',
      groupBy: 'top',
      termField: 'instance',
      termSize: 10,
      timeWindowSize: '1',
      timeWindowUnit: 'm',
      thresholdComparator: '>',
      threshold: [0],
    },
  }

  const response = await httpClient.post(`${kbUrl}/api/alerts/alert`, data)
  const { id } = response.data || {}
  return id
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