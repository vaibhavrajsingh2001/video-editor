export type MediaSourceType = 'path' | 'file'

export interface VideoItem {
  id: string
  name: string
  path: string
  relativePath: string
  src: string
  size: number
  modifiedAt?: string
  duration?: number
  sourceType: MediaSourceType
}

export interface ClipItem {
  id: string
  name: string
  videoId: string
  videoName: string
  videoPath: string
  sourceType: MediaSourceType
  src: string
  start: number
  end: number
  note: string
  sourceVolume: number
  addedAudio: StoryAudio | null
  transition: TransitionKind
}

export type TransitionKind = 'none' | 'fade' | 'crossfade' | 'dip' | 'wipe'

export interface StoryAudio {
  name: string
  path: string
  src: string
  sourceType: MediaSourceType
  volume: number
}

export interface ScanResponse {
  directory: string
  videos: VideoItem[]
}

export interface StoredProject {
  version: 1
  directory: string
  videos: VideoItem[]
  activeVideoId: string
  clips: ClipItem[]
  draftStart: number
  draftEnd: number
  clipNote: string
  audio: StoryAudio | null
  storyTitle: string
  savedAt: string
}

export interface ProjectLoadResponse {
  exists: boolean
  project: StoredProject | null
  projectPath: string
}

export interface ProjectSaveResponse {
  saved: boolean
  projectPath: string
}

export interface ProjectResetResponse {
  reset: boolean
  projectPath: string
}

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
