<script setup lang="ts">
import type { ClipItem } from '~/types/story'

const props = defineProps<{
  clips: ClipItem[]
  storyDuration: number
  formatTime: (value?: number) => string
}>()

const emit = defineEmits<{
  remove: [clipId: string]
  updateName: [clipId: string, name: string]
  updateSourceVolume: [clipId: string, volume: number]
  updateAddedAudioPath: [clipId: string, path: string]
  pickAddedAudio: [clipId: string]
  updateAddedAudioVolume: [clipId: string, volume: number]
  clearAddedAudio: [clipId: string]
}>()

const audioPaths = reactive<Record<string, string>>({})
const previewingClipId = shallowRef('')
const previewVideo = useTemplateRef<HTMLVideoElement>('previewVideo')
const previewAddedAudio = useTemplateRef<HTMLAudioElement>('previewAddedAudio')

const previewClip = computed(() => props.clips.find(clip => clip.id === previewingClipId.value) ?? null)

watch(previewClip, async (clip) => {
  if (!clip) {
    return
  }

  await nextTick()
  startPreview()
})

function useClipAudioPath(clipId: string) {
  emit('updateAddedAudioPath', clipId, audioPaths[clipId] ?? '')
  audioPaths[clipId] = ''
}

function playFinishedClip(clipId: string) {
  if (previewingClipId.value === clipId) {
    stopPreview()
    return
  }

  previewingClipId.value = clipId
}

async function startPreview() {
  const clip = previewClip.value
  const video = previewVideo.value

  if (!clip || !video || video.readyState === 0) {
    return
  }

  const addedAudio = previewAddedAudio.value
  video.pause()
  video.volume = Math.max(0, Math.min(1, clip.sourceVolume / 100))
  video.currentTime = clip.start

  if (addedAudio && clip.addedAudio) {
    addedAudio.pause()
    addedAudio.currentTime = 0
    addedAudio.volume = Math.max(0, Math.min(1, clip.addedAudio.volume / 100))
  }

  try {
    await video.play()
    if (addedAudio && clip.addedAudio) {
      await addedAudio.play()
    }
  } catch {
    stopPreview()
  }
}

function stopPreview(seekToEnd = false) {
  const clip = previewClip.value

  if (seekToEnd && clip && previewVideo.value) {
    previewVideo.value.currentTime = clip.end
  }

  previewVideo.value?.pause()
  previewAddedAudio.value?.pause()
  previewingClipId.value = ''
}

function handlePreviewTimeUpdate() {
  const clip = previewClip.value
  const video = previewVideo.value

  if (clip && video && video.currentTime >= clip.end) {
    stopPreview(true)
  }
}
</script>

<template>
  <section class="basket-panel">
    <div class="basket-panel__header">
      <div>
        <p class="basket-panel__eyebrow">
          Step 2
        </p>
        <h2 class="basket-panel__title">
          Finish clips
        </h2>
      </div>

      <UBadge
        color="primary"
        variant="soft"
      >
        {{ props.formatTime(props.storyDuration) }}
      </UBadge>
    </div>

    <div
      v-if="previewClip"
      class="clip-preview"
    >
      <video
        ref="previewVideo"
        class="clip-preview__video"
        :src="previewClip.src"
        playsinline
        controls
        @loadedmetadata="startPreview"
        @timeupdate="handlePreviewTimeUpdate"
        @pause="previewAddedAudio?.pause()"
        @ended="stopPreview()"
      />
      <audio
        v-if="previewClip.addedAudio"
        ref="previewAddedAudio"
        :src="previewClip.addedAudio.src"
      />
      <div class="clip-preview__meta">
        <span>{{ previewClip.name || previewClip.videoName }}</span>
        <UButton
          icon="i-lucide-square"
          size="sm"
          color="neutral"
          variant="ghost"
          @click="stopPreview()"
        >
          Stop
        </UButton>
      </div>
    </div>

    <div
      v-if="props.clips.length"
      class="basket-panel__list"
    >
      <article
        v-for="(clip, index) in props.clips"
        :key="clip.id"
        class="clip-card"
      >
        <div class="clip-card__index">
          {{ index + 1 }}
        </div>

        <div class="clip-card__body">
          <UInput
            :model-value="clip.name"
            icon="i-lucide-tag"
            size="sm"
            placeholder="Name this clip"
            class="clip-card__name-input"
            @update:model-value="emit('updateName', clip.id, String($event))"
          />
          <p class="clip-card__meta">
            <strong>{{ clip.videoName }}</strong>
          </p>
          <p class="clip-card__meta">
            {{ props.formatTime(clip.start) }} to {{ props.formatTime(clip.end) }} · {{ props.formatTime(clip.end - clip.start) }}
          </p>
          <p
            v-if="clip.note"
            class="clip-card__note"
          >
            {{ clip.note }}
          </p>

          <div class="clip-audio">
            <div class="clip-audio__row">
              <span>Original audio</span>
              <strong>{{ clip.sourceVolume }}%</strong>
            </div>
            <USlider
              :model-value="clip.sourceVolume"
              :min="0"
              :max="100"
              @update:model-value="emit('updateSourceVolume', clip.id, Number($event))"
            />

            <div class="clip-audio__added">
              <UInput
                v-model="audioPaths[clip.id]"
                icon="i-lucide-file-audio"
                size="sm"
                placeholder="/Users/vaibhav/Music/clip-background.mp3"
                @keydown.enter="useClipAudioPath(clip.id)"
              />
              <UButton
                size="sm"
                color="neutral"
                variant="subtle"
                @click="useClipAudioPath(clip.id)"
              >
                Use path
              </UButton>
              <UButton
                icon="i-lucide-music-2"
                size="sm"
                color="neutral"
                variant="ghost"
                @click="emit('pickAddedAudio', clip.id)"
              >
                Pick
              </UButton>
            </div>

            <div
              v-if="clip.addedAudio"
              class="clip-audio__track"
            >
              <div class="clip-audio__track-head">
                <UIcon name="i-lucide-music-2" />
                <span>{{ clip.addedAudio.name }}</span>
                <strong>{{ clip.addedAudio.volume }}%</strong>
              </div>
              <USlider
                :model-value="clip.addedAudio.volume"
                :min="0"
                :max="100"
                @update:model-value="emit('updateAddedAudioVolume', clip.id, Number($event))"
              />
              <UButton
                icon="i-lucide-x"
                size="sm"
                color="neutral"
                variant="ghost"
                @click="emit('clearAddedAudio', clip.id)"
              >
                Remove added audio
              </UButton>
            </div>
          </div>

          <div class="clip-card__actions">
            <UButton
              :icon="previewingClipId === clip.id ? 'i-lucide-square' : 'i-lucide-play'"
              size="sm"
              color="neutral"
              variant="subtle"
              @click="playFinishedClip(clip.id)"
            >
              {{ previewingClipId === clip.id ? 'Stop preview' : 'Preview finished clip' }}
            </UButton>
          </div>
        </div>

        <UButton
          class="clip-card__remove"
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          aria-label="Remove clip"
          @click="emit('remove', clip.id)"
        />
      </article>
    </div>

    <div
      v-else
      class="basket-panel__empty"
    >
      <UIcon
        name="i-lucide-heart-plus"
        class="basket-panel__empty-icon"
      />
      <span>Your finished clips will collect here.</span>
    </div>
  </section>
</template>

<style scoped>
.basket-panel {
  display: flex;
  min-height: 12rem;
  max-height: none;
  flex-direction: column;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg);
}

.basket-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--ui-border);
}

.basket-panel__eyebrow {
  margin: 0 0 0.25rem;
  color: var(--ui-primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.basket-panel__title {
  margin: 0;
  color: var(--ui-text-highlighted);
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0;
}

.basket-panel__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.5rem;
  overflow: auto;
  padding: 0.75rem;
}

.clip-card {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  gap: 0.65rem;
  align-items: start;
  max-width: 100%;
  min-height: 4.25rem;
  padding: 0.7rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 82%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-bg-elevated) 88%, var(--ui-primary) 12%);
}

.clip-card__index {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-primary) 20%, transparent);
  color: var(--ui-text-highlighted);
  font-size: 0.8rem;
  font-weight: 800;
}

.clip-card__body {
  min-width: 0;
  overflow: hidden;
}

.clip-card__meta,
.clip-card__note {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clip-card__name-input {
  width: 100%;
  min-width: 0;
}

.clip-card__remove {
  width: 2rem;
  height: 2rem;
}

.clip-card__meta,
.clip-card__note {
  margin: 0.2rem 0 0;
  color: var(--ui-text-muted);
  font-size: 0.78rem;
}

.clip-preview {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--ui-border);
  background: color-mix(in srgb, var(--ui-bg-elevated) 88%, var(--ui-primary) 12%);
}

.clip-preview__video {
  width: 100%;
  max-height: 12rem;
  border-radius: 8px;
  background: #101418;
}

.clip-preview__meta,
.clip-audio__row,
.clip-audio__track-head,
.clip-card__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.clip-preview__meta,
.clip-audio__row,
.clip-audio__track-head {
  justify-content: space-between;
}

.clip-preview__meta {
  color: var(--ui-text-highlighted);
  font-size: 0.85rem;
  font-weight: 800;
}

.clip-audio {
  display: grid;
  max-width: 100%;
  min-width: 0;
  gap: 0.55rem;
  margin-top: 0.7rem;
  padding: 0.65rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 78%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-bg) 88%, var(--ui-primary) 12%);
}

.clip-audio__row,
.clip-audio__track-head {
  color: var(--ui-text);
  font-size: 0.78rem;
}

.clip-audio__added {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.45rem;
  min-width: 0;
}

.clip-audio__added > * {
  min-width: 0;
}

.clip-audio__track {
  display: grid;
  gap: 0.45rem;
}

.clip-audio__track-head span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clip-card__actions {
  justify-content: flex-start;
  margin-top: 0.65rem;
}

.basket-panel__empty {
  display: grid;
  flex: 1;
  place-items: center;
  padding: 2rem;
  color: var(--ui-text-muted);
  text-align: center;
}

.basket-panel__empty-icon {
  width: 2rem;
  height: 2rem;
}

@media (max-width: 760px) {
  .clip-audio__added {
    grid-template-columns: 1fr;
  }
}
</style>
