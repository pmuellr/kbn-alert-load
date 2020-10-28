'use strict'

/** @typedef { import('./types').CliArguments } CliArguments */

const meow = require('meow')

const pkg = require('../package.json')
const logger = require('./logger')

const ENV_CONFIG_NAME = `${pkg.name.toUpperCase().replace(/-/g, '_')}_CONFIG`
const ENV_STACK_NAME = `${pkg.name.toUpperCase().replace(/-/g, '_')}_STACK`
const ENV_CONFIG = process.env[ENV_CONFIG_NAME]
const ENV_STACK = process.env[ENV_STACK_NAME]

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
    }
  })

  const config = flags.config || ENV_CONFIG || 'config'
  const stack = flags.stack || ENV_STACK

  const [command, ...commandArgs] = input
  return {
    command,
    commandArgs,
    config,
    stack,
  }
}

function getHelp () {
  return`
${pkg.name}: ${pkg.description}
v${pkg.version}

usage: ${pkg.name} <options> <cmd> <arguments>

options:
  -C --config    use the specified ecctl config in $HOME/.ecctl/[name].json
  -S --stack     version of the stack; 'ecctl stack list' to see all versions

commands:
  run <scenario> <machines>     run scenario on machines
  info                          list scenarios and machines

You may also use the following environment variables as the value of the
respective config options:

- ${ENV_CONFIG_NAME}
- ${ENV_STACK_NAME}
`.trim()
}