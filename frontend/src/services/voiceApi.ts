import type { VoiceChatResponse } from '@/types'
import { apiFetch } from './httpClient'

/**
 * Client for the Feynman backend voice chat API.
 *
 * Requests are authenticated (bearer token) via {@link apiFetch}.
 */

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

  const res = await apiFetch('/api/voice/chat', {
    method: 'POST',
    body: formData
  })

  if (!res.ok) {
    throw new Error(`Voice chat request failed: ${res.status} ${res.statusText}`)
  }

  return (await res.json()) as VoiceChatResponse
}
