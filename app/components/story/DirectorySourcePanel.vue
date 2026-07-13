<script setup lang="ts">
const props = defineProps<{
  directory: string
  loading: boolean
  error: string
  videoCount: number
  compact: boolean
}>()

const emit = defineEmits<{
  'update:directory': [value: string]
  'pick': []
  'scan': []
  'files': [files: FileList]
}>()

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const pathEntryOpen = shallowRef(false)

function openFilePicker() {
  fileInput.value?.click()
}

function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) {
    emit('files', input.files)
  }
}
</script>

<template>
  <section
    class="source-panel"
    :class="{ 'source-panel--compact': props.compact }"
  >
    <template v-if="props.compact">
      <div class="source-panel__strip">
        <div class="source-panel__strip-main">
          <span class="source-panel__strip-icon">
            <UIcon name="i-lucide-folder-open" />
          </span>
          <div class="source-panel__strip-copy">
            <p class="source-panel__strip-label">
              Video folder
            </p>
            <p class="source-panel__strip-path">
              {{ props.directory }}
            </p>
          </div>
        </div>

        <div class="source-panel__strip-actions">
          <UBadge
            color="neutral"
            variant="subtle"
            icon="i-lucide-film"
          >
            {{ props.videoCount }} {{ props.videoCount === 1 ? 'video' : 'videos' }}
          </UBadge>

          <UButton
            icon="i-lucide-folder-sync"
            color="neutral"
            variant="subtle"
            :loading="props.loading"
            @click="emit('pick')"
          >
            Change folder
          </UButton>
        </div>
      </div>

      <UAlert
        v-if="props.error"
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
        :description="props.error"
      />
    </template>

    <template v-else>
      <div class="source-panel__intro">
        <p class="source-panel__eyebrow">
          Video Story Builder
        </p>
        <h1 class="source-panel__title">
          Start with your video folder
        </h1>
        <p class="source-panel__description">
          Pick a folder of source videos. Then trim clips, arrange the sequence, mix audio, and make one finished video.
        </p>
      </div>

      <UButton
        icon="i-lucide-folder-search"
        size="xl"
        block
        :loading="props.loading"
        @click="emit('pick')"
      >
        Choose folder
      </UButton>

      <p class="source-panel__reassurance">
        <UIcon name="i-lucide-shield-check" />
        Nothing is uploaded. Originals stay untouched.
      </p>

      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-keyboard"
        class="source-panel__paste-toggle"
        :aria-expanded="pathEntryOpen"
        @click="pathEntryOpen = !pathEntryOpen"
      >
        Paste folder path
      </UButton>

      <form
        v-if="pathEntryOpen"
        class="source-panel__path-form"
        @submit.prevent="emit('scan')"
      >
        <label
          class="source-panel__label"
          for="video-directory-path"
        >
          Folder path
        </label>

        <div class="source-panel__actions">
          <UInput
            id="video-directory-path"
            :model-value="props.directory"
            icon="i-lucide-folder-open"
            size="xl"
            placeholder="/Users/vaibhav/Videos/my-project/source-clips"
            class="source-panel__input"
            @update:model-value="emit('update:directory', String($event))"
          />

          <UButton
            icon="i-lucide-folder-check"
            type="submit"
            size="xl"
            color="neutral"
            variant="subtle"
            :loading="props.loading"
          >
            Open folder
          </UButton>
        </div>

        <p class="source-panel__hint">
          Example: /Users/vaibhav/Videos/my-project/source-clips
        </p>
      </form>

      <details class="source-panel__advanced">
        <summary>Advanced preview option</summary>

        <div class="source-panel__advanced-body">
          <p>
            Browser preview can show selected videos, but it cannot provide a renderable local folder path for ffmpeg.
          </p>
          <UButton
            icon="i-lucide-upload"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="openFilePicker"
          >
            Preview videos from browser picker
          </UButton>
        </div>
      </details>

      <UAlert
        v-if="props.error"
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
        :description="props.error"
      />
    </template>

    <input
      ref="fileInput"
      class="source-panel__file"
      type="file"
      accept="video/*"
      multiple
      webkitdirectory
      directory
      @change="handleFiles"
    >
  </section>
</template>

<style scoped>
.source-panel {
  display: flex;
  width: min(100%, 38rem);
  flex-direction: column;
  gap: 1rem;
  margin: 0 auto;
  padding: clamp(1.25rem, 3vw, 2rem);
  border: 1px solid color-mix(in srgb, var(--ui-primary) 18%, var(--ui-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-bg) 96%, white 4%);
  box-shadow: 0 1.25rem 3.5rem rgba(88, 96, 135, 0.12);
}

.source-panel--compact {
  width: 100%;
  padding: 0.85rem 1rem;
  background: color-mix(in srgb, var(--ui-bg) 93%, var(--ui-primary) 7%);
  box-shadow: none;
}

.source-panel__intro {
  display: grid;
  gap: 0.55rem;
  text-align: center;
}

.source-panel__eyebrow {
  margin: 0;
  color: var(--ui-primary);
  font-size: 0.76rem;
  font-weight: 850;
  letter-spacing: 0;
  text-transform: uppercase;
}

.source-panel__title {
  margin: 0;
  color: var(--ui-text-highlighted);
  font-size: clamp(1.9rem, 4vw, 2.65rem);
  font-weight: 850;
  letter-spacing: 0;
  line-height: 1.04;
}

.source-panel__description {
  max-width: 30rem;
  margin: 0 auto;
  color: var(--ui-text-muted);
  font-size: 1.02rem;
  line-height: 1.45;
}

.source-panel__reassurance {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  margin: -0.25rem 0 0;
  color: color-mix(in srgb, var(--ui-success) 70%, var(--ui-text));
  font-size: 0.9rem;
  font-weight: 750;
  text-align: center;
}

.source-panel__paste-toggle {
  justify-content: center;
}

.source-panel__path-form {
  display: grid;
  gap: 0.65rem;
  padding: 0.85rem;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-bg-muted) 86%, white 14%);
}

.source-panel__label {
  color: var(--ui-text-highlighted);
  font-size: 0.88rem;
  font-weight: 850;
}

.source-panel__actions {
  display: grid;
  grid-template-columns: minmax(18rem, 1fr) auto;
  gap: 0.75rem;
}

.source-panel__input {
  min-width: 0;
}

.source-panel__file {
  display: none;
}

.source-panel__meta {
  display: flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.75rem;
}

.source-panel__hint {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 0.86rem;
}

.source-panel__advanced {
  color: var(--ui-text-muted);
  font-size: 0.88rem;
}

.source-panel__advanced summary {
  width: fit-content;
  cursor: pointer;
  font-weight: 750;
}

.source-panel__advanced:not([open]) .source-panel__advanced-body {
  display: none;
}

.source-panel__advanced-body {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.65rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-bg-muted) 72%, white 28%);
}

.source-panel__advanced-body p {
  margin: 0;
  line-height: 1.4;
}

.source-panel__strip {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.source-panel__strip-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
}

.source-panel__strip-icon {
  display: grid;
  width: 2.65rem;
  height: 2.65rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-primary) 14%, white 86%);
  color: var(--ui-primary);
  font-size: 1.4rem;
}

.source-panel__strip-copy {
  min-width: 0;
}

.source-panel__strip-label {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 0.78rem;
  font-weight: 800;
}

.source-panel__strip-path {
  min-width: 0;
  margin: 0.15rem 0 0;
  overflow: hidden;
  color: var(--ui-text-highlighted);
  font-size: 0.96rem;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-panel__strip-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
  justify-content: flex-end;
}

@media (max-width: 980px) {
  .source-panel__actions {
    grid-template-columns: 1fr;
  }

  .source-panel__strip {
    align-items: stretch;
    flex-direction: column;
  }

  .source-panel__strip-actions {
    justify-content: flex-start;
  }
}
</style>
