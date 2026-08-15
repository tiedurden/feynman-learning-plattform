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

  it('renders drafts directly in edit mode (textarea) with a placeholder', () => {
    const draft = mount(TextBoxItem, { props: { ...baseProps, isDraft: true } })
    const textarea = draft.get('textarea')
    expect(textarea.attributes('placeholder')).toBe('Type here…')
    expect(textarea.classes()).toContain('is-draft')
    expect(draft.find('.drag-handle').exists()).toBe(false)
  })

  it('renders saved boxes in display mode (no textarea until clicked)', async () => {
    const wrapper = mount(TextBoxItem, { props: baseProps })
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.get('.text-display').text()).toBe('Hello')

    await wrapper.get('.text-display').trigger('click')
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('renders a drag handle for saved boxes and emits drag-start on mousedown', async () => {
    const wrapper = mount(TextBoxItem, { props: baseProps })
    const handle = wrapper.get('.drag-handle')
    await handle.trigger('mousedown')
    expect(wrapper.emitted('drag-start')).toHaveLength(1)
    expect(wrapper.emitted('drag-start')![0][0]).toBeInstanceOf(MouseEvent)
  })

  it('emits update:text on input while editing', async () => {
    const wrapper = mount(TextBoxItem, { props: baseProps })
    await wrapper.get('.text-display').trigger('click')
    const textarea = wrapper.get('textarea')
    await textarea.setValue('Changed')
    expect(wrapper.emitted('update:text')).toBeTruthy()
    expect(wrapper.emitted('update:text')!.at(-1)).toEqual(['Changed'])
  })

  it('emits blur when the textarea blurs', async () => {
    const wrapper = mount(TextBoxItem, { props: { ...baseProps, isDraft: true } })
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

  describe('inline references', () => {
    const refProps = {
      offsetXInPixels: 0,
      offsetYInPixels: 0,
      text: 'See Napoleon here',
      references: [{ id: 'ref-1', start: 4, end: 12, targetPageId: 'pg-napoleon' }]
    }

    it('renders linked ranges as .ref-link and plain text around them', () => {
      const wrapper = mount(TextBoxItem, { props: refProps })
      const link = wrapper.get('.ref-link')
      expect(link.text()).toBe('Napoleon')
      expect(wrapper.get('.text-display').text()).toBe('See Napoleon here')
    })

    it('emits ref-click with the target page id when a link is clicked', async () => {
      const wrapper = mount(TextBoxItem, { props: refProps })
      await wrapper.get('.ref-link').trigger('click')
      expect(wrapper.emitted('ref-click')).toBeTruthy()
      expect(wrapper.emitted('ref-click')![0]).toEqual(['pg-napoleon'])
    })

    it('emits ref-hover with the target and a rect on mouseenter', async () => {
      const wrapper = mount(TextBoxItem, { props: refProps })
      await wrapper.get('.ref-link').trigger('mouseenter')
      const payload = wrapper.emitted('ref-hover')![0][0] as {
        targetPageId: string
        rect: DOMRect
      }
      expect(payload.targetPageId).toBe('pg-napoleon')
      expect(payload.rect).toBeDefined()
    })

    it('emits request-link-menu on right-click of a link', async () => {
      const wrapper = mount(TextBoxItem, { props: refProps })
      await wrapper.get('.ref-link').trigger('contextmenu')
      const payload = wrapper.emitted('request-link-menu')![0][0] as {
        referenceId: string
      }
      expect(payload.referenceId).toBe('ref-1')
    })

    it('does not enter edit mode when a link is clicked', async () => {
      const wrapper = mount(TextBoxItem, { props: refProps })
      await wrapper.get('.ref-link').trigger('click')
      expect(wrapper.find('textarea').exists()).toBe(false)
    })
  })

  describe('create-link request', () => {
    it('emits request-link with the current selection offsets on contextmenu', async () => {
      const wrapper = mount(TextBoxItem, {
        props: { ...baseProps, text: 'See Napoleon here' },
        attachTo: document.body
      })
      // Enter edit mode to expose the textarea.
      await wrapper.get('.text-display').trigger('click')
      const textarea = wrapper.get('textarea')
      const el = textarea.element as HTMLTextAreaElement
      el.setSelectionRange(4, 12) // "Napoleon"

      await textarea.trigger('contextmenu')

      const payload = wrapper.emitted('request-link')![0][0] as {
        start: number
        end: number
      }
      expect(payload.start).toBe(4)
      expect(payload.end).toBe(12)
      wrapper.unmount()
    })

    it('does not emit request-link when there is no selection', async () => {
      const wrapper = mount(TextBoxItem, {
        props: { ...baseProps, text: 'Hello' },
        attachTo: document.body
      })
      await wrapper.get('.text-display').trigger('click')
      const textarea = wrapper.get('textarea')
      ;(textarea.element as HTMLTextAreaElement).setSelectionRange(3, 3)

      await textarea.trigger('contextmenu')

      expect(wrapper.emitted('request-link')).toBeFalsy()
      wrapper.unmount()
    })
  })
})


