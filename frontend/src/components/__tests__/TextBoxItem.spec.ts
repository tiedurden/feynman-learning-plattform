import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TextBoxItem from '@/components/TextBoxItem.vue'

describe('TextBoxItem', () => {
  const baseProps = {
    offsetXInPixels: 40,
    offsetYInPixels: 120,
    text: 'Hello'
  }

  it('renders at the given position', () => {
    const wrapper = mount(TextBoxItem, {
      props: { ...baseProps, widthInPixels: 200 }
    })
    const style = wrapper.get('.box-wrap').attributes('style') ?? ''
    expect(style).toContain('left: 40px')
    expect(style).toContain('top: 120px')
    expect(style).toContain('width: 200px')
  })

  it('shows the draft placeholder only when isDraft', () => {
    const draft = mount(TextBoxItem, { props: { ...baseProps, isDraft: true } })
    expect(draft.get('textarea').attributes('placeholder')).toBe('Type here…')

    const saved = mount(TextBoxItem, { props: baseProps })
    expect(saved.get('textarea').attributes('placeholder')).toBe('')
  })

  it('applies the is-draft class and hides the drag handle for drafts', () => {
    const wrapper = mount(TextBoxItem, { props: { ...baseProps, isDraft: true } })
    expect(wrapper.get('textarea').classes()).toContain('is-draft')
    expect(wrapper.find('.drag-handle').exists()).toBe(false)
  })

  it('renders a drag handle for saved boxes and emits drag-start on mousedown', async () => {
    const wrapper = mount(TextBoxItem, { props: baseProps })
    const handle = wrapper.get('.drag-handle')
    await handle.trigger('mousedown')
    expect(wrapper.emitted('drag-start')).toHaveLength(1)
    expect(wrapper.emitted('drag-start')![0][0]).toBeInstanceOf(MouseEvent)
  })

  it('emits update:text on input', async () => {
    const wrapper = mount(TextBoxItem, { props: baseProps })
    const textarea = wrapper.get('textarea')
    await textarea.setValue('Changed')
    expect(wrapper.emitted('update:text')).toBeTruthy()
    expect(wrapper.emitted('update:text')!.at(-1)).toEqual(['Changed'])
  })

  it('emits blur when the textarea blurs', async () => {
    const wrapper = mount(TextBoxItem, { props: baseProps })
    await wrapper.get('textarea').trigger('blur')
    expect(wrapper.emitted('blur')).toHaveLength(1)
  })

  it('focuses the textarea on mount when focusOnMount is set', () => {
    const wrapper = mount(TextBoxItem, {
      props: { ...baseProps, isDraft: true, focusOnMount: true },
      attachTo: document.body
    })
    expect(document.activeElement).toBe(wrapper.get('textarea').element)
    wrapper.unmount()
  })

  it('does not steal focus without focusOnMount', () => {
    const wrapper = mount(TextBoxItem, {
      props: baseProps,
      attachTo: document.body
    })
    expect(document.activeElement).not.toBe(wrapper.get('textarea').element)
    wrapper.unmount()
  })

  it('sizes the textarea height to its content on mount', () => {
    const wrapper = mount(TextBoxItem, { props: baseProps, attachTo: document.body })
    // jsdom reports scrollHeight as 0, so we assert the mechanism ran (height set).
    expect(wrapper.get('textarea').element.style.height).toBe('0px')
    wrapper.unmount()
  })
})

