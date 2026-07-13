import { renderStory, type RenderRequest, type RenderResult } from './render-story'

export type RenderJobState = 'queued' | 'running' | 'complete' | 'error'

export interface RenderJobStatus {
  id: string
  state: RenderJobState
  progress: number
  stage: string
  outputPath?: string
  outputDirectory?: string
  fileName?: string
  error?: string
  createdAt: string
  updatedAt: string
}

interface RenderJobRecord extends RenderJobStatus {
  result?: RenderResult
}

const jobs = new Map<string, RenderJobRecord>()
const maxJobAgeMs = 60 * 60 * 1000

function makeJobId() {
  return `render-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function cleanupOldJobs() {
  const now = Date.now()

  for (const [id, job] of jobs) {
    if (now - Date.parse(job.updatedAt) > maxJobAgeMs) {
      jobs.delete(id)
    }
  }
}

function publicStatus(job: RenderJobRecord): RenderJobStatus {
  return {
    id: job.id,
    state: job.state,
    progress: job.progress,
    stage: job.stage,
    outputPath: job.outputPath,
    outputDirectory: job.outputDirectory,
    fileName: job.fileName,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  }
}

function updateJob(id: string, patch: Partial<RenderJobRecord>) {
  const job = jobs.get(id)
  if (!job) {
    return
  }

  jobs.set(id, {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString()
  })
}

export function startRenderJob(request: RenderRequest) {
  cleanupOldJobs()

  const now = new Date().toISOString()
  const id = makeJobId()
  const job: RenderJobRecord = {
    id,
    state: 'queued',
    progress: 0,
    stage: 'Queued',
    createdAt: now,
    updatedAt: now
  }

  jobs.set(id, job)

  void renderStory(request, (update) => {
    updateJob(id, {
      state: 'running',
      progress: update.progress,
      stage: update.stage
    })
  }).then((result) => {
    updateJob(id, {
      state: 'complete',
      progress: 100,
      stage: 'Finished',
      outputPath: result.outputPath,
      outputDirectory: result.outputDirectory,
      fileName: result.fileName,
      result
    })
  }).catch((error: unknown) => {
    updateJob(id, {
      state: 'error',
      progress: 0,
      stage: 'Render failed',
      error: error instanceof Error ? error.message : 'The video could not be rendered.'
    })
  })

  return publicStatus(job)
}

export function getRenderJobStatus(id: string) {
  cleanupOldJobs()
  const job = jobs.get(id)
  return job ? publicStatus(job) : null
}
