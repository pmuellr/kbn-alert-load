'use strict'

/** @typedef { import('./types').Scenario } Scenario */
/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').EventLogRecord } EventLogRecord */

const fs = require('fs')
const path = require('path')
const logger = require('./logger')

module.exports = {
  generateReport,
}

/** @type { (runName: string, scenario: Scenario, deployments: Deployment[], eventLog: EventLogRecord[]) => void } */
function generateReport(runName, scenario, deployments, eventLog) {
  const content = readTemplate()
    .replace('["%EventLog%"]', JSON.stringify(eventLog, null, 4))
    .replace(/%runName%/g, runName)
    .replace(/%alerts%/g, `${scenario.alerts}`)

  const fileName = `${runName}.html`
  fs.writeFileSync(fileName, content, 'utf8')
  logger.log(`${new Date().toISOString()}: generated report ${fileName}`)
}

/** @type { () => string } */
function readTemplate() {
  const fileName = path.join(`${__dirname}`, 'report-template.html')
  return fs.readFileSync(fileName, 'utf8')
}

// @ts-ignore
if (require.main === module) test()

// to re-run on changes:
//    nodemon -w ../lib/report.js -w ../lib/report-template.html node ../lib/report.js
async function test() {
  let eventLog

  /** @type { Scenario } */
  const scenario = {
    id: 'testing report (scenario)',
    minutes: 42,
    deployments: [],
    alerts: 43,
  }

  /** @type { Deployment[] } */
  const deployments = [
    // @ts-ignore
    {
      name: 'testing report (deployment)',
      version: 'version-42',
      zone: 'zone-42',
    }
  ]

  // scrape the event-log data out of an existing report, put in this file,
  // to use as the data for testing
  try {
    eventLog = require('../tmp/event-log.json')
  } catch(err) {
    logger.logErrorAndExit('expecting a file to use in the report: <repo>/tmp/event-log.json')
  }

  // @ts-ignore
  await generateReport('test', scenario, deployments, eventLog)
}