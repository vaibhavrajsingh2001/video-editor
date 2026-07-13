import { spawn } from 'node:child_process'
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { basename, join } from 'node:path'
import { createError } from 'h3'
import type { TransitionKind } from '~/types/story'

export interface RenderClip {
  name?: string
  video: string
  videoName: string
  start: number
  end: number
  sourceVolume?: number
  addedAudio?: {
    path?: string
    sourceType?: string
    volume?: number
  } | null
  transition: TransitionKind
}

export interface RenderRequest {
  title?: string
  sourceDirectory?: string
  estimatedDuration?: number
  audio?: {
    path?: string
    sourceType?: string
    volume?: number
  } | null
  clips?: RenderClip[]
}

export interface RenderResult {
  outputPath: string
  outputDirectory: string
  fileName: string
}

export interface RenderProgressUpdate {
  progress: number
  stage: string
}

interface FfmpegProgressOptions {
  stage: string
  from: number
  to: number
  duration?: number
  onProgress?: (update: RenderProgressUpdate) => void
}

const FFMPEG_THREAD_COUNT = '0'

function cleanTitle(title?: string) {
  return (title || 'video-story')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'video-story'
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function ffmpegThreadArgs() {
  return ['-threads', FFMPEG_THREAD_COUNT]
}

function segmentWorkerCount(totalClips: number) {
  const cpuCount = Math.max(1, availableParallelism())
  return Math.max(1, Math.min(totalClips, Math.floor(cpuCount / 2), 4))
}

function emitProgress(options: FfmpegProgressOptions, progress: number) {
  options.onProgress?.({
    progress: clampProgress(progress),
    stage: options.stage
  })
}

function parseProgressSeconds(line: string) {
  if (line.startsWith('out_time_ms=')) {
    return Number(line.replace('out_time_ms=', '')) / 1_000_000
  }

  if (line.startsWith('out_time_us=')) {
    return Number(line.replace('out_time_us=', '')) / 1_000_000
  }

  if (!line.startsWith('out_time=')) {
    return null
  }

  const [, hours = '0', minutes = '0', seconds = '0'] = line.match(/out_time=(\d+):(\d+):([\d.]+)/) ?? []
  const parsed = (Number(hours) * 3600) + (Number(minutes) * 60) + Number(seconds)
  return Number.isFinite(parsed) ? parsed : null
}

function progressFromOutput(output: string, options: FfmpegProgressOptions) {
  if (!options.duration || options.duration <= 0) {
    return
  }

  for (const line of output.split('\n')) {
    const seconds = parseProgressSeconds(line.trim())
    if (seconds === null || !Number.isFinite(seconds)) {
      continue
    }

    const ratio = Math.max(0, Math.min(1, seconds / options.duration))
    emitProgress(options, options.from + ((options.to - options.from) * ratio))
  }
}

function runFfmpeg(args: string[], options: FfmpegProgressOptions) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn('ffmpeg', ['-progress', 'pipe:1', '-nostats', ...args])
    let stdout = ''
    let stderr = ''

    emitProgress(options, options.from)

    child.stdout.on('data', (chunk: Buffer) => {
      const output = chunk.toString()
      stdout += output
      progressFromOutput(output, options)
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        emitProgress(options, options.to)
        resolve(`${stdout}\n${stderr}`)
        return
      }

      reject(createError({
        statusCode: 500,
        statusMessage: `ffmpeg failed while rendering the story. ${stderr.slice(-900)}`
      }))
    })
  })
}

function hasAudioTrack(path: string) {
  return new Promise<boolean>((resolve) => {
    const child = spawn('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_type',
      '-of',
      'csv=p=0',
      path
    ])
    let output = ''

    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })

    child.on('error', () => resolve(false))
    child.on('close', code => resolve(code === 0 && output.includes('audio')))
  })
}

function requirePathClip(clip: RenderClip) {
  const duration = clip.end - clip.start
  if (!clip.video || !Number.isFinite(clip.start) || !Number.isFinite(clip.end) || duration <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `A saved clip from ${clip.videoName || 'a video'} has invalid times.`
    })
  }
}

function fadeFilters(clip: RenderClip, nextClip?: RenderClip) {
  const duration = clip.end - clip.start
  const fadeDuration = Math.min(0.45, Math.max(0, duration / 3))
  const filters = [
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    'setsar=1',
    'format=yuv420p'
  ]

  if (clip.transition !== 'none' && fadeDuration > 0) {
    filters.push(`fade=t=in:st=0:d=${fadeDuration.toFixed(2)}`)
  }

  if (nextClip?.transition !== 'none' && fadeDuration > 0) {
    const start = Math.max(0, duration - fadeDuration)
    filters.push(`fade=t=out:st=${start.toFixed(2)}:d=${fadeDuration.toFixed(2)}`)
  }

  return filters.join(',')
}

async function segmentFfmpegArgs(clip: RenderClip, nextClip: RenderClip | undefined, duration: number, segmentPath: string) {
  const args = [
    '-y',
    '-ss',
    clip.start.toString(),
    '-t',
    duration.toString(),
    '-i',
    clip.video
  ]
  const audioLabels: string[] = []
  const filters = [`[0:v:0]${fadeFilters(clip, nextClip)}[vout]`]
  const sourceVolume = Math.max(0, Math.min(1, (clip.sourceVolume ?? 100) / 100))
  const shouldUseSourceAudio = sourceVolume > 0 && await hasAudioTrack(clip.video)
  const addedAudioPath = clip.addedAudio?.sourceType === 'path' ? clip.addedAudio.path?.trim() : ''

  if (shouldUseSourceAudio) {
    filters.push(`[0:a:0]volume=${sourceVolume.toFixed(2)},atrim=0:${duration.toFixed(2)},asetpts=PTS-STARTPTS[a0]`)
    audioLabels.push('[a0]')
  }

  if (addedAudioPath) {
    const addedInputIndex = 1
    const addedVolume = Math.max(0, Math.min(1, (clip.addedAudio?.volume ?? 35) / 100))
    args.push('-stream_loop', '-1', '-i', addedAudioPath)
    filters.push(`[${addedInputIndex}:a:0]volume=${addedVolume.toFixed(2)},atrim=0:${duration.toFixed(2)},asetpts=PTS-STARTPTS[a${addedInputIndex}]`)
    audioLabels.push(`[a${addedInputIndex}]`)
  }

  if (audioLabels.length === 0) {
    const silenceInputIndex = addedAudioPath ? 2 : 1
    args.push(
      '-f',
      'lavfi',
      '-t',
      duration.toString(),
      '-i',
      'anullsrc=channel_layout=stereo:sample_rate=48000'
    )
    filters.push(`[${silenceInputIndex}:a:0]atrim=0:${duration.toFixed(2)},asetpts=PTS-STARTPTS[aout]`)
  } else if (audioLabels.length === 1) {
    filters.push(`${audioLabels[0]}anull[aout]`)
  } else {
    filters.push(`${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=first:dropout_transition=0[aout]`)
  }

  args.push(
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[vout]',
    '-map',
    '[aout]',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    ...ffmpegThreadArgs(),
    '-fps_mode',
    'cfr',
    '-c:a',
    'aac',
    '-shortest',
    segmentPath
  )

  return args
}

function concatLine(path: string) {
  return `file '${path.replaceAll('\'', '\'\\\'\'')}'`
}

export async function renderStory(body: RenderRequest, onProgress?: (update: RenderProgressUpdate) => void): Promise<RenderResult> {
  const clips = body.clips ?? []
  const sourceDirectory = body.sourceDirectory?.trim()

  if (!sourceDirectory) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Render needs a folder loaded from a local path.'
    })
  }

  if (!clips.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Add at least one clip before rendering.'
    })
  }

  clips.forEach(requirePathClip)

  const outputDirectory = join(sourceDirectory, 'edited-output')
  const tempDirectory = join(outputDirectory, `.render-${Date.now()}`)
  await mkdir(tempDirectory, { recursive: true })

  const title = cleanTitle(body.title)
  const outputPath = join(outputDirectory, `${title}-${Date.now()}.mp4`)
  const stitchedPath = join(tempDirectory, 'stitched-muted.mp4')
  const listPath = join(tempDirectory, 'concat.txt')
  const storyDuration = clips.reduce((total, clip) => total + Math.max(0, clip.end - clip.start), 0)
  const audioPath = body.audio?.sourceType === 'path' ? body.audio.path?.trim() : ''
  const segmentProgressEnd = audioPath ? 72 : 84

  try {
    onProgress?.({ progress: 1, stage: 'Preparing edited-output folder' })

    const segmentPaths = clips.map((_, index) => join(tempDirectory, `segment-${String(index + 1).padStart(3, '0')}.mp4`))
    const segmentDurations = clips.map(clip => clip.end - clip.start)
    const segmentProgress = segmentDurations.map(() => 0)
    const workers = segmentWorkerCount(clips.length)
    let nextSegmentIndex = 0

    function emitSegmentProgress(index: number, update: RenderProgressUpdate) {
      segmentProgress[index] = Math.max(segmentProgress[index] ?? 0, Math.max(0, Math.min(1, update.progress / 100)))
      const renderedDuration = segmentProgress.reduce((total, progress, progressIndex) => {
        return total + (progress * (segmentDurations[progressIndex] ?? 0))
      }, 0)

      onProgress?.({
        progress: clampProgress(4 + ((renderedDuration / storyDuration) * (segmentProgressEnd - 4))),
        stage: update.stage
      })
    }

    async function renderNextSegment() {
      while (nextSegmentIndex < clips.length) {
        const index = nextSegmentIndex
        nextSegmentIndex += 1

        const clip = clips[index]
        const segmentPath = segmentPaths[index]
        const duration = segmentDurations[index] ?? 0
        if (!clip || !segmentPath) {
          continue
        }

        await runFfmpeg(await segmentFfmpegArgs(clip, clips[index + 1], duration, segmentPath), {
          stage: `Making clip ${index + 1} of ${clips.length}${workers > 1 ? ` (${workers} workers)` : ''}`,
          from: 0,
          to: 100,
          duration,
          onProgress: update => emitSegmentProgress(index, update)
        })
      }
    }

    await Promise.all(Array.from({ length: workers }, () => renderNextSegment()))

    onProgress?.({ progress: segmentProgressEnd, stage: 'Joining selected clips' })
    await writeFile(listPath, segmentPaths.map(concatLine).join('\n'))

    await runFfmpeg([
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c',
      'copy',
      stitchedPath
    ], {
      stage: 'Joining selected clips',
      from: segmentProgressEnd,
      to: audioPath ? 82 : 96,
      duration: storyDuration,
      onProgress
    })

    if (audioPath) {
      const volume = Math.max(0, Math.min(1, (body.audio?.volume ?? 70) / 100))
      await runFfmpeg([
        '-y',
        '-i',
        stitchedPath,
        '-stream_loop',
        '-1',
        '-i',
        audioPath,
        '-filter_complex',
        `[0:a:0]asetpts=PTS-STARTPTS[story];[1:a]volume=${volume.toFixed(2)},atrim=0:${Math.max(1, body.estimatedDuration ?? 1).toFixed(2)},asetpts=PTS-STARTPTS[music];[story][music]amix=inputs=2:duration=first:dropout_transition=0[aout]`,
        '-map',
        '0:v:0',
        '-map',
        '[aout]',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        ...ffmpegThreadArgs(),
        '-shortest',
        outputPath
      ], {
        stage: 'Adding music',
        from: 82,
        to: 98,
        duration: Math.max(1, body.estimatedDuration ?? storyDuration),
        onProgress
      })
    } else {
      onProgress?.({ progress: 97, stage: 'Saving final video' })
      await copyFile(stitchedPath, outputPath)
    }

    onProgress?.({ progress: 100, stage: 'Finished' })

    return {
      outputPath,
      outputDirectory,
      fileName: basename(outputPath)
    }
  } finally {
    await rm(tempDirectory, { recursive: true, force: true })
  }
}
