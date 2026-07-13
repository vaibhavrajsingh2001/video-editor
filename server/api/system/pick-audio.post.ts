import { spawn } from 'node:child_process'
import { extname } from 'node:path'

const AUDIO_EXTENSIONS = new Set(['.aac', '.flac', '.m4a', '.mp3', '.ogg', '.wav'])

function runAudioPicker() {
  return new Promise<string>((resolve, reject) => {
    const script = 'POSIX path of (choose file with prompt "Choose a music or audio file for your story")'
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
        statusMessage: stderr.trim() || 'The audio picker could not be opened.'
      }))
    })
  })
}

export default defineEventHandler(async () => {
  if (process.platform !== 'darwin') {
    throw createError({
      statusCode: 501,
      statusMessage: 'The native audio picker is currently available on macOS only.'
    })
  }

  const path = await runAudioPicker()
  if (!path) {
    return { path: '' }
  }

  if (!AUDIO_EXTENSIONS.has(extname(path).toLowerCase())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose an MP3, M4A, AAC, WAV, FLAC, or OGG audio file.'
    })
  }

  return { path }
})
