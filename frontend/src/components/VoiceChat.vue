<script setup lang="ts">
/**
 * Hold-to-record voice explanation. Records a short clip, sends it plus the
 * note's reference text to the backend, then plays back the tutor's spoken
 * reply and shows the transcript.
 */
import { ref, onBeforeUnmount } from 'vue'
import { sendVoiceMessage } from '@/services/voiceApi'

const props = defineProps<{
  noteText: string
}>()

type Status = 'idle' | 'recording' | 'loading'

const status = ref<Status>('idle')
const userTranscript = ref('')
const transcript = ref('')
const error = ref<string | null>(null)
const recordingSeconds = ref(0)

let mediaRecorder: MediaRecorder | null = null
let chunks: BlobPart[] = []
let stream: MediaStream | null = null
let timerId: ReturnType<typeof setInterval> | null = null

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Picks the first container format the browser can actually record.
function pickMimeType(): string {
  const candidates = ['audio/webm', 'audio/ogg', 'audio/mp4']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

async function startRecording() {
  if (status.value !== 'idle') return
  error.value = null
  userTranscript.value = ''
  transcript.value = ''

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = pickMimeType()
    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    chunks = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    mediaRecorder.onstop = onRecordingStopped

    mediaRecorder.start()
    status.value = 'recording'
    recordingSeconds.value = 0
    timerId = setInterval(() => {
      recordingSeconds.value += 1
    }, 1000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not access the microphone.'
    status.value = 'idle'
  }
}

function stopRecording() {
  if (status.value !== 'recording' || !mediaRecorder) return
  mediaRecorder.stop()
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  if (timerId !== null) {
    clearInterval(timerId)
    timerId = null
  }
}

async function onRecordingStopped() {
  status.value = 'loading'
  try {
    const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' })
    const result = await sendVoiceMessage(blob, props.noteText)
    userTranscript.value = result.userTranscript
    transcript.value = result.transcript
    new Audio(`data:audio/wav;base64,${result.audioData}`).play()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Voice chat request failed.'
  } finally {
    status.value = 'idle'
  }
}

onBeforeUnmount(() => {
  stream?.getTracks().forEach((track) => track.stop())
  if (timerId !== null) clearInterval(timerId)
})
</script>

<template>
  <div class="voice-chat">
    <button
      type="button"
      class="record-btn"
      :class="{ recording: status === 'recording' }"
      :disabled="status === 'loading'"
      @mousedown="startRecording"
      @mouseup="stopRecording"
      @mouseleave="stopRecording"
      @touchstart.prevent="startRecording"
      @touchend.prevent="stopRecording"
    >
      <span v-if="status === 'loading'" class="spinner" />
      <span v-else-if="status === 'recording'">● Recording…</span>
      <span v-else>🎤 Hold to explain</span>
    </button>

    <!-- Prominent page-level indicator, not just the button's own label -->
    <div v-if="status === 'recording'" class="recording-indicator">
      <span class="pulse-dot" />
      <span>Recording {{ formatDuration(recordingSeconds) }}</span>
    </div>

    <p v-if="error" class="voice-error">{{ error }}</p>

    <div v-if="userTranscript || transcript" class="voice-dialog">
      <p v-if="userTranscript" class="voice-bubble voice-bubble-user">
        <span class="voice-bubble-label">You said</span>
        {{ userTranscript }}
      </p>
      <p v-if="transcript" class="voice-bubble voice-bubble-tutor">
        <span class="voice-bubble-label">Tutor</span>
        {{ transcript }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.voice-chat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.record-btn {
  align-self: flex-start;
  padding: 8px 16px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--editor-bg);
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.record-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.record-btn.recording {
  background: var(--accent);
  color: #fff;
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #a4262c;
}

.pulse-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #a4262c;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.4);
    opacity: 0.5;
  }
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.voice-error {
  color: #a4262c;
  font-size: 12px;
  margin: 0;
}

.voice-dialog {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voice-bubble {
  margin: 0;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.4;
  white-space: pre-wrap;
  max-width: 90%;
}

.voice-bubble-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 2px;
  opacity: 0.7;
}

.voice-bubble-user {
  align-self: flex-end;
  background: var(--active);
  color: var(--text);
}

.voice-bubble-tutor {
  align-self: flex-start;
  background: var(--hover);
  color: var(--text);
}
</style>
