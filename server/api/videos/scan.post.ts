import { createHash } from 'node:crypto'
import { opendir, stat } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import type { VideoItem } from '~/types/story'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv'])
const MAX_VIDEOS = 1500

function videoId(path: string) {
  return createHash('sha1').update(path).digest('hex').slice(0, 16)
}

async function collectVideos(directory: string) {
  const videos: VideoItem[] = []
  const pending = [directory]

  while (pending.length > 0 && videos.length < MAX_VIDEOS) {
    const currentDirectory = pending.shift()
    if (!currentDirectory) {
      continue
    }

    const dir = await opendir(currentDirectory)

    for await (const entry of dir) {
      const path = join(currentDirectory, entry.name)

      if (entry.isDirectory()) {
        if (entry.name === 'edited-output') {
          continue
        }

        pending.push(path)
        continue
      }

      if (!entry.isFile() || !VIDEO_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        continue
      }

      const fileStat = await stat(path)
      videos.push({
        id: videoId(path),
        name: entry.name,
        path,
        relativePath: relative(directory, path),
        src: `/api/media?path=${encodeURIComponent(path)}`,
        size: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
        sourceType: 'path'
      })

      if (videos.length >= MAX_VIDEOS) {
        break
      }
    }
  }

  return videos.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true }))
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ directory?: string }>(event)
  const directory = body.directory?.trim()

  if (!directory) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose a folder first.'
    })
  }

  const directoryStat = await stat(directory).catch(() => null)
  if (!directoryStat?.isDirectory()) {
    throw createError({
      statusCode: 404,
      statusMessage: 'That folder could not be found.'
    })
  }

  return {
    directory,
    videos: await collectVideos(directory)
  }
})
