import { getRenderJobStatus } from '../../utils/render-jobs'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const id = typeof query.id === 'string' ? query.id : ''

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Render job id is required.'
    })
  }

  const job = getRenderJobStatus(id)
  if (!job) {
    throw createError({
      statusCode: 404,
      statusMessage: 'That render job could not be found.'
    })
  }

  return job
})
