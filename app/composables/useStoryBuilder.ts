import type {
  ClipItem,
  ProjectLoadResponse,
  ProjectResetResponse,
  ProjectSaveResponse,
  ScanResponse,
  StoredProject,
  StoryAudio,
  TransitionKind,
  VideoItem
} from '~/types/story'

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv']
const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg']
const LEGACY_PROJECT_STORAGE_KEY = 'video-story-builder:current-project:v1'
const LAST_DIRECTORY_STORAGE_KEY = 'video-story-builder:last-directory:v1'
const PROJECT_SAVE_DELAY_MS = 600

function makeId(prefix: string) {
  if (import.meta.client && globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function formatTime(value?: number) {
  if (!Number.isFinite(value)) {
    return '0:00'
  }

  const safeValue = Math.max(0, Math.floor(value ?? 0))
  const hours = Math.floor(safeValue / 3600)
  const minutes = Math.floor((safeValue % 3600) / 60)
  const seconds = safeValue % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function isVideoFile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return Boolean(ext && VIDEO_EXTENSIONS.includes(ext))
}

function isAudioFile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return Boolean(ext && AUDIO_EXTENSIONS.includes(ext))
}

function mediaPathSrc(path: string) {
  return `/api/media?path=${encodeURIComponent(path)}`
}

function withAudioSrc(audio: StoryAudio | null) {
  if (!audio || audio.sourceType !== 'path') {
    return null
  }

  return {
    ...audio,
    src: mediaPathSrc(audio.path)
  }
}

function withVideoSrc(video: VideoItem) {
  if (video.sourceType !== 'path') {
    return video
  }

  return {
    ...video,
    src: mediaPathSrc(video.path)
  }
}

function withClipMediaSrc(clip: ClipItem) {
  return {
    ...clip,
    name: clip.name || clip.note || clip.videoName,
    src: clip.sourceType === 'path' ? mediaPathSrc(clip.videoPath) : clip.src,
    addedAudio: withAudioSrc(clip.addedAudio)
  }
}

export function useStoryBuilder() {
  const directory = shallowRef('')
  const loadedDirectory = shallowRef('')
  const videos = ref<VideoItem[]>([])
  const activeVideoId = shallowRef('')
  const clips = ref<ClipItem[]>([])
  const loading = shallowRef(false)
  const error = shallowRef('')
  const draftStart = shallowRef(0)
  const draftEnd = shallowRef(0)
  const clipNote = shallowRef('')
  const audio = shallowRef<StoryAudio | null>(null)
  const storyTitle = shallowRef('My video story')
  const objectUrls = new Set<string>()
  const restoringProject = shallowRef(false)
  let projectSaveTimer: ReturnType<typeof setTimeout> | null = null

  const activeVideo = computed(() => videos.value.find(video => video.id === activeVideoId.value) ?? videos.value[0])
  const clipCount = computed(() => clips.value.length)
  const clipCountsByVideoId = computed<Record<string, number>>(() => {
    return clips.value.reduce<Record<string, number>>((counts, clip) => {
      counts[clip.videoId] = (counts[clip.videoId] ?? 0) + 1
      return counts
    }, {})
  })
  const storyDuration = computed(() =>
    clips.value.reduce((total, clip) => total + Math.max(0, clip.end - clip.start), 0)
  )
  const canAddClip = computed(() => Boolean(activeVideo.value && draftEnd.value > draftStart.value))
  const canCheckout = computed(() => clips.value.length > 0)
  const canRender = computed(() =>
    clips.value.length > 0
    && clips.value.every(clip => clip.sourceType === 'path')
    && clips.value.every(clip => !clip.addedAudio || clip.addedAudio.sourceType === 'path')
    && (!audio.value || audio.value.sourceType === 'path')
    && loadedDirectory.value.startsWith('/')
  )

  const transitionItems: { label: string, value: TransitionKind, icon: string }[] = [
    { label: 'Cut', value: 'none', icon: 'i-lucide-scissors' },
    { label: 'Soft fade', value: 'fade', icon: 'i-lucide-sunset' },
    { label: 'Blend', value: 'crossfade', icon: 'i-lucide-blend' },
    { label: 'Glow dip', value: 'dip', icon: 'i-lucide-sparkles' },
    { label: 'Slide', value: 'wipe', icon: 'i-lucide-panels-top-left' }
  ]

  const manifest = computed(() => ({
    title: storyTitle.value,
    createdAt: new Date().toISOString(),
    sourceDirectory: loadedDirectory.value || directory.value,
    estimatedDuration: storyDuration.value,
    audio: audio.value,
    clips: clips.value.map((clip, index) => ({
      order: index + 1,
      video: clip.videoPath,
      videoName: clip.videoName,
      start: clip.start,
      end: clip.end,
      duration: Math.max(0, clip.end - clip.start),
      sourceVolume: clip.sourceVolume,
      addedAudio: clip.addedAudio,
      transition: clip.transition,
      name: clip.name,
      note: clip.note
    }))
  }))

  const savedProject = computed<StoredProject>(() => ({
    version: 1,
    directory: loadedDirectory.value,
    videos: videos.value
      .filter(video => video.sourceType === 'path')
      .map(withVideoSrc),
    activeVideoId: activeVideoId.value,
    clips: clips.value
      .filter(clip => clip.sourceType === 'path')
      .map(withClipMediaSrc),
    draftStart: draftStart.value,
    draftEnd: draftEnd.value,
    clipNote: clipNote.value,
    audio: withAudioSrc(audio.value),
    storyTitle: storyTitle.value,
    savedAt: new Date().toISOString()
  }))

  function pathVideos(projectVideos: VideoItem[] = []) {
    return projectVideos
      .filter(video => video.sourceType === 'path')
      .map(withVideoSrc)
  }

  function mergeScannedVideosWithProject(scannedVideos: VideoItem[], projectVideos: VideoItem[] = []) {
    const projectVideoByPath = new Map(pathVideos(projectVideos).map(video => [video.path, video]))
    return scannedVideos.map((video) => {
      const savedVideo = projectVideoByPath.get(video.path)
      return {
        ...video,
        duration: savedVideo?.duration ?? video.duration
      }
    })
  }

  function rememberLastDirectory(projectDirectory: string) {
    if (import.meta.client && projectDirectory) {
      localStorage.setItem(LAST_DIRECTORY_STORAGE_KEY, projectDirectory)
    }
  }

  function forgetLastDirectory() {
    if (import.meta.client) {
      localStorage.removeItem(LAST_DIRECTORY_STORAGE_KEY)
    }
  }

  async function replaceProjectState(applyState: () => void) {
    restoringProject.value = true
    try {
      applyState()
      await nextTick()
    } finally {
      restoringProject.value = false
    }
  }

  async function applyFreshProject(projectDirectory: string, scannedVideos: VideoItem[]) {
    await replaceProjectState(() => {
      directory.value = projectDirectory
      loadedDirectory.value = projectDirectory
      videos.value = scannedVideos
      activeVideoId.value = scannedVideos[0]?.id ?? ''
      clips.value = []
      draftStart.value = 0
      draftEnd.value = 0
      clipNote.value = ''
      audio.value = null
      storyTitle.value = 'My video story'
    })
  }

  async function applyStoredProject(project: Partial<StoredProject>, projectDirectory: string, scannedVideos: VideoItem[] = []) {
    const nextVideos = scannedVideos.length
      ? mergeScannedVideosWithProject(scannedVideos, project.videos)
      : pathVideos(project.videos)
    const nextClips = (project.clips ?? [])
      .filter(clip => clip.sourceType === 'path')
      .map(withClipMediaSrc)
    const nextActiveVideoId = project.activeVideoId && nextVideos.some(video => video.id === project.activeVideoId)
      ? project.activeVideoId
      : nextVideos[0]?.id ?? ''

    await replaceProjectState(() => {
      directory.value = projectDirectory
      loadedDirectory.value = projectDirectory
      videos.value = nextVideos
      activeVideoId.value = nextActiveVideoId
      clips.value = nextClips
      draftStart.value = Number.isFinite(project.draftStart) ? Number(project.draftStart) : 0
      draftEnd.value = Number.isFinite(project.draftEnd) ? Number(project.draftEnd) : 0
      clipNote.value = project.clipNote ?? ''
      audio.value = withAudioSrc(project.audio ?? null)
      storyTitle.value = project.storyTitle || 'My video story'
    })
  }

  async function loadProjectForDirectory(projectDirectory: string, scannedVideos: VideoItem[]) {
    const projectResponse = await $fetch<ProjectLoadResponse>('/api/project/load', {
      method: 'POST',
      body: { directory: projectDirectory }
    })

    if (projectResponse.exists && projectResponse.project) {
      await applyStoredProject(projectResponse.project, projectDirectory, scannedVideos)
    } else {
      await applyFreshProject(projectDirectory, scannedVideos)
    }

    rememberLastDirectory(projectDirectory)
    queuePersistProject()
  }

  function selectVideo(videoId: string) {
    activeVideoId.value = videoId
    draftStart.value = 0
    draftEnd.value = videos.value.find(video => video.id === videoId)?.duration ?? 0
    clipNote.value = ''
  }

  function updateActiveDuration(duration: number) {
    if (!activeVideo.value || !Number.isFinite(duration)) {
      return
    }

    const video = videos.value.find(item => item.id === activeVideo.value?.id)
    if (video) {
      video.duration = duration
    }

    if (draftEnd.value <= draftStart.value) {
      draftEnd.value = duration
    }
  }

  async function scanDirectory() {
    const trimmedDirectory = directory.value.trim()
    if (!trimmedDirectory) {
      error.value = 'Choose a folder first.'
      return
    }

    loading.value = true
    error.value = ''

    try {
      const response = await $fetch<ScanResponse>('/api/videos/scan', {
        method: 'POST',
        body: { directory: trimmedDirectory }
      })

      await loadProjectForDirectory(response.directory, response.videos)
    } catch (scanError) {
      error.value = scanError instanceof Error ? scanError.message : 'The folder could not be scanned.'
    } finally {
      loading.value = false
    }
  }

  async function pickDirectory() {
    loading.value = true
    error.value = ''

    try {
      const response = await $fetch<{ directory: string }>('/api/system/pick-directory', {
        method: 'POST'
      })

      if (!response.directory) {
        return
      }

      directory.value = response.directory
      await scanDirectory()
    } catch (pickError) {
      error.value = pickError instanceof Error ? pickError.message : 'The folder picker could not be opened.'
    } finally {
      loading.value = false
    }
  }

  function loadBrowserFiles(fileList: FileList | File[]) {
    error.value = ''

    const files = Array.from(fileList).filter(isVideoFile)
    const nextVideos = files.map((file) => {
      const src = URL.createObjectURL(file)
      objectUrls.add(src)

      return {
        id: makeId('video'),
        name: file.name,
        path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        src,
        size: file.size,
        modifiedAt: new Date(file.lastModified).toISOString(),
        sourceType: 'file' as const
      }
    })

    videos.value = nextVideos
    directory.value = nextVideos[0]?.relativePath.split('/').slice(0, -1).join('/') ?? ''
    loadedDirectory.value = ''
    activeVideoId.value = nextVideos[0]?.id ?? ''
    draftStart.value = 0
    draftEnd.value = 0
  }

  function setDraftFromCurrentTime(kind: 'start' | 'end', currentTime: number) {
    if (kind === 'start') {
      draftStart.value = Math.max(0, currentTime)
      if (draftEnd.value <= draftStart.value) {
        draftEnd.value = Math.min(activeVideo.value?.duration ?? draftStart.value + 5, draftStart.value + 5)
      }
      return
    }

    draftEnd.value = Math.max(draftStart.value + 0.25, currentTime)
  }

  function addClip() {
    const video = activeVideo.value
    if (!video || !canAddClip.value) {
      return
    }

    const clipName = clipNote.value.trim() || `Clip ${clips.value.length + 1}`

    clips.value.push({
      id: makeId('clip'),
      name: clipName,
      videoId: video.id,
      videoName: video.name,
      videoPath: video.path,
      sourceType: video.sourceType,
      src: video.src,
      start: Number(draftStart.value.toFixed(2)),
      end: Number(draftEnd.value.toFixed(2)),
      note: clipNote.value.trim(),
      sourceVolume: 100,
      addedAudio: null,
      transition: clips.value.length === 0 ? 'none' : 'fade'
    })

    clipNote.value = ''
  }

  function updateClipName(clipId: string, name: string) {
    const clip = clips.value.find(item => item.id === clipId)
    if (clip) {
      clip.name = name
    }
  }

  function removeClip(clipId: string) {
    clips.value = clips.value.filter(clip => clip.id !== clipId)
  }

  function moveClip(clipId: string, direction: -1 | 1) {
    const index = clips.value.findIndex(clip => clip.id === clipId)
    const nextIndex = index + direction

    if (index < 0 || nextIndex < 0 || nextIndex >= clips.value.length) {
      return
    }

    const nextClips = [...clips.value]
    const [clip] = nextClips.splice(index, 1)
    if (!clip) {
      return
    }

    nextClips.splice(nextIndex, 0, clip)
    clips.value = nextClips
  }

  function updateClipTransition(clipId: string, transition: TransitionKind) {
    const clip = clips.value.find(item => item.id === clipId)
    if (clip) {
      clip.transition = transition
    }
  }

  function updateClipSourceVolume(clipId: string, volume: number) {
    const clip = clips.value.find(item => item.id === clipId)
    if (clip) {
      clip.sourceVolume = Math.max(0, Math.min(100, volume))
    }
  }

  function setClipAddedAudioPath(clipId: string, path: string) {
    const clip = clips.value.find(item => item.id === clipId)
    if (!clip) {
      return
    }

    const trimmedPath = path.trim()
    if (!trimmedPath) {
      clip.addedAudio = null
      return
    }

    clip.addedAudio = {
      name: trimmedPath.split('/').pop() || 'Clip audio',
      path: trimmedPath,
      src: `/api/media?path=${encodeURIComponent(trimmedPath)}`,
      sourceType: 'path',
      volume: clip.addedAudio?.volume ?? 35
    }
  }

  async function pickClipAddedAudioPath(clipId: string) {
    error.value = ''

    const response = await $fetch<{ path: string }>('/api/system/pick-audio', {
      method: 'POST'
    })

    if (response.path) {
      setClipAddedAudioPath(clipId, response.path)
    }
  }

  function updateClipAddedAudioVolume(clipId: string, volume: number) {
    const clip = clips.value.find(item => item.id === clipId)
    if (clip?.addedAudio) {
      clip.addedAudio = {
        ...clip.addedAudio,
        volume: Math.max(0, Math.min(100, volume))
      }
    }
  }

  function clearClipAddedAudio(clipId: string) {
    const clip = clips.value.find(item => item.id === clipId)
    if (clip) {
      clip.addedAudio = null
    }
  }

  function setAudioPath(path: string) {
    const trimmedPath = path.trim()
    if (!trimmedPath) {
      audio.value = null
      return
    }

    audio.value = {
      name: trimmedPath.split('/').pop() || 'Music track',
      path: trimmedPath,
      src: `/api/media?path=${encodeURIComponent(trimmedPath)}`,
      sourceType: 'path',
      volume: audio.value?.volume ?? 70
    }
  }

  async function pickAudioPath() {
    error.value = ''

    const response = await $fetch<{ path: string }>('/api/system/pick-audio', {
      method: 'POST'
    })

    if (response.path) {
      setAudioPath(response.path)
    }
  }

  function setAudioFile(file?: File) {
    if (!file || !isAudioFile(file)) {
      return
    }

    const src = URL.createObjectURL(file)
    objectUrls.add(src)
    audio.value = {
      name: file.name,
      path: file.name,
      src,
      sourceType: 'file',
      volume: audio.value?.volume ?? 70
    }
  }

  function setAudioVolume(volume: number) {
    if (audio.value) {
      audio.value = { ...audio.value, volume }
    }
  }

  function clearAudio() {
    audio.value = null
  }

  function canPersistProject() {
    return Boolean(
      import.meta.client
        && loadedDirectory.value
        && directory.value === loadedDirectory.value
        && videos.value.some(video => video.sourceType === 'path')
    )
  }

  function clearProjectSaveTimer() {
    if (projectSaveTimer) {
      clearTimeout(projectSaveTimer)
      projectSaveTimer = null
    }
  }

  async function persistProject() {
    clearProjectSaveTimer()

    if (!canPersistProject() || restoringProject.value) {
      return
    }

    try {
      await $fetch<ProjectSaveResponse>('/api/project/save', {
        method: 'POST',
        body: { project: savedProject.value }
      })
    } catch (saveError) {
      error.value = saveError instanceof Error ? saveError.message : 'The project file could not be saved.'
    }
  }

  function queuePersistProject() {
    if (!canPersistProject() || restoringProject.value) {
      return
    }

    clearProjectSaveTimer()
    projectSaveTimer = setTimeout(() => {
      void persistProject()
    }, PROJECT_SAVE_DELAY_MS)
  }

  async function restoreLastProject() {
    if (!import.meta.client) {
      return
    }

    const lastDirectory = localStorage.getItem(LAST_DIRECTORY_STORAGE_KEY)
    if (lastDirectory) {
      directory.value = lastDirectory
      await scanDirectory()
      return
    }

    const legacyProject = localStorage.getItem(LEGACY_PROJECT_STORAGE_KEY)
    if (!legacyProject) {
      return
    }

    try {
      const project = JSON.parse(legacyProject) as Partial<StoredProject>
      if (!project.directory) {
        return
      }

      const response = await $fetch<ScanResponse>('/api/videos/scan', {
        method: 'POST',
        body: { directory: project.directory }
      })

      await applyStoredProject(project, response.directory, response.videos)
      rememberLastDirectory(response.directory)
      localStorage.removeItem(LEGACY_PROJECT_STORAGE_KEY)
      queuePersistProject()
    } catch (restoreError) {
      error.value = restoreError instanceof Error ? restoreError.message : 'The saved project could not be restored.'
    }
  }

  async function resetProject() {
    clearProjectSaveTimer()

    const projectDirectory = loadedDirectory.value
    if (projectDirectory) {
      try {
        await $fetch<ProjectResetResponse>('/api/project/reset', {
          method: 'POST',
          body: { directory: projectDirectory }
        })
      } catch (resetError) {
        error.value = resetError instanceof Error ? resetError.message : 'The project file could not be reset.'
        return
      }
    }

    forgetLastDirectory()

    for (const url of objectUrls) {
      URL.revokeObjectURL(url)
    }
    objectUrls.clear()

    directory.value = ''
    loadedDirectory.value = ''
    videos.value = []
    activeVideoId.value = ''
    clips.value = []
    loading.value = false
    error.value = ''
    draftStart.value = 0
    draftEnd.value = 0
    clipNote.value = ''
    audio.value = null
    storyTitle.value = 'My video story'
  }

  function downloadManifest() {
    if (!import.meta.client) {
      return
    }

    const blob = new Blob([JSON.stringify(manifest.value, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${storyTitle.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'story'}-plan.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  onBeforeUnmount(() => {
    clearProjectSaveTimer()
    for (const url of objectUrls) {
      URL.revokeObjectURL(url)
    }
  })

  onMounted(() => {
    void restoreLastProject()
  })

  watch([
    directory,
    loadedDirectory,
    videos,
    activeVideoId,
    clips,
    draftStart,
    draftEnd,
    clipNote,
    audio,
    storyTitle
  ], queuePersistProject, { deep: true })

  return {
    audio,
    activeVideo,
    canAddClip,
    canCheckout,
    canRender,
    clipCount,
    clipCountsByVideoId,
    clipNote,
    clips,
    directory,
    draftEnd,
    draftStart,
    error,
    loading,
    manifest,
    storyDuration,
    storyTitle,
    transitionItems,
    videos,
    addClip,
    clearAudio,
    downloadManifest,
    formatTime,
    loadBrowserFiles,
    moveClip,
    pickDirectory,
    pickAudioPath,
    pickClipAddedAudioPath,
    removeClip,
    resetProject,
    scanDirectory,
    selectVideo,
    setClipAddedAudioPath,
    setAudioFile,
    setAudioPath,
    setAudioVolume,
    setDraftFromCurrentTime,
    clearClipAddedAudio,
    updateClipAddedAudioVolume,
    updateClipName,
    updateClipSourceVolume,
    updateActiveDuration,
    updateClipTransition
  }
}
