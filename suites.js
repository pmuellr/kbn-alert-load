'use strict'

/** @typedef { import('./lib/types').Suite } Suite */
/** @typedef { import('./lib/types').Scenario } Scenario */

const RuleInterval = '5s'

const Versions = [
//  '8.0.0-rc1',  // only on gcp us-west2 as of 2022-01-12
  '7.16.2',
  '7.15.2',
  '7.14.2',
  '7.13.3',
  // '7.12.1',
  // '7.11.2',
  // '7.10.2',
  // '7.9.3',
  // '7.8.1', old api version?
]
const Version = Versions[0]

const RuleCountList = [100, 200, 400, 1000, 2000, 4000]

/** @type { Suite[] } */
const suites = module.exports = []

suites.push((suiteSuperSimple()))
suites.push((suiteIntelVsArm()))
suites.push(...withRuleCount(suiteKibanaSizes))
suites.push(...withRuleCount(suiteKibanaSizes30Workers))
suites.push(...withRuleCount(suiteTmMaxWorkers))
suites.push(...withRuleCount(suiteTmPollInterval))
suites.push(...withRuleCount(suiteTmPollIntervalMaxWorkers))
suites.push(...withRuleCount(suiteVersions))
suites.push(suiteRules())

/** @type { ( fn: (ruleCount: number) => Suite) => Suite[] } */
function withRuleCount(fn) {
  return RuleCountList.map(ruleCount => fn(ruleCount))
}

/** @type { () => Suite } */
function suiteSuperSimple() {
  const size =  { 
    esSpec: '1 x 64 GB', 
    kbSpec: '1 x 8 GB' 
  }

  const scenarios = [{
    name: `kb: ${size.kbSpec}; es: ${size.esSpec}`,
    ruleInterval: RuleInterval,
    ruleCount: 10,
    esSpec: size.esSpec,
    kbSpec: size.kbSpec,
    tmMaxWorkers: 30,
    tmPollInterval: 3000,
    version: Version,
  }]

  return {
    id: `super-simple`,
    description: `super simple scenario, primarily for testing the tool itself`,
    scenarios,
  }
}

/** @type { () => Suite } */
function suiteIntelVsArm() {
  const templates = [
    'aws-general-purpose', 
    'aws-general-purpose-arm',
    // 'aws-cpu-optimized',
    // 'aws-cpu-optimized-arm',
  ]
  const kbSpecs = [
    '1 x 1 GB',
    '1 x 8 GB',
  ]

  /** @type { Scenario[] } */
  const scenarios = []
  for (const kbSpec of kbSpecs) {
    for (const template of templates) {
      scenarios.push({
        name: `${template} - ${kbSpec}`,
        ruleInterval: RuleInterval,
        ruleCount: 400,
        esSpec: '1 x 64 GB', 
        kbSpec,
        tmMaxWorkers: 30,
        tmPollInterval: 3000,
        version: Version,
        template,
      })
    }
  }
  return {
    id: `intel-vs-arm`,
    description: `vary scenarios by intel vs arm`,
    scenarios,
  }
}

/** @type { (ruleCount: number) => Suite } */
function suiteKibanaSizes30Workers(ruleCount) {
  const sizes = [
    { esSpec: '2 x 64 GB', kbSpec: ' 4 x 8 GB' },
    { esSpec: '2 x 64 GB', kbSpec: ' 8 x 8 GB' },
    { esSpec: '2 x 64 GB', kbSpec: '12 x 8 GB' },
    { esSpec: '2 x 64 GB', kbSpec: '16 x 8 GB' },
  ]

  const scenarios = sizes.map((size, index) => ({
    name: `kb: ${size.kbSpec}; es: ${size.esSpec}`,
    ruleInterval: RuleInterval,
    ruleCount,
    esSpec: size.esSpec,
    kbSpec: size.kbSpec,
    tmMaxWorkers: 30,
    tmPollInterval: 3000,
    version: Version,
  }))

  return {
    id: `deployment-size-${ruleCount}-30-workers`,
    description: `vary scenarios by deployment size for ${ruleCount} rules with 30 workers`,
    scenarios,
  }
}

/** @type { (ruleCount: number) => Suite } */
function suiteKibanaSizes(ruleCount) {
  const sizes = [
    { esSpec: '4 x 64 GB', kbSpec: ' 4 x 8 GB' },
    { esSpec: '4 x 64 GB', kbSpec: ' 8 x 8 GB' },
    { esSpec: '4 x 64 GB', kbSpec: '12 x 8 GB' },
    { esSpec: '4 x 64 GB', kbSpec: '16 x 8 GB' },
  ]

  const scenarios = sizes.map((size, index) => ({
    name: `kb: ${size.kbSpec}; es: ${size.esSpec}`,
    ruleInterval: RuleInterval,
    ruleCount,
    esSpec: size.esSpec,
    kbSpec: size.kbSpec,
    tmMaxWorkers: 10,
    tmPollInterval: 3000,
    version: Version,
  }))

  return {
    id: `deployment-size-${ruleCount}`,
    description: `vary scenarios by deployment size for ${ruleCount} rules`,
    scenarios,
  }
}

/** @type { (ruleCount: number) => Suite } */
function suiteTmMaxWorkers(ruleCount) {
  const tmMaxWorkersList = [ 10, 15, 20 ]

  const scenarios = tmMaxWorkersList.map((tmMaxWorkers, index) => {
    return {
      name: `tm max workers: ${tmMaxWorkers}`,
      ruleInterval: RuleInterval,
      ruleCount,
      esSpec: '1 x 8 GB',
      kbSpec: '2 x 8 GB',
      tmMaxWorkers,
      tmPollInterval: 3000,
      version: Version,
    }
  })

  return {
    id: `tm-max-workers-${ruleCount}`,
    description: `vary scenarios by TM max workers for ${ruleCount} rules`,
    scenarios,
  }
}

/** @type { (ruleCount: number) => Suite } */
function suiteTmPollInterval(ruleCount) {
  const tmPollIntervalList = [ 3000, 2000, 1000 ]

  const scenarios = tmPollIntervalList.map((tmPollInterval, index) => {
    return {
      name: `tm poll interval: ${tmPollInterval}`,
      ruleInterval: RuleInterval,
      ruleCount,
      esSpec: '1 x 8 GB',
      kbSpec: '2 x 8 GB',
      tmMaxWorkers: 10,
      tmPollInterval,
      version: Version,
    }
  })

  return {
    id: `tm-poll-interval-${ruleCount}`,
    description: `vary scenarios by TM poll interval for ${ruleCount} rules`,
    scenarios,
  }
}

/** @type { (ruleCount: number) => Suite } */
function suiteTmPollIntervalMaxWorkers(ruleCount) {
  const tmPollIntervalList = [ 3000, 1000 ]
  const tmMaxWorkersList = [ 10, 40 ]

  const baseScenario = {
    ruleInterval: RuleInterval,
    ruleCount,
    esSpec: '1 x 8 GB',
    kbSpec: '2 x 8 GB',
    version: Version,
  }

/** @type { Scenario[] } */
const scenarios = []
  for (const tmPollInterval of tmPollIntervalList) {
    for (const tmMaxWorkers of tmMaxWorkersList) {
      const name = `tm pi: ${tmPollInterval}; mw: ${tmMaxWorkers}`
      scenarios.push({ name, ...baseScenario, tmPollInterval, tmMaxWorkers })
    }
  }

  return {
    id: `tm-poll-interval-max-workers-${ruleCount}`,
    description: `vary scenarios by TM poll interval and max workers for ${ruleCount} rules`,
    scenarios,
  }
}

/** @type { (ruleCount: number) => Suite } */
function suiteVersions(ruleCount) {
  const scenarios = Versions.map((version, index) => {
    return {
      name: `stack version: ${version}`,
      ruleInterval: RuleInterval,
      ruleCount,
      esSpec: '1 x 8 GB',
      kbSpec: '2 x 8 GB',
      tmMaxWorkers: 10,
      tmPollInterval: 3000,
      version,
    }
  })

  return {
    id: `stack-versions-${ruleCount}`,
    description: `vary scenarios by stack version for ${ruleCount} rules`,
    scenarios,
  }
}

/** @type { () => Suite } */
function suiteRules() {
  const scenarios = RuleCountList.slice(0, 4).map((ruleCount, index) => {
    return {
      name: `rules: ${ruleCount}`,
      ruleInterval: RuleInterval,
      ruleCount,
      esSpec: '1 x 8 GB',
      kbSpec: '2 x 8 GB',
      tmMaxWorkers: 10,
      tmPollInterval: 3000,
      version: Version,
    }
  })

  return {
    id: `number-of-rules`,
    description: `vary scenarios by number of rules`,
    scenarios,
  }
}
