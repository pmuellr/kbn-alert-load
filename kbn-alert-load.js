#!/usr/bin/env node

'use strict'

/** @typedef { import('./lib/types').CliArguments } CliArguments */

const logger = require('./lib/logger')
const commands = require('./lib/commands')
const { parseArgs } = require('./lib/parse_args')

module.exports = {
  main,
}

// @ts-ignore
if (require.main === module) main()

function main() {
  const { config, command, commandArgs } = parseArgs()
  logger.debug(`cliArguments: ${JSON.stringify({ config, command, commandArgs })}`)

  logger.log(`using config: ${config}`)

  try {
    if (command === 'run') {
      commands.run(config, commandArgs)
    } else {
      throw new Error('command is not supported')
    }
  } catch (err) {
    logger.logErrorAndExit(`error runninng "${command} ${commandArgs.join(' ')}: ${err}`)
  }
}