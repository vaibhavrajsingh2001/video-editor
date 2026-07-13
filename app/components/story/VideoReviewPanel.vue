<script setup lang="ts">
import ClipRangeSelector from './ClipRangeSelector.vue'
import type { VideoItem } from '~/types/story'

const props = defineProps<{
  videos: VideoItem[]
  activeVideo?: VideoItem
  draftStart: number
  draftEnd: number
  clipNote: string
  canAddClip: boolean
  clipCount: number
  clipCountsByVideoId: Record<string, number>
  formatTime: (value?: number) => string
}>()

const emit = defineEmits<{
  'select': [videoId: string]
  'duration': [duration: number]
  'update:draftStart': [value: number]
  'update:draftEnd': [value: number]
  'update:clipNote': [value: string]
  'add': []
}>()

const player = useTemplateRef<HTMLVideoElement>('player')
const currentTime = shallowRef(0)
const previewingSelection = shallowRef(false)

const selectedDuration = computed(() => Math.max(0, props.draftEnd - props.draftStart))
const activeIndex = computed(() => props.videos.findIndex(video => video.id === props.activeVideo?.id))
const nextVideo = computed(() => props.videos[activeIndex.value + 1])
const previewButtonLabel = computed(() => previewingSelection.value ? 'Stop preview' : 'Play selected clip')
const previewButtonIcon = computed(() => previewingSelection.value ? 'i-lucide-square' : 'i-lucide-play')

watch(() => props.activeVideo?.id, () => {
  stopSelectedPreview()
  currentTime.value = 0
})

watch(() => [props.draftStart, props.draftEnd], () => {
  stopSelectedPreview()
})

function handleLoadedMetadata() {
  if (player.value?.duration) {
    emit('duration', player.value.duration)
  }
}

function handleTimeUpdate() {
  const nextTime = player.value?.currentTime ?? 0
  currentTime.value = nextTime

  if (previewingSelection.value && nextTime >= props.draftEnd) {
    stopSelectedPreview(props.draftEnd)
  }
}

function handlePause() {
  previewingSelection.value = false
}

function stopSelectedPreview(seekTo?: number) {
  previewingSelection.value = false

  if (!player.value) {
    return
  }

  if (typeof seekTo === 'number') {
    player.value.currentTime = Math.max(0, seekTo)
    currentTime.value = Math.max(0, seekTo)
  }

  player.value.pause()
}

async function playSelectedClip() {
  if (!player.value || selectedDuration.value <= 0) {
    return
  }

  if (previewingSelection.value) {
    stopSelectedPreview()
    return
  }

  previewingSelection.value = true
  player.value.currentTime = Math.max(0, props.draftStart)
  currentTime.value = Math.max(0, props.draftStart)

  try {
    await player.value.play()
  } catch {
    previewingSelection.value = false
  }
}

function previewFrame(time: number) {
  if (!player.value) {
    return
  }

  previewingSelection.value = false
  player.value.pause()
  player.value.currentTime = Math.max(0, time)
  currentTime.value = Math.max(0, time)
}
</script>

<template>
  <section class="review-panel">
    <div class="review-panel__browser">
      <div class="review-panel__browser-head">
        <p class="review-panel__eyebrow">
          Step 2
        </p>
        <h2 class="review-panel__title">
          Choose your clips
        </h2>
      </div>

      <div class="review-panel__list">
        <button
          v-for="(video, index) in props.videos"
          :key="video.id"
          type="button"
          class="video-row"
          :class="{
            'video-row--active': video.id === props.activeVideo?.id,
            'video-row--saved': (props.clipCountsByVideoId[video.id] ?? 0) > 0
          }"
          @click="emit('select', video.id)"
        >
          <span class="video-row__number">{{ index + 1 }}</span>
          <span class="video-row__content">
            <span class="video-row__name">{{ video.name }}</span>
            <span class="video-row__meta">{{ props.formatTime(video.duration) }} · {{ video.relativePath }}</span>
          </span>
          <UBadge
            v-if="props.clipCountsByVideoId[video.id]"
            color="primary"
            variant="soft"
            class="video-row__badge"
          >
            {{ props.clipCountsByVideoId[video.id] }}
          </UBadge>
        </button>
      </div>
    </div>

    <div class="review-panel__stage">
      <div
        v-if="props.activeVideo"
        class="player-shell"
      >
        <video
          ref="player"
          class="player-shell__video"
          :src="props.activeVideo.src"
          controls
          playsinline
          preload="metadata"
          @loadedmetadata="handleLoadedMetadata"
          @timeupdate="handleTimeUpdate"
          @pause="handlePause"
          @ended="stopSelectedPreview()"
        />
      </div>

      <div
        v-else
        class="player-empty"
      >
        <UIcon
          name="i-lucide-clapperboard"
          class="player-empty__icon"
        />
        <span>No videos loaded</span>
      </div>

      <div class="clip-controls">
        <ClipRangeSelector
          :duration="props.activeVideo?.duration"
          :start="props.draftStart"
          :end="props.draftEnd"
          :current-time="currentTime"
          :disabled="!props.activeVideo"
          :format-time="props.formatTime"
          @update:start="emit('update:draftStart', $event)"
          @update:end="emit('update:draftEnd', $event)"
          @preview-time="previewFrame"
        />

        <UInput
          :model-value="props.clipNote"
          icon="i-lucide-pencil"
          placeholder="Name this clip"
          @update:model-value="emit('update:clipNote', String($event))"
        />

        <div class="clip-controls__footer">
          <span>{{ props.formatTime(selectedDuration) }} selected</span>
          <UButton
            :icon="previewButtonIcon"
            color="neutral"
            :variant="previewingSelection ? 'soft' : 'ghost'"
            :disabled="!props.activeVideo || selectedDuration <= 0"
            @click="playSelectedClip"
          >
            {{ previewButtonLabel }}
          </UButton>
          <UButton
            icon="i-lucide-shopping-basket"
            size="lg"
            :disabled="!props.canAddClip"
            @click="emit('add')"
          >
            Add clip
          </UButton>
        </div>
      </div>

      <div class="review-panel__next">
        <UBadge
          color="neutral"
          variant="soft"
        >
          {{ props.clipCount }} saved
        </UBadge>

        <UButton
          v-if="nextVideo"
          trailing-icon="i-lucide-arrow-right"
          color="neutral"
          variant="ghost"
          @click="emit('select', nextVideo.id)"
        >
          Next video
        </UButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.review-panel {
  display: grid;
  grid-template-columns: minmax(14rem, 21rem) minmax(0, 1fr);
  gap: 1rem;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.review-panel__browser,
.review-panel__stage {
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-bg) 94%, var(--ui-primary) 6%);
}

.review-panel__browser {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.review-panel__browser-head {
  padding: 1rem;
  border-bottom: 1px solid var(--ui-border);
}

.review-panel__eyebrow {
  margin: 0 0 0.25rem;
  color: var(--ui-primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.review-panel__title {
  margin: 0;
  color: var(--ui-text-highlighted);
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: 0;
}

.review-panel__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.35rem;
  overflow: auto;
  padding: 0.65rem;
}

.video-row {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  gap: 0.7rem;
  width: 100%;
  min-height: 4rem;
  padding: 0.7rem;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--ui-text);
  text-align: left;
}

.video-row:hover,
.video-row--active {
  border-color: color-mix(in srgb, var(--ui-primary) 45%, transparent);
  background: color-mix(in srgb, var(--ui-primary) 12%, transparent);
}

.video-row--saved {
  border-color: color-mix(in srgb, var(--ui-primary) 34%, transparent);
  background: color-mix(in srgb, var(--ui-primary) 10%, transparent);
}

.video-row__number {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 999px;
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.video-row__content {
  min-width: 0;
}

.video-row__badge {
  align-self: center;
}

.video-row__name,
.video-row__meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-row__name {
  color: var(--ui-text-highlighted);
  font-weight: 700;
}

.video-row__meta {
  margin-top: 0.2rem;
  color: var(--ui-text-muted);
  font-size: 0.78rem;
}

.review-panel__stage {
  display: grid;
  grid-template-rows: minmax(20rem, 1fr) auto auto;
  gap: 0.8rem;
  min-height: 0;
  overflow: hidden;
  padding: 0.9rem;
}

.player-shell {
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
  background: #101418;
}

.player-shell__video {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: contain;
  background: #101418;
}

.player-empty {
  display: grid;
  min-height: 22rem;
  place-items: center;
  border: 1px dashed var(--ui-border);
  border-radius: 8px;
  color: var(--ui-text-muted);
}

.player-empty__icon {
  width: 2rem;
  height: 2rem;
}

.clip-controls {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.65rem;
  align-items: stretch;
}

.clip-controls__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.clip-controls__footer {
  justify-content: flex-end;
  color: var(--ui-text-muted);
  font-size: 0.9rem;
}

.review-panel__next {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

@media (max-width: 1100px) {
  .review-panel {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }

  .review-panel__stage {
    overflow: visible;
  }
}
</style>
