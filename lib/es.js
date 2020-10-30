'use strict'

/** @typedef { import('./types').EventLogRecord } EventLogRecord */

const https = require('https')
const axios = require('axios').default
const logger = require('./logger')

module.exports = {
  getEventLog,
}

const axiosConfig = {
  headers: {
    'content-type': 'application/json',
  },
  httpsAgent: new https.Agent ({
    rejectUnauthorized: false
  })
}

const httpClient = axios.create(axiosConfig)

/** @type { (deployment: string, esUrl: string) => Promise<EventLogRecord[]> } */
async function getEventLog(deployment, esUrl) {

  const q = 'event.action:execute'
  const uri = `.kibana-event-log-*/_search?size=10000&sort=@timestamp&q=${q}`
  const response = await httpClient.get(`${esUrl}/${uri}`)

  /** @type { any[] } */
  const docs = response.data.hits.hits
  return docs.map(doc => {
    const _source = doc._source || {}
    const event = _source.event || {}
    return {
      deployment,
      provider: event.provider || 'unknown',
      date: event.start || new Date().toISOString(),
      duration: Math.round((event.duration || 0) / 1000 / 1000),
      outcome: event.outcome,
    }
  })
}

// @ts-ignore
if (require.main === module) test()

async function test() {
  const url = process.argv[2]
  if (url == null) logger.logErrorAndExit('expecting es url argument')
  try {
    const result = await getEventLog('test', url)
    console.log(JSON.stringify(result, null, 4))
  } catch (err) {
    console.log('error:', err.message, err.response.data)
  }
}