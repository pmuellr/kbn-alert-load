'use strict'

/** @typedef { import('./types').EventLogRecord } EventLogRecord */

const { Client } = require('@elastic/elasticsearch')

const logger = require('./logger')

module.exports = {
  getEventLog,
}

/** @type { (deployment: string, esUrl: string, batchSize: number) => Promise<EventLogRecord[]> } */
async function getEventLog(deployment, esUrl, batchSize = 10000) {
  const esClient = new Client({
    node: esUrl,
    maxRetries: 5,
    requestTimeout: 120000,
    sniffOnStart: true,
    ssl: {
      rejectUnauthorized: false,
    }
  })
  
  const scroll = '10m'

  logger.debug(`es.getEventLog: getting first batch of ${batchSize}`)
  let result = await esClient.search({
    index: '.kibana-event-log-*',
    size: batchSize,
    sort: '@timestamp',
    scroll,
    body: {
      query: {
        match: {
          'event.action': 'execute'
        }
      }
    }      
  })

  /** @type { any[] } */
  let hits = result.body.hits.hits
  let docs = hits
  let scroll_id = result.body._scroll_id

  while (scroll_id && hits.length !== 0) {
    logger.debug(`es.getEventLog: getting next batch of ${batchSize}`)
    result = await esClient.scroll({
      scroll,
      scroll_id,
    })

    hits = result.body.hits.hits
    docs = docs.concat(hits)
    scroll_id = result.body._scroll_id
  }

  return docs.map(doc => {
    const _source = doc._source || {}
    const event = _source.event || {}
    const kibana = _source.kibana || {}
    const savedObjects = kibana.saved_objects || []

    let alert
    let action
    for (const { type, id } of savedObjects) {
      if (type === 'alert') alert = { alert: `${id}` }
      if (type === 'action') action = { action: `${id}` }
    }

    return {
      deployment,
      provider: event.provider || 'unknown',
      date: event.start || new Date().toISOString(),
      duration: Math.round((event.duration || 0) / 1000 / 1000),
      outcome: event.outcome,
      ...alert,
      ...action
    }
  })
}

// @ts-ignore
if (require.main === module) test()

async function test() {
  const url = process.argv[2] || 'https://elastic:changeme@localhost:9200'
  if (url == null) logger.logErrorAndExit('expecting es url argument')
  try {
    const result = await getEventLog('test', url, 100)
    console.log(JSON.stringify(result, null, 4))
  } catch (err) {
    console.log('error:', err.message, err.response.data)
  }
}