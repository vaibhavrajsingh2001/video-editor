<script setup lang="ts">
import StoryOutputPanel from './StoryOutputPanel.vue'
import type { ClipItem, StoryAudio, TransitionKind } from '~/types/story'

const props = defineProps<{
  clips: ClipItem[]
  storyTitle: string
  audio: StoryAudio | null
  canCheckout: boolean
  canRender: boolean
  pickingAudio: boolean
  audioError: string
  rendering: boolean
  renderProgress: number
  renderStage: string
  renderError: string
  renderOutput: string
  renderPreviewUrl: string
  transitionItems: { label: string, value: TransitionKind, icon: string }[]
  storyDuration: number
  formatTime: (value?: number) => string
}>()

const emit = defineEmits<{
  'update:storyTitle': [value: string]
  'move': [clipId: string, direction: -1 | 1]
  'transition': [clipId: string, value: TransitionKind]
  'audioPath': [value: string]
  'audioFile': [file: File]
  'pickAudio': []
  'audioVolume': [value: number]
  'clearAudio': []
  'download': []
  'render': []
}>()

const audioPath = shallowRef('')
const showRenderConfirm = shallowRef(false)
const outputSection = useTemplateRef<HTMLElement>('outputSection')
const progressStyle = computed(() => ({
  width: `${Math.max(0, Math.min(100, props.renderProgress))}%`
}))
const storyClipSummary = computed(() => `${props.clips.length} ${props.clips.length === 1 ? 'clip' : 'clips'}`)

function clipTitle(clip: ClipItem) {
  return clip.name || clip.note || clip.videoName
}

function clipAudioSummary(clip: ClipItem) {
  const added = clip.addedAudio ? ` + ${clip.addedAudio.name} ${clip.addedAudio.volume}%` : ''
  return `clip audio ${clip.sourceVolume}%${added}`
}

function seekPreview(event: Event, start: number) {
  const video = event.target as HTMLVideoElement
  if (Number.isFinite(start)) {
    video.currentTime = Math.max(0, start)
  }
}

watch(() => props.rendering, (rendering) => {
  if (rendering) {
    showRenderConfirm.value = true
  }
})

watch(() => props.renderOutput, async (output) => {
  if (!output) {
    return
  }

  showRenderConfirm.value = false
  await nextTick()
  outputSection.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  })
})

watch(() => props.renderError, (error) => {
  if (error) {
    showRenderConfirm.value = true
  }
})

function applyAudioPath() {
  emit('audioPath', audioPath.value)
}

function openRenderConfirm() {
  if (props.canRender) {
    showRenderConfirm.value = true
  }
}

function closeRenderConfirm() {
  if (!props.rendering) {
    showRenderConfirm.value = false
  }
}

function confirmRender() {
  emit('render')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="showRenderConfirm"
      class="render-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="render-modal-title"
    >
      <button
        class="render-modal__overlay"
        type="button"
        aria-label="Close render confirmation"
        :disabled="props.rendering"
        @click="closeRenderConfirm"
      />

      <section class="render-modal__panel">
        <header class="render-modal__header">
          <div>
            <p class="render-modal__eyebrow">
              Final check
            </p>
            <h2
              id="render-modal-title"
              class="render-modal__title"
            >
              Make {{ props.storyTitle }}
            </h2>
          </div>

          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            aria-label="Close"
            :disabled="props.rendering"
            @click="closeRenderConfirm"
          />
        </header>

        <div class="render-modal__body">
          <div class="render-summary">
            <UBadge
              color="primary"
              variant="soft"
              icon="i-lucide-clock"
            >
              {{ props.formatTime(props.storyDuration) }}
            </UBadge>
            <UBadge
              color="neutral"
              variant="soft"
              icon="i-lucide-list-video"
            >
              {{ storyClipSummary }}
            </UBadge>
            <UBadge
              color="neutral"
              variant="soft"
              :icon="props.audio ? 'i-lucide-music-2' : 'i-lucide-volume-x'"
            >
              {{ props.audio ? props.audio.name : 'No music' }}
            </UBadge>
          </div>

          <div class="render-diagram">
            <div class="render-node render-node--source">
              <UIcon name="i-lucide-folder-open" />
              <span>Video folder</span>
            </div>

            <UIcon
              name="i-lucide-chevron-right"
              class="render-diagram__arrow"
            />

            <div class="render-node render-node--clips">
              <div
                v-for="(clip, index) in props.clips"
                :key="clip.id"
                class="render-clip"
              >
                <span class="render-clip__index">{{ index + 1 }}</span>
                <span class="render-clip__text">
                  <strong>{{ clipTitle(clip) }}</strong>
                  <small>{{ props.formatTime(clip.start) }} to {{ props.formatTime(clip.end) }} · {{ clipAudioSummary(clip) }} · {{ clip.transition }}</small>
                </span>
              </div>
            </div>

            <UIcon
              name="i-lucide-chevron-right"
              class="render-diagram__arrow"
            />

            <div class="render-node render-node--music">
              <UIcon name="i-lucide-sliders-horizontal" />
              <span>Per-clip audio mix</span>
            </div>

            <UIcon
              name="i-lucide-chevron-right"
              class="render-diagram__arrow"
            />

            <div class="render-node render-node--output">
              <UIcon name="i-lucide-file-video" />
              <span>Final MP4</span>
            </div>
          </div>

          <div
            v-if="props.rendering || props.renderOutput || props.renderError"
            class="render-progress"
          >
            <div class="render-progress__meta">
              <span>{{ props.renderStage || 'Preparing render' }}</span>
              <strong>{{ Math.round(props.renderProgress) }}%</strong>
            </div>
            <div class="render-progress__track">
              <div
                class="render-progress__bar"
                :style="progressStyle"
              />
            </div>
          </div>

          <UAlert
            v-if="props.renderError"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :description="props.renderError"
          />

          <UAlert
            v-if="props.renderOutput"
            color="success"
            variant="soft"
            icon="i-lucide-check-circle"
            :description="props.renderOutput"
          />
        </div>

        <footer class="render-modal__footer">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="props.rendering"
            @click="closeRenderConfirm"
          >
            {{ props.renderOutput ? 'Done' : 'Cancel' }}
          </UButton>

          <UButton
            icon="i-lucide-wand-sparkles"
            :loading="props.rendering"
            :disabled="props.rendering || Boolean(props.renderOutput)"
            @click="confirmRender"
          >
            Confirm and make video
          </UButton>
        </footer>
      </section>
    </div>
  </Teleport>

  <section class="checkout-panel">
    <div class="checkout-panel__header">
      <div>
        <p class="checkout-panel__eyebrow">
          Step 3
        </p>
        <h2 class="checkout-panel__title">
          Arrange story
        </h2>
      </div>

      <UBadge
        color="primary"
        variant="soft"
        icon="i-lucide-clock"
      >
        {{ props.formatTime(props.storyDuration) }}
      </UBadge>
    </div>

    <div class="checkout-panel__body">
      <section class="input-panel">
        <header class="input-panel__header">
          <div>
            <p class="input-panel__eyebrow">
              Input
            </p>
            <h3 class="input-panel__title">
              Story setup
            </h3>
          </div>

          <UBadge
            color="neutral"
            variant="soft"
            icon="i-lucide-list-video"
          >
            {{ storyClipSummary }}
          </UBadge>
        </header>

        <div class="input-panel__body">
          <div class="input-field">
            <label for="story-title">Video title</label>
            <UInput
              id="story-title"
              :model-value="props.storyTitle"
              icon="i-lucide-type"
              size="lg"
              placeholder="Story title"
              @update:model-value="emit('update:storyTitle', String($event))"
            />
          </div>

          <div
            v-if="props.clips.length"
            class="story-list"
          >
            <article
              v-for="(clip, index) in props.clips"
              :key="clip.id"
              class="story-row"
            >
              <div class="story-row__preview-shell">
                <video
                  class="story-row__preview"
                  :src="clip.src"
                  muted
                  playsinline
                  preload="metadata"
                  :aria-label="`Preview ${clipTitle(clip)}`"
                  @loadedmetadata="seekPreview($event, clip.start)"
                />
              </div>

              <div class="story-row__grab">
                {{ index + 1 }}
              </div>

              <div class="story-row__main">
                <h3 class="story-row__title">
                  {{ clipTitle(clip) }}
                </h3>
                <p class="story-row__meta">
                  {{ clip.videoName }}
                </p>
                <p class="story-row__meta">
                  {{ props.formatTime(clip.start) }} to {{ props.formatTime(clip.end) }}
                </p>
                <p class="story-row__meta">
                  {{ clipAudioSummary(clip) }}
                </p>
              </div>

              <USelect
                :model-value="clip.transition"
                :items="props.transitionItems"
                value-key="value"
                label-key="label"
                class="story-row__select"
                @update:model-value="emit('transition', clip.id, $event as TransitionKind)"
              />

              <div class="story-row__buttons">
                <UButton
                  icon="i-lucide-arrow-up"
                  color="neutral"
                  variant="ghost"
                  aria-label="Move earlier"
                  :disabled="index === 0"
                  @click="emit('move', clip.id, -1)"
                />
                <UButton
                  icon="i-lucide-arrow-down"
                  color="neutral"
                  variant="ghost"
                  aria-label="Move later"
                  :disabled="index === props.clips.length - 1"
                  @click="emit('move', clip.id, 1)"
                />
              </div>
            </article>
          </div>

          <div
            v-else
            class="checkout-panel__empty"
          >
            <UIcon
              name="i-lucide-list-video"
              class="checkout-panel__empty-icon"
            />
            <span>Add a few clips before checkout.</span>
          </div>

          <div class="music-panel">
            <div class="music-panel__header">
              <UIcon name="i-lucide-music-2" />
              <span>Story-wide music</span>
            </div>

            <div class="music-panel__controls">
              <UInput
                v-model="audioPath"
                icon="i-lucide-file-audio"
                placeholder="/Users/vaibhav/Music/story-track.mp3"
                @keydown.enter="applyAudioPath"
              />
              <UButton
                color="neutral"
                variant="subtle"
                @click="applyAudioPath"
              >
                Use path
              </UButton>
              <UButton
                icon="i-lucide-music-2"
                color="neutral"
                variant="ghost"
                :loading="props.pickingAudio"
                @click="emit('pickAudio')"
              >
                Pick file
              </UButton>
            </div>

            <div
              v-if="props.audio"
              class="music-panel__active"
            >
              <div class="music-panel__track">
                <UIcon name="i-lucide-file-audio" />
                <span>{{ props.audio.name }}</span>
              </div>

              <audio
                :src="props.audio.src"
                controls
              />

              <div class="music-panel__volume">
                <span>{{ props.audio.volume }}%</span>
                <USlider
                  :model-value="props.audio.volume"
                  :min="0"
                  :max="100"
                  @update:model-value="emit('audioVolume', Number($event))"
                />
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  aria-label="Remove music"
                  @click="emit('clearAudio')"
                />
              </div>
            </div>
          </div>

          <UAlert
            v-if="props.audioError"
            color="warning"
            variant="soft"
            icon="i-lucide-music"
            :description="props.audioError"
          />
        </div>

        <footer class="input-panel__footer">
          <UButton
            icon="i-lucide-file-json"
            color="neutral"
            variant="subtle"
            :disabled="!props.canCheckout"
            @click="emit('download')"
          >
            Save plan
          </UButton>
        </footer>
      </section>

      <div
        ref="outputSection"
        class="checkout-panel__output"
      >
        <StoryOutputPanel
          :story-title="props.storyTitle"
          :clip-count="props.clips.length"
          :story-duration="props.storyDuration"
          :can-render="props.canRender"
          :rendering="props.rendering"
          :render-progress="props.renderProgress"
          :render-stage="props.renderStage"
          :render-error="props.renderError"
          :render-output="props.renderOutput"
          :render-preview-url="props.renderPreviewUrl"
          :format-time="props.formatTime"
          @render="openRenderConfirm"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.checkout-panel {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg);
}

.checkout-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--ui-border);
}

.checkout-panel__eyebrow {
  margin: 0 0 0.25rem;
  color: var(--ui-primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.checkout-panel__title {
  margin: 0;
  color: var(--ui-text-highlighted);
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0;
}

.checkout-panel__body {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1.2fr) minmax(22rem, 0.8fr);
  gap: 1rem;
  min-height: 0;
  overflow: hidden;
  padding: 1rem;
}

.input-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg);
}

.input-panel__header,
.input-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem;
}

.input-panel__header {
  border-bottom: 1px solid var(--ui-border);
}

.input-panel__footer {
  justify-content: flex-end;
  border-top: 1px solid var(--ui-border);
}

.input-panel__eyebrow,
.input-panel__title {
  margin: 0;
}

.input-panel__eyebrow {
  color: var(--ui-primary);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.input-panel__title {
  margin-top: 0.15rem;
  color: var(--ui-text-highlighted);
  font-size: 1rem;
  font-weight: 850;
}

.input-panel__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.85rem;
  overflow-y: auto;
  padding: 0.9rem;
}

.input-field {
  display: grid;
  gap: 0.4rem;
}

.input-field label {
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  font-weight: 750;
}

.checkout-panel__output {
  min-width: 0;
  min-height: 0;
}

.story-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.story-row {
  display: grid;
  grid-template-columns: 7.5rem 2rem minmax(0, 1fr) minmax(8rem, 11rem) auto;
  gap: 0.65rem;
  align-items: center;
  min-height: 5.4rem;
  padding: 0.7rem;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-bg-elevated) 90%, var(--ui-primary) 10%);
}

.story-row__preview-shell {
  width: 7.5rem;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ui-border) 72%, transparent);
  border-radius: 8px;
  background: #0f172a;
}

.story-row__preview {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.story-row__grab {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-primary) 18%, transparent);
  font-size: 0.8rem;
  font-weight: 800;
}

.story-row__main {
  min-width: 0;
}

.story-row__title,
.story-row__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.story-row__title {
  margin: 0;
  color: var(--ui-text-highlighted);
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0;
}

.story-row__meta {
  margin: 0.2rem 0 0;
  color: var(--ui-text-muted);
  font-size: 0.78rem;
}

.story-row__buttons {
  display: flex;
  gap: 0.15rem;
}

.music-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 78%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-bg-elevated) 84%, #14b8a6 16%);
}

.music-panel__header,
.music-panel__controls,
.music-panel__active,
.music-panel__volume {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.music-panel__header {
  color: var(--ui-text-highlighted);
  font-weight: 800;
}

.music-panel__header > span {
  display: grid;
}

.music-panel__controls {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) auto auto;
}

.music-panel__active {
  flex-wrap: wrap;
}

.music-panel__track {
  display: flex;
  min-width: 100%;
  align-items: center;
  gap: 0.45rem;
  color: var(--ui-text-highlighted);
  font-size: 0.86rem;
  font-weight: 800;
}

.music-panel__track span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.music-panel__active audio {
  min-width: 16rem;
  max-width: 100%;
}

.music-panel__volume {
  flex: 1;
  min-width: 13rem;
}

.checkout-panel__empty {
  display: grid;
  min-height: 9rem;
  place-items: center;
  border: 1px dashed var(--ui-border);
  border-radius: 8px;
  color: var(--ui-text-muted);
  text-align: center;
}

.checkout-panel__empty-icon {
  width: 2rem;
  height: 2rem;
}

.render-modal {
  position: fixed;
  z-index: 60;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
}

.render-modal__overlay {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgb(0 0 0 / 68%);
}

.render-modal__panel {
  position: relative;
  display: flex;
  width: min(74rem, 100%);
  max-height: min(48rem, calc(100vh - 2rem));
  flex-direction: column;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ui-border) 74%, transparent);
  border-radius: 8px;
  background: var(--ui-bg);
  box-shadow: 0 1.5rem 5rem rgb(0 0 0 / 48%);
}

.render-modal__header,
.render-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
}

.render-modal__header {
  border-bottom: 1px solid var(--ui-border);
}

.render-modal__footer {
  border-top: 1px solid var(--ui-border);
}

.render-modal__eyebrow,
.render-modal__title {
  margin: 0;
}

.render-modal__eyebrow {
  color: var(--ui-primary);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.render-modal__title {
  margin-top: 0.2rem;
  color: var(--ui-text-highlighted);
  font-size: 1.35rem;
  font-weight: 850;
  letter-spacing: 0;
}

.render-modal__body {
  display: grid;
  gap: 1rem;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
}

.render-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.render-diagram {
  display: grid;
  grid-template-columns: minmax(8rem, auto) auto minmax(18rem, 1fr) auto minmax(9rem, auto) auto minmax(8rem, auto);
  gap: 0.7rem;
  align-items: center;
  min-width: 0;
  padding: 0.85rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 78%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-bg-elevated) 88%, var(--ui-primary) 12%);
}

.render-diagram__arrow {
  color: var(--ui-primary);
}

.render-node {
  display: grid;
  min-height: 5rem;
  min-width: 0;
  align-content: center;
  justify-items: center;
  gap: 0.45rem;
  padding: 0.75rem;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  font-size: 0.86rem;
  font-weight: 800;
  text-align: center;
}

.render-node--clips {
  display: flex;
  max-height: 15rem;
  flex-direction: column;
  justify-items: stretch;
  gap: 0.45rem;
  overflow-y: auto;
  text-align: left;
}

.render-clip {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: 0.55rem;
  align-items: center;
  min-height: 3rem;
  padding: 0.55rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 78%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-bg-elevated) 88%, var(--ui-primary) 12%);
}

.render-clip__index {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-primary) 18%, transparent);
  color: var(--ui-text-highlighted);
  font-size: 0.78rem;
}

.render-clip__text {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.render-clip__text strong,
.render-clip__text small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.render-clip__text small {
  color: var(--ui-text-muted);
  font-size: 0.76rem;
  font-weight: 700;
}

.render-progress {
  display: grid;
  gap: 0.5rem;
  padding: 0.85rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 78%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-bg-elevated) 86%, var(--ui-primary) 14%);
}

.render-progress__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--ui-text);
  font-size: 0.9rem;
}

.render-progress__track {
  height: 0.7rem;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-border) 58%, transparent);
}

.render-progress__bar {
  height: 100%;
  border-radius: inherit;
  background: var(--ui-primary);
  transition: width 180ms ease;
}

@media (max-width: 1180px) {
  .checkout-panel {
    overflow: visible;
  }

  .checkout-panel__body {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .input-panel,
  .checkout-panel__output {
    min-height: 32rem;
  }
}

@media (max-width: 760px) {
  .checkout-panel__body {
    padding: 0.65rem;
  }

  .input-panel__header,
  .input-panel__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .story-row,
  .music-panel__controls {
    grid-template-columns: 1fr;
  }

  .story-row__preview-shell {
    width: 100%;
    max-width: 18rem;
  }

  .story-row__select,
  .story-row__buttons {
    width: 100%;
  }

  .render-diagram {
    grid-template-columns: 1fr;
  }

  .render-diagram__arrow {
    justify-self: center;
    rotate: 90deg;
  }
}
</style>
