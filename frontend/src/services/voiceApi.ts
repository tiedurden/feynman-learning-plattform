import type { VoiceChatResponse } from '@/types'

/**
 * Client for the Feynman backend voice chat API.
 *
 * The base URL is configurable via `VITE_API_BASE_URL`; by default it is empty
 * so requests hit the Vite dev proxy (`/api → http://localhost:8080`).
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/**
 * Send a recorded explanation (audio) plus the reference note text to the
 * backend, which asks OpenAI to compare them and reply with spoken feedback.
 */
export async function sendVoiceMessage(
  audioBlob: Blob,
  noteText: string
): Promise<VoiceChatResponse> {
  const formData = new FormData()
  formData.append('audio', audioBlob)
  formData.append('noteText', noteText)

  const res = await fetch(`${API_BASE_URL}/api/voice/chat`, {
    method: 'POST',
    body: formData
  })

  if (!res.ok) {
    throw new Error(`Voice chat request failed: ${res.status} ${res.statusText}`)
  }

  return (await res.json()) as VoiceChatResponse
}
