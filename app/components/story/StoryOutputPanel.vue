<script setup lang="ts">
const props = defineProps<{
  storyTitle: string
  clipCount: number
  storyDuration: number
  canRender: boolean
  rendering: boolean
  renderProgress: number
  renderStage: string
  renderError: string
  renderOutput: string
  renderPreviewUrl: string
  formatTime: (value?: number) => string
}>()

const emit = defineEmits<{
  render: []
}>()

const progressStyle = computed(() => ({
  width: `${Math.max(0, Math.min(100, props.renderProgress))}%`
}))
const clipSummary = computed(() => `${props.clipCount} ${props.clipCount === 1 ? 'clip' : 'clips'}`)
const statusLabel = computed(() => {
  if (props.rendering) {
    return 'Rendering'
  }

  return props.renderPreviewUrl ? 'Ready' : 'Not rendered'
})
</script>

<template>
  <section class="output-panel">
    <header class="output-panel__header">
      <div>
        <p class="output-panel__eyebrow">
          Output
        </p>
        <h3 class="output-panel__title">
          Final video
        </h3>
      </div>

      <UBadge
        :color="props.renderPreviewUrl ? 'success' : 'neutral'"
        variant="soft"
        :icon="props.renderPreviewUrl ? 'i-lucide-check' : 'i-lucide-clock-3'"
      >
        {{ statusLabel }}
      </UBadge>
    </header>

    <div class="output-panel__body">
      <div class="output-preview">
        <video
          v-if="props.renderPreviewUrl"
          class="output-preview__video"
          :src="props.renderPreviewUrl"
          controls
          playsinline
          preload="metadata"
          :aria-label="`Final generated video: ${props.storyTitle}`"
        />

        <div
          v-else-if="props.rendering"
          class="output-preview__state"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="output-preview__icon output-preview__icon--spinning"
          />
          <strong>{{ props.renderStage || 'Rendering your video' }}</strong>
          <span>{{ Math.round(props.renderProgress) }}% complete</span>
        </div>

        <div
          v-else
          class="output-preview__state"
        >
          <UIcon
            name="i-lucide-monitor-play"
            class="output-preview__icon"
          />
          <strong>Your final video will appear here</strong>
          <span>Finish arranging the inputs, then render a preview.</span>
        </div>
      </div>

      <div
        v-if="props.rendering"
        class="output-progress"
      >
        <div class="output-progress__meta">
          <span>{{ props.renderStage || 'Preparing render' }}</span>
          <strong>{{ Math.round(props.renderProgress) }}%</strong>
        </div>
        <div class="output-progress__track">
          <div
            class="output-progress__bar"
            :style="progressStyle"
          />
        </div>
      </div>

      <div class="output-summary">
        <div class="output-summary__item">
          <span>Title</span>
          <strong>{{ props.storyTitle || 'Untitled video' }}</strong>
        </div>
        <div class="output-summary__item">
          <span>Sequence</span>
          <strong>{{ clipSummary }} · {{ props.formatTime(props.storyDuration) }}</strong>
        </div>
        <div class="output-summary__item">
          <span>Format</span>
          <strong>MP4 video</strong>
        </div>
      </div>

      <UAlert
        v-if="props.canRender === false && props.clipCount > 0"
        color="warning"
        variant="soft"
        icon="i-lucide-folder-open"
        description="Rendering needs clips and any added audio loaded from local file paths."
      />

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

    <footer class="output-panel__footer">
      <UButton
        icon="i-lucide-wand-sparkles"
        size="lg"
        block
        :loading="props.rendering"
        :disabled="!props.canRender"
        @click="emit('render')"
      >
        {{ props.renderPreviewUrl ? 'Render again' : 'Make video' }}
      </UButton>
    </footer>
  </section>
</template>

<style scoped>
.output-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg);
}

.output-panel__header,
.output-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem;
}

.output-panel__header {
  border-bottom: 1px solid var(--ui-border);
}

.output-panel__footer {
  border-top: 1px solid var(--ui-border);
}

.output-panel__eyebrow,
.output-panel__title {
  margin: 0;
}

.output-panel__eyebrow {
  color: var(--ui-primary);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.output-panel__title {
  margin-top: 0.15rem;
  color: var(--ui-text-highlighted);
  font-size: 1rem;
  font-weight: 850;
}

.output-panel__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.8rem;
  overflow-y: auto;
  padding: 0.9rem;
}

.output-preview {
  display: grid;
  flex: 0 0 auto;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--ui-border) 78%, transparent);
  border-radius: 8px;
  background: #020617;
}

.output-preview__video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.output-preview__state {
  display: grid;
  max-width: 20rem;
  justify-items: center;
  gap: 0.45rem;
  padding: 1.25rem;
  color: #cbd5e1;
  text-align: center;
}

.output-preview__state strong {
  color: #f8fafc;
  font-size: 0.95rem;
}

.output-preview__state span {
  color: #94a3b8;
  font-size: 0.8rem;
  line-height: 1.4;
}

.output-preview__icon {
  width: 2rem;
  height: 2rem;
  color: #38bdf8;
}

.output-preview__icon--spinning {
  animation: output-spin 900ms linear infinite;
}

.output-progress {
  display: grid;
  gap: 0.45rem;
}

.output-progress__meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: var(--ui-text-muted);
  font-size: 0.78rem;
}

.output-progress__track {
  height: 0.55rem;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-border) 62%, transparent);
}

.output-progress__bar {
  height: 100%;
  border-radius: inherit;
  background: var(--ui-primary);
  transition: width 180ms ease;
}

.output-summary {
  display: grid;
  gap: 0.1rem;
  padding: 0.35rem 0;
}

.output-summary__item {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border) 72%, transparent);
  font-size: 0.8rem;
}

.output-summary__item span {
  color: var(--ui-text-muted);
}

.output-summary__item strong {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-text-highlighted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes output-spin {
  to {
    rotate: 360deg;
  }
}
</style>
