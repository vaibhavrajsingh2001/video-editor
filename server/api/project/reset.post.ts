import { resetProjectFile } from '../../utils/project-file'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ directory?: string }>(event)
  return resetProjectFile(body.directory)
})
