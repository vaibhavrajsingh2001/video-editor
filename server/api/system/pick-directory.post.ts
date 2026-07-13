import { spawn } from 'node:child_process'

function runFolderPicker() {
  return new Promise<string>((resolve, reject) => {
    const script = 'POSIX path of (choose folder with prompt "Choose the folder that contains your videos")'
    const child = spawn('osascript', ['-e', script])
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(stdout.trim())
        return
      }

      if (stderr.includes('User canceled')) {
        resolve('')
        return
      }

      reject(createError({
        statusCode: 500,
        statusMessage: stderr.trim() || 'The folder picker could not be opened.'
      }))
    })
  })
}

export default defineEventHandler(async () => {
  if (process.platform !== 'darwin') {
    throw createError({
      statusCode: 501,
      statusMessage: 'The native folder picker is currently available on macOS only.'
    })
  }

  return {
    directory: await runFolderPicker()
  }
})
