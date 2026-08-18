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

  it('renders the (sanitized) prop HTML into the editable', () => {
    const wrapper = mount(TextBoxItem, {
      props: { ...baseProps, text: '<b>Bold</b> text' }
    })
    expect(wrapper.get('.text-box').element.innerHTML).toContain('<b>Bold</b>')
  })

  it('exposes a contenteditable textbox', () => {
    const wrapper = mount(TextBoxItem, { props: baseProps })
    const box = wrapper.get('.text-box')
    expect(box.attributes('contenteditable')).toBe('true')
    expect(box.attributes('role')).toBe('textbox')
  })

  describe('draft mode', () => {
    it('marks drafts with the is-draft class and a placeholder', () => {
      const draft = mount(TextBoxItem, {
        props: { ...baseProps, text: '', isDraft: true }
      })
      const box = draft.get('.text-box')
      expect(box.classes()).toContain('is-draft')
      expect(box.attributes('data-placeholder')).toBe('Type here…')
    })

    it('hides the drag handle for drafts', () => {
      const draft = mount(TextBoxItem, { props: { ...baseProps, isDraft: true } })
      expect(draft.find('.drag-handle').exists()).toBe(false)
    })

    it('shows a drag handle for saved boxes', () => {
      const wrapper = mount(TextBoxItem, { props: baseProps })
      expect(wrapper.find('.drag-handle').exists()).toBe(true)
    })
  })

  describe('events', () => {
    it('emits drag-start on drag-handle mousedown', async () => {
      const wrapper = mount(TextBoxItem, { props: baseProps })
      await wrapper.get('.drag-handle').trigger('mousedown')
      expect(wrapper.emitted('drag-start')).toHaveLength(1)
      expect(wrapper.emitted('drag-start')![0][0]).toBeInstanceOf(MouseEvent)
    })

    it('emits update:text with sanitized HTML on input', async () => {
      const wrapper = mount(TextBoxItem, { props: baseProps })
      const box = wrapper.get('.text-box')
      box.element.innerHTML = 'Changed'
      await box.trigger('input')
      expect(wrapper.emitted('update:text')).toBeTruthy()
      expect(wrapper.emitted('update:text')!.at(-1)).toEqual(['Changed'])
    })

    it('emits blur when the editable blurs', async () => {
      const wrapper = mount(TextBoxItem, { props: baseProps })
      await wrapper.get('.text-box').trigger('blur')
      expect(wrapper.emitted('blur')).toHaveLength(1)
    })

    it('emits request-format with the event on contextmenu', async () => {
      const wrapper = mount(TextBoxItem, { props: baseProps })
      await wrapper.get('.text-box').trigger('contextmenu')
      expect(wrapper.emitted('request-format')).toHaveLength(1)
      expect(wrapper.emitted('request-format')![0][0]).toBeInstanceOf(MouseEvent)
    })
  })

  describe('checkboxes', () => {
    it('mirrors a toggled checkbox onto the checked attribute and re-emits', async () => {
      const wrapper = mount(TextBoxItem, {
        props: {
          ...baseProps,
          text: '<span class="tick" contenteditable="false"><input type="checkbox"></span> task'
        }
      })
      const checkbox = wrapper.get('input[type="checkbox"]')
      const el = checkbox.element as HTMLInputElement
      el.checked = true
      await checkbox.trigger('change')

      expect(el.hasAttribute('checked')).toBe(true)
      const emitted = wrapper.emitted('update:text')
      expect(emitted).toBeTruthy()
      expect(emitted!.at(-1)![0] as string).toContain('checked')
    })
  })

  describe('focus behaviour', () => {
    it('focuses the editable on mount when focusOnMount is set', () => {
      const wrapper = mount(TextBoxItem, {
        props: { ...baseProps, text: '', isDraft: true, focusOnMount: true },
        attachTo: document.body
      })
      expect(document.activeElement).toBe(wrapper.get('.text-box').element)
      wrapper.unmount()
    })

    it('exposes a focus() method', () => {
      const wrapper = mount(TextBoxItem, {
        props: baseProps,
        attachTo: document.body
      })
      ;(wrapper.vm as unknown as { focus: () => void }).focus()
      expect(document.activeElement).toBe(wrapper.get('.text-box').element)
      wrapper.unmount()
    })
  })
})


