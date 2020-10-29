'use strict'

/** @typedef { import('./types').Scenario } Scenario */
/** @typedef { import('./types').Deployment } Deployment */
/** @typedef { import('./types').EventLogRecord } EventLogRecord */

const fs = require('fs')
const logger = require('./logger')

module.exports = {
  generateReport,
}

/** @type { (runName: string, scenario: Scenario, deployments: Deployment[], eventLog: EventLogRecord[]) => void } */
function generateReport(runName, scenario, deployments, eventLog) {
  const fileName = `${runName}.html`
  const content = template.replace('%EventLog%', JSON.stringify(eventLog, null, 4))
  fs.writeFileSync(fileName, content, 'utf8')
  logger.log(`generated report ${fileName}`)
}

const template = `
<html>
Hello, world!
<script>
const EventLog = %EventLog%
</script>
</html>
`.trim()

// @ts-ignore
if (require.main === module) test()

async function test() {
  // @ts-ignore
  await generateReport('test', {}, [], [], )
}