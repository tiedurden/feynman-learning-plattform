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

  describe('link interaction', () => {
    afterEach(() => vi.restoreAllMocks())

    const pageLink = {
      ...baseProps,
      text: 'See <a class="page-link" data-page-id="pg-42">Napoleon</a>'
    }
    const webLink = { ...baseProps, text: '<a href="https://example.com">Example</a>' }

    it('navigates on a plain click of an internal page link', async () => {
      const wrapper = mount(TextBoxItem, { props: pageLink })
      await wrapper.get('a.page-link').trigger('click')

      expect(wrapper.emitted('navigate')).toEqual([['pg-42']])
    })

    it('dismisses the hover tooltip when a link is clicked', async () => {
      const wrapper = mount(TextBoxItem, { props: pageLink })
      await wrapper.get('a.page-link').trigger('click')

      // The last ref-hover emit clears the tooltip (null payload).
      expect(wrapper.emitted('ref-hover')!.at(-1)).toEqual([null])
    })

    it('emits ref-hover with the page id while hovering a page link', async () => {
      const wrapper = mount(TextBoxItem, { props: pageLink })
      await wrapper.get('a.page-link').trigger('pointerover')

      const payload = wrapper.emitted('ref-hover')!.at(-1)![0] as { pageId: string }
      expect(payload.pageId).toBe('pg-42')
    })

    it('clears ref-hover when the pointer leaves a page link', async () => {
      const wrapper = mount(TextBoxItem, { props: pageLink })
      await wrapper.get('a.page-link').trigger('pointerout')

      expect(wrapper.emitted('ref-hover')!.at(-1)).toEqual([null])
    })

    it('does not navigate on a plain click of an external link', async () => {
      const wrapper = mount(TextBoxItem, { props: webLink })
      await wrapper.get('a').trigger('click')

      expect(wrapper.emitted('navigate')).toBeUndefined()
    })

    it('opens external links in a new tab on Ctrl/Cmd-click', async () => {
      const open = vi.spyOn(window, 'open').mockImplementation(() => null)
      const wrapper = mount(TextBoxItem, { props: webLink })
      await wrapper.get('a').trigger('click', { ctrlKey: true })

      expect(open).toHaveBeenCalledWith(
        'https://example.com',
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('requests the link menu (not the format menu) on right-click of a link', async () => {
      const wrapper = mount(TextBoxItem, { props: pageLink })
      await wrapper.get('a.page-link').trigger('contextmenu', { clientX: 5, clientY: 6 })

      const payload = wrapper.emitted('request-link-menu')!.at(-1)![0] as {
        x: number
        y: number
        anchor: HTMLAnchorElement
      }
      expect(payload.x).toBe(5)
      expect(payload.y).toBe(6)
      expect(payload.anchor.getAttribute('data-page-id')).toBe('pg-42')
      // Does not also open the generic format menu.
      expect(wrapper.emitted('request-format')).toBeUndefined()
    })

    it('falls back to the format menu on right-click outside a link', async () => {
      const wrapper = mount(TextBoxItem, { props: baseProps })
      await wrapper.get('.text-box').trigger('contextmenu')

      expect(wrapper.emitted('request-format')).toHaveLength(1)
      expect(wrapper.emitted('request-link-menu')).toBeUndefined()
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


