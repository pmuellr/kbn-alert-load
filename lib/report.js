'use strict'

/** @typedef { import('./types').Suite } Suite */
/** @typedef { import('./types').Scenario } Scenario */
/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').EventLogRecord } EventLogRecord */
/** @typedef { import('./types').TaskManagerStats } TaskManagerStats */

const fs = require('fs')
const path = require('path')
const logger = require('./logger')

module.exports = {
  generateReport,
}

/** @type { (runName: string, suite: Suite, deployments: Deployment[], eventLog: EventLogRecord[], kbStatus: any[], esStatus: any[], kbTaskManagerStatusList: Map<string, Map<string, TaskManagerStats[]>>) => void } */
function generateReport(runName, suite, deployments, eventLog, kbStatus, esStatus, kbTaskManagerStatusList) {
  const { zone } = deployments[0]
  const reportName = `${runName}-${suite.id}`
  
  const content = readTemplate()
    .replace('"%Suite%"', JSON.stringify(suite))
    .replace('["%Deployments%"]', JSON.stringify(deployments))
    .replace('["%EventLog%"]', JSON.stringify(eventLog))
    .replace('["%KbStatus%"]', JSON.stringify(kbStatus))
    .replace('["%KbTaskManager%"]', JSON.stringify(extractTMStats(kbTaskManagerStatusList)))
    .replace('["%EsStatus%"]', JSON.stringify(esStatus))
    .replace(/%reportName%/g, reportName)
    .replace(/%zone%/g, `${zone}`)
    .replace(/%date%/g, `${new Date()}`)
    .replace(/%dateISO%/g, new Date().toISOString())

  const fileName = `${reportName}.html`
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
  const existingReportFileName = process.argv[2]
  if (existingReportFileName == null) {
    logger.logErrorAndExit('you must provide an existing report to pull the data from')
  }

  /** @type { string } */
  let existingReport
  try {
    existingReport = fs.readFileSync(existingReportFileName, 'utf8')
  } catch (err) {
    logger.logErrorAndExit(`error reading existing report "${existingReportFileName}": ${err}`)
  }

  /** @type { string[] } */
  const dataLines = []
  const existingReportLines = existingReport.split(/\n/g)
  let inData = false
  for (const line of existingReportLines) {
    if (line.trimStart() === '// data-start') {
      inData = true
      continue
    }
    if (line.trimStart() === '// data-end') {
      break
    }
    if (inData) {
      dataLines.push(line)
    }
  }
  
  const existingData = dataLines.join('\n')

  const template = readTemplate()

  /** @type { string[] } */
  const reportLines = []
  const templateLines = template.split(/\n/g)
  inData = false
  for (const line of templateLines) {
    if (line.trimStart() === '// data-start') {
      inData = true
      reportLines.push(line)
      reportLines.push(existingData)
      continue
    }
    if (line.trimStart() === '// data-end') {
      reportLines.push(line)
      inData = false
      continue
    }
    if (!inData) {
      reportLines.push(line)
    }
  }
  
  const report = reportLines.join('\n')
  const fileName = `test-report.html`
  fs.writeFileSync(fileName, report, 'utf8')
  logger.log(`generated test report ${fileName} from data in ${existingReportFileName}`)
}

/** @type { (kbTaskManagerStatusList: Map<string, Map<string, TaskManagerStats[]>>) => Record<string, Record<string, Array<{ estimatedScheduleDensity: number[], drift: number }>>> } */
function extractTMStats(kbTaskManagerStatusList){
  return Array.from(kbTaskManagerStatusList.entries())
  .reduce((scenarios, [scenarioName, tmStatsInScenario]) => {    
    // @ts-ignore
    scenarios[scenarioName] = Array.from(tmStatsInScenario.entries())
      .reduce((summary, [tmId, tmStats]) => {    
        
        // rename TM so that they're easier to track in the report
        const [randomName] = NAMES.splice(Math.round(Math.random() * 100) % NAMES.length, 1)
        // @ts-ignore
        summary[randomName] = tmStats.map(tmStat => {
          const hasAlertStats = tmStat.stats.runtime.value.execution.duration["alerting:.index-threshold"]
            && tmStat.stats.runtime.value.execution["result_frequency_percent_as_number"]["alerting:.index-threshold"]

          return ({
            id: randomName,
            uuid: tmStat.id,
            timestamp:  tmStat.timestamp,
            scenario: tmStat.scenario,
            stats: {
              configuration: {
                value: {
                  poll_interval: tmStat.stats.configuration.value.poll_interval,
                  max_workers: tmStat.stats.configuration.value.max_workers
                }
              },
              runtime: {
                value: {
                  drift: tmStat.stats.runtime.value.drift,
                  duration: hasAlertStats
                    ? tmStat.stats.runtime.value.execution.duration["alerting:.index-threshold"] : {},
                  result: hasAlertStats
                    ? {
                      Success: tmStat.stats.runtime.value.execution["result_frequency_percent_as_number"]["alerting:.index-threshold"].Success,
                      RetryScheduled: tmStat.stats.runtime.value.execution["result_frequency_percent_as_number"]["alerting:.index-threshold"].RetryScheduled,
                      Failed: tmStat.stats.runtime.value.execution["result_frequency_percent_as_number"]["alerting:.index-threshold"].Failed
                  } : {},
                  polling:  {
                    lastSuccessfulPoll: tmStat.stats.runtime.value.polling["last_successful_poll"],
                    lastPollingDelay: tmStat.stats.runtime.value.polling["last_polling_delay"],
                    duration: tmStat.stats.runtime.value.polling["duration"],
                    claimConflicts: tmStat.stats.runtime.value.polling["claim_conflicts"],
                    claimMismatches: tmStat.stats.runtime.value.polling["claim_mismatches"],
                    results: tmStat.stats.runtime.value.polling["result_frequency_percent_as_number"]
                  },
                }
              },
              workload: {
                timestamp: tmStat.stats.workload.timestamp,
                value: {
                  estimated_schedule_density: tmStat.stats.workload.value.estimated_schedule_density
                }
              }
            }
          })
        });
        return summary
      },
      {})
    return scenarios
  },
  {})
}


const NAMES = [
  'Aurora',
  'Blizzard',
  'Cyclone',
  'Duststorm',
  'Fogbank',
  'Gust',
  'Hurricane',
  'Ice Storm',
  'Jet Stream',
  'Lightning',
  'Monsoon',
  'Rainbow',
  'Seabreeze',
  'Tornado',
  'Thunder',
  'Twister',
  'Typhoon',
  'Updraft',
  'Vortex',
  'Waterspout',
  'Whirlwind',
  'Archimedes',
  'Aristotle',
  'Confucius',
  'Copernicus',
  'Curie',
  'da Vinci',
  'Darwin',
  'Descartes',
  'Edison',
  'Einstein',
  'Epicurus',
  'Freud',
  'Galileo',
  'Hawking',
  'Machiavelli',
  'Marx',
  'Newton',
  'Pascal',
  'Pasteur',
  'Plato',
  'Sagan',
  'Socrates',
  'Tesla',
  'Voltaire'
];