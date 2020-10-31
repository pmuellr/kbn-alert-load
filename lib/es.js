'use strict'

/** @typedef { import('./types').EventLogRecord } EventLogRecord */

const https = require('https')
const axios = require('axios').default
const logger = require('./logger')
const { retry } = require('./utils')

module.exports = {
  getEventLog,
}

const RETRY_SECONDS = 5
const RETRY_ATTEMPTS = 120

const axiosConfig = {
  headers: {
    'content-type': 'application/json',
  },
  httpsAgent: new https.Agent ({
    rejectUnauthorized: false
  })
}

const httpClient = axios.create(axiosConfig)

/** @type { (deployment: string, esUrl: string, minutes: number) => Promise<EventLogRecord[]> } */
async function getEventLog(deployment, esUrl, minutes) {

  const q = 'event.action:execute'
  const uri = `.kibana-event-log-*/_search?size=10000&sort=@timestamp&q=${q}`
  
  /** @type { any } */
  let response = {}
  await retry(RETRY_ATTEMPTS, RETRY_SECONDS, `getting event log for ${deployment}`, async () => {
    response = await httpClient.get(`${esUrl}/${uri}`)
  })

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
    const result = await getEventLog('test', url, 10)
    console.log(JSON.stringify(result, null, 4))
  } catch (err) {
    console.log('error:', err.message, err.response.data)
  }
}