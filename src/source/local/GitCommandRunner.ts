import { execFile } from 'node:child_process'
import { GitSourceError } from '../types'

const DEFAULT_MAX_BUFFER_BYTES = 64 * 1024 * 1024

export interface GitCommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface GitCommandRunner {
  run(args: string[], cwd: string): Promise<GitCommandResult>
}

export class SystemGitCommandRunner implements GitCommandRunner {
  run(args: string[], cwd: string): Promise<GitCommandResult> {
    return new Promise((resolve, reject) => {
      execFile(
        'git',
        args,
        {
          cwd,
          encoding: 'utf8',
          maxBuffer: DEFAULT_MAX_BUFFER_BYTES,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          if (!error) {
            resolve({ stdout, stderr, exitCode: 0 })
            return
          }

          if (error.code === 'ENOENT') {
            reject(new GitSourceError('git-not-installed', 'Git is not installed or not on PATH.'))
            return
          }

          if (error.code === 'EACCES' || error.code === 'EPERM') {
            reject(new GitSourceError('permission-denied', 'Git could not access the repository.'))
            return
          }

          if (typeof error.code === 'number') {
            resolve({ stdout, stderr, exitCode: error.code })
            return
          }

          reject(new GitSourceError('git-command-failed', 'The Git command could not be executed.'))
        },
      )
    })
  }
}
