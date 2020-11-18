'use strict'

/** @typedef { import('./types').CliArguments } CliArguments */

const meow = require('meow')
const pkg = require('../package.json')

const DEFAULT_CONFIG = 'config'
const DEFAULT_MINUTES = 10

const ENV_CONFIG_NAME = `${pkg.name.toUpperCase().replace(/-/g, '_')}_CONFIG`
const ENV_MINUTES_NAME = `${pkg.name.toUpperCase().replace(/-/g, '_')}_MINUTES`

const ENV_CONFIG = process.env[ENV_CONFIG_NAME]
const ENV_MINUTES = parseInt(process.env[ENV_MINUTES_NAME], 10) || undefined

const help = getHelp()

module.exports = {
  parseArgs,
  help,
}

/** @type { () => CliArguments } */
function parseArgs() {
  const { input, flags } = meow({
    pkg,
    help,
    flags: {
      config: { alias: 'C', type: 'string' },
      minutes: { alias: 'M', type: 'number' },
    }
  })

  const config = flags.config || ENV_CONFIG || DEFAULT_CONFIG
  const minutes = flags.minutes || ENV_MINUTES || DEFAULT_MINUTES

  const [command, ...commandArgs] = input
  return {
    command,
    commandArgs,
    config,
    minutes,
  }
}

function getHelp () {
  return`
${pkg.name}: ${pkg.description}
v${pkg.version}

usage: ${pkg.name} <options> <cmd> <arguments>

options:
  -C --config    use the specified ecctl config in $HOME/.ecctl/[name].json (default: ${DEFAULT_CONFIG})
  -M --minutes   override the number of minutes to run the test  (default: ${DEFAULT_MINUTES})

commands:
  run <scenarioId> run scenario with specified id
  ls               list suites
  lsv              list suites verbosely
  lsd              list existing deployments, by name and id
  rmd <name>       delete existing deployments match the specified name
  rmdall           delete all existing deployments
  env              print settings given options and env vars

You may also use the following environment variables as the value of the
respective config options:

- ${ENV_CONFIG_NAME}
- ${ENV_MINUTES_NAME}
`.trim()
}