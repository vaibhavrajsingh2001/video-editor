import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createError } from 'h3'
import type { StoredProject } from '~/types/story'

const PROJECT_FILE_NAME = 'video-story-project.json'

interface ProjectFileResult {
  projectPath: string
}

export interface ProjectLoadFileResult extends ProjectFileResult {
  exists: boolean
  project: StoredProject | null
}

export interface ProjectSaveFileResult extends ProjectFileResult {
  saved: boolean
}

export interface ProjectResetFileResult extends ProjectFileResult {
  reset: boolean
}

function cleanDirectory(directory?: string) {
  return directory?.trim() ?? ''
}

export function outputDirectoryPath(directory: string) {
  return join(directory, 'edited-output')
}

export function projectFilePath(directory: string) {
  return join(outputDirectoryPath(directory), PROJECT_FILE_NAME)
}

async function requireVideoDirectory(directory?: string) {
  const trimmedDirectory = cleanDirectory(directory)
  if (!trimmedDirectory) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose a folder first.'
    })
  }

  const directoryStat = await stat(trimmedDirectory).catch(() => null)
  if (!directoryStat?.isDirectory()) {
    throw createError({
      statusCode: 404,
      statusMessage: 'That folder could not be found.'
    })
  }

  return trimmedDirectory
}

function normalizeProject(project: StoredProject): StoredProject {
  return {
    ...project,
    version: 1,
    savedAt: new Date().toISOString()
  }
}

export async function loadProjectFile(directory?: string): Promise<ProjectLoadFileResult> {
  const videoDirectory = await requireVideoDirectory(directory)
  const projectPath = projectFilePath(videoDirectory)
  const rawProject = await readFile(projectPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return null
    }

    throw error
  })

  if (!rawProject) {
    return {
      exists: false,
      project: null,
      projectPath
    }
  }

  try {
    const project = JSON.parse(rawProject) as StoredProject
    return {
      exists: true,
      project,
      projectPath
    }
  } catch {
    throw createError({
      statusCode: 422,
      statusMessage: `The project file could not be read: ${projectPath}`
    })
  }
}

export async function saveProjectFile(project: StoredProject): Promise<ProjectSaveFileResult> {
  const videoDirectory = await requireVideoDirectory(project.directory)
  const outputDirectory = outputDirectoryPath(videoDirectory)
  const projectPath = projectFilePath(videoDirectory)
  const tempPath = `${projectPath}.tmp-${process.pid}-${Date.now()}`
  const normalizedProject = normalizeProject({
    ...project,
    directory: videoDirectory
  })

  await mkdir(outputDirectory, { recursive: true })
  await writeFile(tempPath, `${JSON.stringify(normalizedProject, null, 2)}\n`, 'utf8')
  await rename(tempPath, projectPath)

  return {
    saved: true,
    projectPath
  }
}

export async function resetProjectFile(directory?: string): Promise<ProjectResetFileResult> {
  const videoDirectory = await requireVideoDirectory(directory)
  const projectPath = projectFilePath(videoDirectory)

  await rm(projectPath, { force: true })

  return {
    reset: true,
    projectPath
  }
}
