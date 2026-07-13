import { saveProjectFile } from '../../utils/project-file'
import type { StoredProject } from '~/types/story'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ project?: StoredProject }>(event)

  if (!body.project) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project data is required.'
    })
  }

  return saveProjectFile(body.project)
})
