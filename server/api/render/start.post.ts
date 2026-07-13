import { startRenderJob } from '../../utils/render-jobs'
import type { RenderRequest } from '../../utils/render-story'

export default defineEventHandler(async (event) => {
  const body = await readBody<RenderRequest>(event)
  return startRenderJob(body)
})
