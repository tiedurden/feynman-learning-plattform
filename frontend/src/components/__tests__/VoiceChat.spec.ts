import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import VoiceChat from '@/components/VoiceChat.vue'
import { sendVoiceMessage } from '@/services/voiceApi'
import type { VoiceHistoryMessage } from '@/types'

vi.mock('@/services/voiceApi', () => ({
  sendVoiceMessage: vi.fn()
}))

const mockedSend = vi.mocked(sendVoiceMessage)

/**
 * Minimal MediaRecorder stand-in: `stop()` synchronously fires `onstop`, which
 * is what triggers the backend request in the component.
 */
class FakeMediaRecorder {
  static isTypeSupported = () => true

  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  mimeType = 'audio/webm'

  start() {
    this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) })
  }

  stop() {
    this.onstop?.()
  }
}

function reply(n: number) {
  return {
    userTranscript: `learner ${n}`,
    transcript: `tutor ${n}`,
    audioData: ''
  }
}

/**
 * Performs one full hold-to-record gesture and waits for the request to settle.
 * Uses the real mousedown/mouseup path so `stopRecording` (and its timer
 * cleanup) is exercised rather than bypassed.
 */
async function record(wrapper: VueWrapper) {
  const button = wrapper.find('.record-btn')
  await button.trigger('mousedown')
  await flushPromises() // getUserMedia resolves, recorder starts
  await button.trigger('mouseup')
  await flushPromises() // sendVoiceMessage resolves
}

describe('VoiceChat', () => {
  beforeEach(() => {
    mockedSend.mockReset()

    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    // Patch only mediaDevices — replacing all of `navigator` breaks jsdom internals.
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
      configurable: true,
      writable: true
    })
    // jsdom has no audio stack; playback is irrelevant to the retention logic.
    vi.stubGlobal(
      'Audio',
      class {
        play = vi.fn().mockResolvedValue(undefined)
      }
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps previous turns when a new recording is made', async () => {
    mockedSend.mockResolvedValueOnce(reply(1)).mockResolvedValueOnce(reply(2))
    const wrapper = mount(VoiceChat, { props: { noteText: 'notes' } })

    await record(wrapper)
    await record(wrapper)

    const text = wrapper.text()
    expect(text).toContain('learner 1')
    expect(text).toContain('tutor 1')
    expect(text).toContain('learner 2')
    expect(text).toContain('tutor 2')
    expect(wrapper.findAll('.voice-bubble')).toHaveLength(4)
  })

  it('sends prior turns as history so the tutor keeps context', async () => {
    mockedSend.mockResolvedValueOnce(reply(1)).mockResolvedValueOnce(reply(2))
    const wrapper = mount(VoiceChat, { props: { noteText: 'notes' } })

    await record(wrapper)
    await record(wrapper)

    // First call starts cold, second replays the completed exchange.
    expect(mockedSend.mock.calls[0][2]).toEqual([])
    expect(mockedSend.mock.calls[1][2]).toEqual<VoiceHistoryMessage[]>([
      { role: 'user', text: 'learner 1' },
      { role: 'assistant', text: 'tutor 1' }
    ])
  })

  it('retains at most 10 exchanges, dropping the oldest', async () => {
    for (let i = 1; i <= 12; i++) {
      mockedSend.mockResolvedValueOnce(reply(i))
    }
    const wrapper = mount(VoiceChat, { props: { noteText: 'notes' } })

    for (let i = 0; i < 12; i++) {
      await record(wrapper)
    }

    expect(wrapper.findAll('.voice-bubble')).toHaveLength(20) // 10 turns x 2 bubbles
    // Turns 1 and 2 fell out of the window; 3-12 remain.
    expect(wrapper.text()).not.toContain('tutor 2')
    expect(wrapper.text()).toContain('tutor 3')
    expect(wrapper.text()).toContain('tutor 12')
  })

  it('clears the conversation on demand', async () => {
    mockedSend.mockResolvedValueOnce(reply(1))
    const wrapper = mount(VoiceChat, { props: { noteText: 'notes' } })

    await record(wrapper)
    expect(wrapper.findAll('.voice-bubble')).toHaveLength(2)

    await wrapper.find('.clear-btn').trigger('click')
    expect(wrapper.findAll('.voice-bubble')).toHaveLength(0)
    expect(wrapper.find('.voice-dialog').exists()).toBe(false)
  })

  it('keeps earlier turns visible when a request fails', async () => {
    mockedSend.mockResolvedValueOnce(reply(1)).mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(VoiceChat, { props: { noteText: 'notes' } })

    await record(wrapper)
    await record(wrapper)

    expect(wrapper.find('.voice-error').text()).toBe('boom')
    expect(wrapper.text()).toContain('tutor 1')
    expect(wrapper.findAll('.voice-bubble')).toHaveLength(2)
  })
})







