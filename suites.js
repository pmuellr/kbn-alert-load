'use strict'

/** @typedef { import('./lib/types').Suite } Suite */
/** @typedef { import('./lib/types').Scenario } Scenario */

const AlertInterval = '5s'

const Versions = [
  '7.14.0',
  '7.13.3',
  '7.12.1',
  '7.11.2',
  // '7.10.2',
  // '7.9.3',
  // '7.8.1', old api version?
]
const Version = Versions[0]

const AlertsList = [10, 50, 100, 200, 400]

/** @type { Suite[] } */
const suites = module.exports = []

suites.push(...withAlerts(suiteKibanaSizes))
suites.push(...withAlerts(suiteTmMaxWorkers))
suites.push(...withAlerts(suiteTmPollInterval))
suites.push(...withAlerts(suiteVersions))
suites.push(suiteAlerts())

/** @type { ( fn: (alerts: number) => Suite) => Suite[] } */
function withAlerts(fn) {
  return AlertsList.map(alerts => fn(alerts))
}

/** @type { (alerts: number) => Suite } */
function suiteKibanaSizes(alerts) {
  const sizes = [
    { esSpec: '1 x  8 GB', kbSpec: ' 4 x 8 GB' },
    { esSpec: '1 x 16 GB', kbSpec: ' 6 x 8 GB' },
    { esSpec: '1 x 32 GB', kbSpec: ' 8 x 8 GB' },
    { esSpec: '1 x 64 GB', kbSpec: '10 x 8 GB' },
  ]

  const scenarios = sizes.map((size, index) => ({
    name: `kb: ${size.kbSpec}; es: ${size.esSpec}`,
    alertInterval: AlertInterval,
    alerts,
    esSpec: size.esSpec,
    kbSpec: size.kbSpec,
    tmMaxWorkers: 10,
    tmPollInterval: 3000,
    version: Version,
  }))

  return {
    id: `deployment-size-${alerts}`,
    description: `vary scenarios by deployment size for ${alerts} alerts`,
    scenarios,
  }
}

/** @type { (alerts: number) => Suite } */
function suiteTmMaxWorkers(alerts) {
  const tmMaxWorkersList = [ 10, 15, 20 ]

  const scenarios = tmMaxWorkersList.map((tmMaxWorkers, index) => {
    return {
      name: `tm max workers: ${tmMaxWorkers}`,
      alertInterval: AlertInterval,
      alerts,
      esSpec: '1 x 8 GB',
      kbSpec: '2 x 8 GB',
      tmMaxWorkers,
      tmPollInterval: 3000,
      version: Version,
    }
  })

  return {
    id: `tm-max-workers-${alerts}`,
    description: `vary scenarios by TM max workers for ${alerts} alerts`,
    scenarios,
  }
}

/** @type { (alerts: number) => Suite } */
function suiteTmPollInterval(alerts) {
  const tmPollIntervalList = [ 3000, 2000, 1000, 500 ]

  const scenarios = tmPollIntervalList.map((tmPollInterval, index) => {
    return {
      name: `tm poll interval: ${tmPollInterval}`,
      alertInterval: AlertInterval,
      alerts,
      esSpec: '1 x 8 GB',
      kbSpec: '2 x 8 GB',
      tmMaxWorkers: 10,
      tmPollInterval,
      version: Version,
    }
  })

  return {
    id: `tm-poll-interval-${alerts}`,
    description: `vary scenarios by TM poll interval for ${alerts} alerts`,
    scenarios,
  }
}

/** @type { (alerts: number) => Suite } */
function suiteVersions(alerts) {
  const scenarios = Versions.map((version, index) => {
    return {
      name: `stack version: ${version}`,
      alertInterval: AlertInterval,
      alerts,
      esSpec: '1 x 8 GB',
      kbSpec: '2 x 8 GB',
      tmMaxWorkers: 10,
      tmPollInterval: 3000,
      version,
    }
  })

  return {
    id: `stack-versions-${alerts}`,
    description: `vary scenarios by stack version for ${alerts} alerts`,
    scenarios,
  }
}

/** @type { () => Suite } */
function suiteAlerts() {
  const scenarios = AlertsList.slice(0, 4).map((alerts, index) => {
    return {
      name: `alerts: ${alerts}`,
      alertInterval: AlertInterval,
      alerts,
      esSpec: '1 x 8 GB',
      kbSpec: '2 x 8 GB',
      tmMaxWorkers: 10,
      tmPollInterval: 3000,
      version: Version,
    }
  })

  return {
    id: `number-of-alerts`,
    description: `vary scenarios by number of alerts`,
    scenarios,
  }
}
