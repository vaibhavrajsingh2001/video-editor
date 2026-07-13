import { renderStory, type RenderRequest } from '../utils/render-story'

export default defineEventHandler(async (event) => {
  const body = await readBody<RenderRequest>(event)
  return renderStory(body)
})
