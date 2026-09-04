import type { VoiceChatResponse, VoiceHistoryMessage } from '@/types'
import { apiFetch } from './httpClient'

/**
 * Client for the Feynman backend voice chat API.
 *
 * Requests are authenticated (bearer token) via {@link apiFetch}.
 */

/**
 * Send a recorded explanation (audio) plus the reference note text to the
 * backend, which asks OpenAI to compare them and reply with spoken feedback.
 *
 * @param history Previous turns of the session, so the tutor can follow up on
 *                what was already discussed instead of starting cold each time.
 */
export async function sendVoiceMessage(
  audioBlob: Blob,
  noteText: string,
  history: VoiceHistoryMessage[] = []
): Promise<VoiceChatResponse> {
  // A filename is required so the backend receives a well-formed file part
  // (and the extension keeps the format recognisable server-side).
  const extension = (audioBlob.type.split('/')[1] ?? 'webm').split(';')[0]

  const formData = new FormData()
  formData.append('audio', audioBlob, `recording.${extension}`)
  formData.append('noteText', noteText)
  if (history.length > 0) {
    formData.append('history', JSON.stringify(history))
  }

  const res = await apiFetch('/api/voice/chat', {
    method: 'POST',
    body: formData
  })

  if (!res.ok) {
    const problem = await res.json().catch(() => null)
    const detail = problem?.detail ?? `${res.status} ${res.statusText}`
    throw new Error(`Voice chat request failed: ${detail}`)
  }

  return (await res.json()) as VoiceChatResponse
}
