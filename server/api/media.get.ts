import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'

const MIME_TYPES: Record<string, string> = {
  '.aac': 'audio/aac',
  '.avi': 'video/x-msvideo',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'video/webm'
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = typeof query.path === 'string' ? query.path : ''
  const extension = extname(path).toLowerCase()

  if (!path || !MIME_TYPES[extension]) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only local video and audio files can be previewed.'
    })
  }

  const fileStat = await stat(path).catch(() => null)
  if (!fileStat?.isFile()) {
    throw createError({
      statusCode: 404,
      statusMessage: 'That media file could not be found.'
    })
  }

  const range = event.node.req.headers.range
  setHeader(event, 'Accept-Ranges', 'bytes')
  setHeader(event, 'Content-Type', MIME_TYPES[extension])

  if (!range) {
    setHeader(event, 'Content-Length', fileStat.size)
    return sendStream(event, createReadStream(path))
  }

  const [startPart, endPart] = range.replace('bytes=', '').split('-')
  const start = Number.parseInt(startPart || '0', 10)
  const end = endPart ? Number.parseInt(endPart, 10) : fileStat.size - 1
  const safeEnd = Math.min(end, fileStat.size - 1)
  const chunkSize = safeEnd - start + 1

  if (!Number.isFinite(start) || start < 0 || start >= fileStat.size || safeEnd < start) {
    setResponseStatus(event, 416)
    setHeader(event, 'Content-Range', `bytes */${fileStat.size}`)
    return ''
  }

  setResponseStatus(event, 206)
  setHeader(event, 'Content-Range', `bytes ${start}-${safeEnd}/${fileStat.size}`)
  setHeader(event, 'Content-Length', chunkSize)

  return sendStream(event, createReadStream(path, { start, end: safeEnd }))
})
