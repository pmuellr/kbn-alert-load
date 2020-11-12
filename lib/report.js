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

/** @type { (runName: string, scenario: Scenario, deployments: Deployment[], eventLog: EventLogRecord[], kbStatus: any[], esStatus: any[]) => void } */
function generateReport(runName, scenario, deployments, eventLog, kbStatus, esStatus) {
  const { version, zone } = deployments[0]
  const reportName = `${runName}-${scenario.id}`
  const content = readTemplate()
    .replace('["%EventLog%"]', JSON.stringify(eventLog))
    .replace('["%KbStatus%"]', JSON.stringify(kbStatus))
    .replace('["%EsStatus%"]', JSON.stringify(esStatus))
    .replace(/%runName%/g, runName)
    .replace(/%reportName%/g, reportName)
    .replace(/%scenario%/g, scenario.id)
    .replace(/%alerts%/g, `${scenario.alerts}`)
    .replace(/%version%/g, `${version}`)
    .replace(/%zone%/g, `${zone}`)
    .replace(/%date%/g, `${new Date()}`)
    .replace(/%dateISO%/g, new Date().toISOString())

  const datePrefix = new Date().toISOString().substr(0,7)
  const fileName = `${datePrefix}-${reportName}.html`
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
  /** @type { Scenario } */
  const scenario = {
    id: 'testing',
    minutes: 42,
    deployments: [],
    alerts: 43,
  }

  /** @type { Deployment[] } */
  const deployments = [
    // @ts-ignore
    {
      name: 'testing report (deployment)',
      version: 'version-44',
      zone: 'zone-45',
    }
  ]

  /** @type { any } */
  let allData

  // scrape the event-log data out of an existing report, put in this file,
  // to use as the data for testing
  try {
    allData = require('../tmp/test-report-data.json')
  } catch(err) {
    logger.logErrorAndExit(`expecting a file to use in the report: <repo>/tmp/test-report-data.json: ${err}`)
  }

  const { eventLog, kbStatus, esStatus } = allData

  // @ts-ignore
  await generateReport('test', scenario, deployments, eventLog, kbStatus, esStatus)
}