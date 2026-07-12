#!/usr/bin/env node

import { assertNodeRuntime } from './runtime'
import { runCli } from './runCli'

assertNodeRuntime()
process.exitCode = await runCli(process.argv.slice(2))
