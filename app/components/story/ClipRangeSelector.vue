<script setup lang="ts">
type HandleKind = 'start' | 'end'

const props = defineProps<{
  duration?: number
  start: number
  end: number
  currentTime: number
  disabled?: boolean
  formatTime: (value?: number) => string
}>()

const emit = defineEmits<{
  'update:start': [value: number]
  'update:end': [value: number]
  'preview-time': [value: number]
}>()

const track = useTemplateRef<HTMLElement>('track')
const activeHandle = shallowRef<HandleKind | null>(null)
const startText = shallowRef('')
const endText = shallowRef('')

const minGap = 0.25
const safeDuration = computed(() => Math.max(props.duration ?? 0, minGap))
const selectedDuration = computed(() => Math.max(0, props.end - props.start))
const startPercent = computed(() => toPercent(props.start))
const endPercent = computed(() => toPercent(props.end))
const playheadPercent = computed(() => toPercent(props.currentTime))
const previewTime = computed(() => activeHandle.value === 'end' ? props.end : props.start)

watch(() => props.start, (value) => {
  startText.value = props.formatTime(value)
}, { immediate: true })

watch(() => props.end, (value) => {
  endText.value = props.formatTime(value)
}, { immediate: true })

function toPercent(value: number) {
  return `${Math.min(100, Math.max(0, (value / safeDuration.value) * 100))}%`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundTime(value: number) {
  return Number(value.toFixed(2))
}

function parseTimestamp(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed)
  }

  const parts = trimmed.split(':').map(part => Number(part))
  if (parts.some(part => !Number.isFinite(part)) || parts.length > 3) {
    return null
  }

  if (parts.length === 2) {
    const [minutes = 0, seconds = 0] = parts
    return minutes * 60 + seconds
  }

  if (parts.length === 3) {
    const [hours = 0, minutes = 0, seconds = 0] = parts
    return hours * 3600 + minutes * 60 + seconds
  }

  return null
}

function timeFromPointer(event: PointerEvent) {
  const rect = track.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) {
    return 0
  }

  const percent = clamp((event.clientX - rect.left) / rect.width, 0, 1)
  return roundTime(percent * safeDuration.value)
}

function updateHandle(kind: HandleKind, value: number) {
  if (kind === 'start') {
    const nextStart = roundTime(clamp(value, 0, Math.max(0, props.end - minGap)))
    emit('update:start', nextStart)
    emit('preview-time', nextStart)
    return
  }

  const nextEnd = roundTime(clamp(value, Math.min(safeDuration.value, props.start + minGap), safeDuration.value))
  emit('update:end', nextEnd)
  emit('preview-time', nextEnd)
}

function pickNearestHandle(time: number): HandleKind {
  return Math.abs(time - props.start) <= Math.abs(time - props.end) ? 'start' : 'end'
}

function startDrag(event: PointerEvent, kind?: HandleKind) {
  if (props.disabled) {
    return
  }

  const time = timeFromPointer(event)
  const nextHandle = kind ?? pickNearestHandle(time)
  activeHandle.value = nextHandle
  updateHandle(nextHandle, time)

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopDrag, { once: true })
}

function handlePointerMove(event: PointerEvent) {
  if (!activeHandle.value) {
    return
  }

  updateHandle(activeHandle.value, timeFromPointer(event))
}

function stopDrag() {
  activeHandle.value = null
  window.removeEventListener('pointermove', handlePointerMove)
}

function commitText(kind: HandleKind) {
  const value = parseTimestamp(kind === 'start' ? startText.value : endText.value)
  if (value === null) {
    if (kind === 'start') {
      startText.value = props.formatTime(props.start)
      return
    }

    endText.value = props.formatTime(props.end)
    return
  }

  updateHandle(kind, value)
}

function nudge(kind: HandleKind, amount: number) {
  updateHandle(kind, (kind === 'start' ? props.start : props.end) + amount)
}
</script>

<template>
  <section class="clip-range">
    <div class="clip-range__head">
      <div>
        <p class="clip-range__eyebrow">
          Clip selector
        </p>
        <h3 class="clip-range__title">
          Drag the range to choose the part you like
        </h3>
      </div>

      <UBadge
        color="primary"
        variant="soft"
        icon="i-lucide-clock"
      >
        {{ props.formatTime(selectedDuration) }} selected
      </UBadge>
    </div>

    <div
      ref="track"
      class="clip-range__track"
      :class="{ 'clip-range__track--disabled': props.disabled }"
      @pointerdown="startDrag($event)"
    >
      <div class="clip-range__rail" />
      <div
        class="clip-range__selection"
        :style="{ left: startPercent, width: `calc(${endPercent} - ${startPercent})` }"
      />
      <div
        class="clip-range__playhead"
        :style="{ left: playheadPercent }"
      />

      <button
        class="clip-range__handle clip-range__handle--start"
        type="button"
        aria-label="Drag clip start"
        :style="{ left: startPercent }"
        :disabled="props.disabled"
        @pointerdown.stop="startDrag($event, 'start')"
        @keydown.left.prevent="nudge('start', -1)"
        @keydown.right.prevent="nudge('start', 1)"
      />

      <button
        class="clip-range__handle clip-range__handle--end"
        type="button"
        aria-label="Drag clip end"
        :style="{ left: endPercent }"
        :disabled="props.disabled"
        @pointerdown.stop="startDrag($event, 'end')"
        @keydown.left.prevent="nudge('end', -1)"
        @keydown.right.prevent="nudge('end', 1)"
      />

      <div
        v-if="activeHandle"
        class="clip-range__preview"
        :style="{ left: activeHandle === 'end' ? endPercent : startPercent }"
      >
        <UIcon name="i-lucide-image" />
        <span>{{ props.formatTime(previewTime) }}</span>
      </div>
    </div>

    <div class="clip-range__fields">
      <label class="clip-range__field">
        <span>Start</span>
        <input
          v-model="startText"
          class="clip-range__input"
          inputmode="numeric"
          :disabled="props.disabled"
          @blur="commitText('start')"
          @keydown.enter.prevent="commitText('start')"
        >
      </label>

      <label class="clip-range__field">
        <span>End</span>
        <input
          v-model="endText"
          class="clip-range__input"
          inputmode="numeric"
          :disabled="props.disabled"
          @blur="commitText('end')"
          @keydown.enter.prevent="commitText('end')"
        >
      </label>
    </div>
  </section>
</template>

<style scoped>
.clip-range {
  display: grid;
  gap: 0.8rem;
  min-width: 0;
  padding: 0.9rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 78%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ui-bg-elevated) 88%, var(--ui-primary) 12%);
}

.clip-range__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.clip-range__eyebrow,
.clip-range__title {
  margin: 0;
}

.clip-range__eyebrow {
  color: var(--ui-primary);
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0;
  text-transform: uppercase;
}

.clip-range__title {
  margin-top: 0.15rem;
  color: var(--ui-text-highlighted);
  font-size: 1rem;
  font-weight: 850;
  letter-spacing: 0;
}

.clip-range__track {
  position: relative;
  height: 4.2rem;
  cursor: pointer;
  touch-action: none;
}

.clip-range__track--disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.clip-range__rail,
.clip-range__selection {
  position: absolute;
  top: 1.3rem;
  bottom: 1.05rem;
  border-radius: 8px;
}

.clip-range__rail {
  right: 0;
  left: 0;
  border: 1px solid var(--ui-border);
  background: color-mix(in srgb, var(--ui-bg) 88%, black 12%);
}

.clip-range__selection {
  border: 2px solid var(--ui-primary);
  background:
    repeating-linear-gradient(
      135deg,
      color-mix(in srgb, var(--ui-primary) 28%, transparent) 0 0.35rem,
      color-mix(in srgb, var(--ui-primary) 8%, transparent) 0.35rem 0.7rem
    ),
    color-mix(in srgb, var(--ui-primary) 16%, transparent);
}

.clip-range__playhead {
  position: absolute;
  top: 0.85rem;
  bottom: 0.65rem;
  width: 2px;
  border-radius: 999px;
  background: var(--ui-text-highlighted);
  opacity: 0.6;
  transform: translateX(-1px);
}

.clip-range__handle {
  position: absolute;
  top: 0.7rem;
  z-index: 2;
  display: grid;
  width: 1.35rem;
  height: 3rem;
  padding: 0;
  place-items: center;
  border: 2px solid color-mix(in srgb, var(--ui-primary) 80%, white 20%);
  border-radius: 999px;
  background: var(--ui-bg);
  box-shadow: 0 0.45rem 1.2rem rgba(0, 0, 0, 0.22);
  cursor: ew-resize;
  transform: translateX(-50%);
}

.clip-range__handle::after {
  content: "";
  width: 0.28rem;
  height: 1.4rem;
  border-radius: 999px;
  background: var(--ui-primary);
}

.clip-range__handle:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--ui-primary) 38%, transparent);
  outline-offset: 3px;
}

.clip-range__preview {
  position: absolute;
  top: -0.45rem;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--ui-primary) 60%, transparent);
  border-radius: 8px;
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  font-size: 0.78rem;
  font-weight: 850;
  transform: translate(-50%, -100%);
  white-space: nowrap;
}

.clip-range__fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.7rem;
}

.clip-range__field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  color: var(--ui-text-muted);
  font-size: 0.78rem;
  font-weight: 850;
  letter-spacing: 0;
  text-transform: uppercase;
}

.clip-range__input {
  width: 100%;
  min-width: 0;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  font: inherit;
  font-size: 1.05rem;
  font-weight: 850;
  letter-spacing: 0;
}

.clip-range__input:focus {
  border-color: var(--ui-primary);
  outline: 3px solid color-mix(in srgb, var(--ui-primary) 22%, transparent);
}

@media (max-width: 640px) {
  .clip-range__head,
  .clip-range__fields {
    grid-template-columns: 1fr;
  }

  .clip-range__head {
    display: grid;
  }
}
</style>
