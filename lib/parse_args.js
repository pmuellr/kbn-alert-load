'use strict'

/** @typedef { import('./types').CliArguments } CliArguments */

const meow = require('meow')
const pkg = require('../package.json')

const ENV_CONFIG_NAME = `${pkg.name.toUpperCase().replace(/-/g, '_')}_CONFIG`
const ENV_STACK_NAME = `${pkg.name.toUpperCase().replace(/-/g, '_')}_STACK`
const ENV_MINUTES_NAME = `${pkg.name.toUpperCase().replace(/-/g, '_')}_MINUTES`
const ENV_CONFIG = process.env[ENV_CONFIG_NAME]
const ENV_STACK = process.env[ENV_STACK_NAME]
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
      stack: { alias: 'S', type: 'string' },
      minutes: { alias: 'M', type: 'number' },
    }
  })

  const config = flags.config || ENV_CONFIG || 'config'
  const stack = flags.stack || ENV_STACK
  const minutes = flags.minutes || ENV_MINUTES

  const [command, ...commandArgs] = input
  return {
    command,
    commandArgs,
    config,
    stack,
    minutes,
  }
}

function getHelp () {
  return`
${pkg.name}: ${pkg.description}
v${pkg.version}

usage: ${pkg.name} <options> <cmd> <arguments>

options:
  -C --config    use the specified ecctl config in $HOME/.ecctl/[name].json
  -S --stack     version of the stack; '${pkg.name} lss' to see all versions
  -M --minutes   override the number of minutes to run the test

commands:
  run <scenarioId> run scenario with specified id
  ls               list scenarios
  lsd              list existing deployments, by name and id
  lss              list available stacks
  rmd <name>       delete existing deployments match the specified name
  rmdall           delete all existing deployments
  env              print settings given options and env vars

You may also use the following environment variables as the value of the
respective config options:

- ${ENV_CONFIG_NAME}
- ${ENV_STACK_NAME}
- ${ENV_MINUTES_NAME}
`.trim()
}