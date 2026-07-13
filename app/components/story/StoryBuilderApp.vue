<script setup lang="ts">
import ClipBasketPanel from './ClipBasketPanel.vue'
import DirectorySourcePanel from './DirectorySourcePanel.vue'
import StoryCheckoutPanel from './StoryCheckoutPanel.vue'
import VideoReviewPanel from './VideoReviewPanel.vue'
import { useStoryBuilder } from '~/composables/useStoryBuilder'
import type { RenderJobStatus } from '~/types/story'

const story = useStoryBuilder()
const rendering = shallowRef(false)
const pickingAudio = shallowRef(false)
const renderError = shallowRef('')
const renderOutputPath = shallowRef('')
const renderOutputVersion = shallowRef('')
const renderProgress = shallowRef(0)
const renderStage = shallowRef('')
const audioError = shallowRef('')
const workspace = useTemplateRef<HTMLElement>('workspace')
const workspaceMode = shallowRef<'clips' | 'story'>('clips')
const showNewProjectConfirm = shallowRef(false)

const hasVideos = computed(() => story.videos.value.length > 0)
const hasClips = computed(() => story.clips.value.length > 0)
const hasStarted = computed(() => hasVideos.value || hasClips.value)
const renderOutput = computed(() => renderOutputPath.value ? `Saved video to ${renderOutputPath.value}` : '')
const renderPreviewUrl = computed(() => {
  if (!renderOutputPath.value) {
    return ''
  }

  const path = encodeURIComponent(renderOutputPath.value)
  const version = encodeURIComponent(renderOutputVersion.value)
  return `/api/media?path=${path}&v=${version}`
})

onMounted(() => {
  if (!hasVideos.value && !hasClips.value) {
    history.scrollRestoration = 'manual'
    window.scrollTo({ top: 0, left: 0 })
  }
})

watch(hasVideos, async (loaded) => {
  if (!loaded) {
    return
  }

  await nextTick()
  workspace.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  })
})

watch(hasClips, (loaded) => {
  if (!loaded) {
    workspaceMode.value = 'clips'
  }
})

async function chooseAudio() {
  pickingAudio.value = true
  audioError.value = ''

  try {
    await story.pickAudioPath()
  } catch (error) {
    audioError.value = error instanceof Error ? error.message : 'The audio picker could not be opened.'
  } finally {
    pickingAudio.value = false
  }
}

async function renderStory() {
  rendering.value = true
  renderError.value = ''
  renderOutputPath.value = ''
  renderOutputVersion.value = ''
  renderProgress.value = 0
  renderStage.value = 'Starting render'
  audioError.value = ''

  try {
    const startedJob = await $fetch<RenderJobStatus>('/api/render/start', {
      method: 'POST',
      body: story.manifest.value
    })

    renderProgress.value = startedJob.progress
    renderStage.value = startedJob.stage

    const finishedJob = await pollRenderJob(startedJob.id)
    if (finishedJob.state === 'error') {
      throw new Error(finishedJob.error || 'The video could not be rendered.')
    }
    if (!finishedJob.outputPath) {
      throw new Error('The rendered video path was not returned.')
    }

    renderProgress.value = 100
    renderStage.value = 'Finished'
    renderOutputPath.value = finishedJob.outputPath
    renderOutputVersion.value = finishedJob.updatedAt
  } catch (error) {
    renderError.value = error instanceof Error ? error.message : 'The video could not be rendered.'
  } finally {
    rendering.value = false
  }
}

async function pollRenderJob(jobId: string) {
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 700))

    const status = await $fetch<RenderJobStatus>('/api/render/status', {
      query: { id: jobId }
    })

    renderProgress.value = status.progress
    renderStage.value = status.stage

    if (status.state === 'complete' || status.state === 'error') {
      return status
    }
  }
}

function resetRenderState() {
  rendering.value = false
  pickingAudio.value = false
  renderError.value = ''
  renderOutputPath.value = ''
  renderOutputVersion.value = ''
  renderProgress.value = 0
  renderStage.value = ''
  audioError.value = ''
}

function closeNewProjectConfirm() {
  showNewProjectConfirm.value = false
}

async function startNewProject() {
  await story.resetProject()
  if (story.error.value) {
    return
  }

  workspaceMode.value = 'clips'
  resetRenderState()
  showNewProjectConfirm.value = false
  if (import.meta.client) {
    window.scrollTo({ top: 0, left: 0 })
  }
}

async function continueToArrangeStory() {
  if (!hasClips.value) {
    return
  }

  workspaceMode.value = 'story'
  await nextTick()
  workspace.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="showNewProjectConfirm"
      class="new-project-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-title"
    >
      <button
        class="new-project-modal__overlay"
        type="button"
        aria-label="Close new project confirmation"
        @click="closeNewProjectConfirm"
      />

      <section class="new-project-modal__panel">
        <header class="new-project-modal__header">
          <UIcon
            name="i-lucide-triangle-alert"
            class="new-project-modal__icon"
          />
          <div>
            <h2
              id="new-project-title"
              class="new-project-modal__title"
            >
              Start a new project?
            </h2>
            <p class="new-project-modal__text">
              This clears the project file in this folder's edited-output folder. Your original video files stay untouched.
            </p>
          </div>
        </header>

        <footer class="new-project-modal__footer">
          <UButton
            color="neutral"
            variant="ghost"
            @click="closeNewProjectConfirm"
          >
            Keep editing
          </UButton>
          <UButton
            icon="i-lucide-file-plus-2"
            color="error"
            variant="soft"
            @click="startNewProject"
          >
            Start new project
          </UButton>
        </footer>
      </section>
    </div>
  </Teleport>

  <div
    class="story-builder"
    :class="{ 'story-builder--start': !hasStarted }"
  >
    <header class="story-builder__header">
      <div class="story-builder__brand">
        <UIcon
          name="i-lucide-clapperboard"
          class="story-builder__brand-icon"
        />
        <div>
          <p class="story-builder__eyebrow">
            Video Story Builder
          </p>
          <h1 class="story-builder__title">
            Curate your clips into one finished video
          </h1>
        </div>
      </div>

      <div class="story-builder__header-actions">
        <div
          v-if="hasStarted"
          class="story-builder__steps"
          aria-label="Project steps"
        >
          <span class="story-builder__step story-builder__step--done">1 Folder</span>
          <UIcon
            name="i-lucide-arrow-right"
            class="story-builder__step-arrow"
          />
          <span
            class="story-builder__step"
            :class="{ 'story-builder__step--active': workspaceMode === 'clips', 'story-builder__step--done': hasClips }"
          >
            2 Clips
          </span>
          <UIcon
            name="i-lucide-arrow-right"
            class="story-builder__step-arrow"
          />
          <span
            class="story-builder__step"
            :class="{ 'story-builder__step--active': workspaceMode === 'story' }"
          >
            3 Story
          </span>
        </div>

        <UButton
          v-if="hasStarted"
          icon="i-lucide-file-plus-2"
          color="neutral"
          variant="subtle"
          size="sm"
          :disabled="rendering"
          @click="showNewProjectConfirm = true"
        >
          New project
        </UButton>
      </div>
    </header>

    <DirectorySourcePanel
      id="video-folder"
      v-model:directory="story.directory.value"
      :loading="story.loading.value"
      :error="story.error.value"
      :video-count="story.videos.value.length"
      :compact="hasStarted"
      @pick="story.pickDirectory"
      @scan="story.scanDirectory"
      @files="story.loadBrowserFiles"
    />

    <div
      v-if="hasVideos || hasClips"
      ref="workspace"
      class="story-builder__workspace"
      :class="{ 'story-builder__workspace--story': workspaceMode === 'story' }"
    >
      <div class="story-builder__modebar">
        <button
          type="button"
          class="story-builder__mode"
          :class="{ 'story-builder__mode--active': workspaceMode === 'clips' }"
          @click="workspaceMode = 'clips'"
        >
          <UIcon name="i-lucide-scissors" />
          <span>
            <strong>Make clips</strong>
            <small>Cut, mix audio, preview each clip</small>
          </span>
        </button>

        <button
          type="button"
          class="story-builder__mode"
          :class="{ 'story-builder__mode--active': workspaceMode === 'story' }"
          :disabled="!hasClips"
          @click="workspaceMode = 'story'"
        >
          <UIcon name="i-lucide-list-video" />
          <span>
            <strong>Arrange story</strong>
            <small>Order clips, pick transitions, render</small>
          </span>
        </button>
      </div>

      <template v-if="workspaceMode === 'clips'">
        <VideoReviewPanel
          v-if="hasVideos"
          :videos="story.videos.value"
          :active-video="story.activeVideo.value"
          :draft-start="story.draftStart.value"
          :draft-end="story.draftEnd.value"
          :clip-note="story.clipNote.value"
          :can-add-clip="story.canAddClip.value"
          :clip-count="story.clipCount.value"
          :clip-counts-by-video-id="story.clipCountsByVideoId.value"
          :format-time="story.formatTime"
          @select="story.selectVideo"
          @duration="story.updateActiveDuration"
          @update:draft-start="story.draftStart.value = $event"
          @update:draft-end="story.draftEnd.value = $event"
          @update:clip-note="story.clipNote.value = $event"
          @add="story.addClip"
        />

        <aside class="story-builder__side">
          <ClipBasketPanel
            :clips="story.clips.value"
            :story-duration="story.storyDuration.value"
            :format-time="story.formatTime"
            @remove="story.removeClip"
            @update-name="story.updateClipName"
            @update-source-volume="story.updateClipSourceVolume"
            @update-added-audio-path="story.setClipAddedAudioPath"
            @pick-added-audio="story.pickClipAddedAudioPath"
            @update-added-audio-volume="story.updateClipAddedAudioVolume"
            @clear-added-audio="story.clearClipAddedAudio"
          />

          <div
            v-if="hasClips"
            class="story-builder__continue"
          >
            <div class="story-builder__continue-copy">
              <span>Next step</span>
              <strong>Arrange your story</strong>
              <small>
                {{ story.clipCount.value }} {{ story.clipCount.value === 1 ? 'clip' : 'clips' }} · {{ story.formatTime(story.storyDuration.value) }} ready
              </small>
            </div>

            <UButton
              trailing-icon="i-lucide-arrow-right"
              size="lg"
              block
              @click="continueToArrangeStory"
            >
              Continue to arrange story
            </UButton>
          </div>
        </aside>
      </template>

      <template v-else>
        <StoryCheckoutPanel
          v-model:story-title="story.storyTitle.value"
          :clips="story.clips.value"
          :audio="story.audio.value"
          :can-checkout="story.canCheckout.value"
          :can-render="story.canRender.value"
          :picking-audio="pickingAudio"
          :audio-error="audioError"
          :rendering="rendering"
          :render-progress="renderProgress"
          :render-stage="renderStage"
          :render-error="renderError"
          :render-output="renderOutput"
          :render-preview-url="renderPreviewUrl"
          :transition-items="story.transitionItems"
          :story-duration="story.storyDuration.value"
          :format-time="story.formatTime"
          @move="story.moveClip"
          @transition="story.updateClipTransition"
          @audio-path="story.setAudioPath"
          @audio-file="story.setAudioFile"
          @pick-audio="chooseAudio"
          @audio-volume="story.setAudioVolume"
          @clear-audio="story.clearAudio"
          @download="story.downloadManifest"
          @render="renderStory"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.story-builder {
  display: flex;
  box-sizing: border-box;
  flex-direction: column;
  gap: 1rem;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  padding: 1rem;
}

.story-builder--start {
  justify-content: center;
  gap: 1.5rem;
  padding: clamp(1rem, 4vw, 2.5rem);
}

.story-builder__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.story-builder--start .story-builder__header {
  justify-content: center;
  text-align: center;
}

.story-builder__brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.8rem;
}

.story-builder--start .story-builder__brand {
  flex-direction: column;
}

.story-builder__brand-icon {
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  color: var(--ui-primary);
}

.story-builder--start .story-builder__brand-icon {
  width: 2.25rem;
  height: 2.25rem;
}

.story-builder__eyebrow,
.story-builder__title {
  margin: 0;
}

.story-builder__eyebrow {
  color: var(--ui-primary);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.story-builder__title {
  color: var(--ui-text-highlighted);
  font-size: clamp(1.35rem, 2vw, 2.15rem);
  font-weight: 850;
  letter-spacing: 0;
  line-height: 1.08;
}

.story-builder--start .story-builder__title {
  max-width: 30rem;
  font-size: clamp(1.25rem, 2.5vw, 1.8rem);
}

.story-builder__header-actions {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
}

.story-builder__steps {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.25rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 70%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-bg) 82%, var(--story-sky) 18%);
}

.story-builder__step {
  padding: 0.28rem 0.55rem;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--ui-text-muted);
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}

.story-builder__step-arrow {
  width: 0.8rem;
  height: 0.8rem;
  color: var(--ui-text-muted);
}

.story-builder__step--done {
  border-color: color-mix(in srgb, var(--ui-primary) 42%, transparent);
  background: color-mix(in srgb, var(--ui-primary) 14%, var(--ui-bg));
  color: var(--ui-text-highlighted);
}

.story-builder__step--active {
  border-color: color-mix(in srgb, var(--story-lavender) 52%, transparent);
  background: color-mix(in srgb, var(--story-lavender) 19%, var(--ui-bg));
  color: var(--ui-text-highlighted);
}

.story-builder__workspace {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 1fr) minmax(22rem, 30rem);
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1rem;
  align-items: stretch;
  min-height: 0;
  overflow: hidden;
}

.story-builder__workspace--story {
  grid-template-columns: minmax(0, 1fr);
}

.story-builder__modebar {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.story-builder__mode {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg);
  color: var(--ui-text);
  text-align: left;
}

.story-builder__mode:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.story-builder__mode--active {
  border-color: color-mix(in srgb, var(--story-lavender) 58%, transparent);
  background: color-mix(in srgb, var(--story-lavender) 18%, var(--ui-bg));
}

.story-builder__mode span {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.story-builder__mode strong,
.story-builder__mode small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.story-builder__mode strong {
  color: var(--ui-text-highlighted);
  font-size: 0.92rem;
}

.story-builder__mode small {
  color: var(--ui-text-muted);
  font-size: 0.78rem;
}

.story-builder__side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.2rem;
}

.story-builder__continue {
  display: grid;
  flex: 0 0 auto;
  gap: 0.8rem;
  padding: 0.9rem;
  border: 1px solid color-mix(in srgb, var(--story-lavender) 52%, var(--ui-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--story-lavender) 14%, var(--ui-bg));
}

.story-builder__continue-copy {
  display: grid;
  gap: 0.15rem;
}

.story-builder__continue-copy span {
  color: var(--ui-primary);
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
}

.story-builder__continue-copy strong {
  color: var(--ui-text-highlighted);
  font-size: 0.95rem;
}

.story-builder__continue-copy small {
  color: var(--ui-text-muted);
  font-size: 0.78rem;
}

.new-project-modal {
  position: fixed;
  z-index: 70;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
}

.new-project-modal__overlay {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgb(15 23 42 / 42%);
}

.new-project-modal__panel {
  position: relative;
  display: grid;
  width: min(28rem, 100%);
  gap: 1rem;
  padding: 1rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 76%, transparent);
  border-radius: 8px;
  background: var(--ui-bg);
  box-shadow: 0 1rem 3rem rgb(15 23 42 / 20%);
}

.new-project-modal__header {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr);
  gap: 0.8rem;
  align-items: start;
}

.new-project-modal__icon {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0.55rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-warning) 14%, var(--ui-bg));
  color: var(--ui-warning);
}

.new-project-modal__title,
.new-project-modal__text {
  margin: 0;
}

.new-project-modal__title {
  color: var(--ui-text-highlighted);
  font-size: 1.1rem;
  font-weight: 850;
  letter-spacing: 0;
}

.new-project-modal__text {
  margin-top: 0.3rem;
  color: var(--ui-text-muted);
  font-size: 0.9rem;
  line-height: 1.45;
}

.new-project-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
}

@media (max-width: 1320px) {
  .story-builder {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }

  .story-builder__workspace {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    height: auto;
    flex: 0 1 auto;
    min-height: 0;
    overflow: visible;
  }

  .story-builder__side {
    height: auto;
    max-height: none;
    overflow: visible;
  }

  .story-builder__modebar {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .story-builder {
    padding: 0.65rem;
  }

  .story-builder__header,
  .story-builder__brand,
  .story-builder__header-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .story-builder__steps {
    align-self: flex-start;
    flex-wrap: wrap;
    border-radius: 8px;
  }

  .story-builder--start {
    justify-content: flex-start;
    padding-top: 2rem;
  }
}
</style>
