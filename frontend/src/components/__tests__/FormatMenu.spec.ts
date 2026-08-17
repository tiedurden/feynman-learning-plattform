import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FormatMenu from '@/components/FormatMenu.vue'

// jsdom implements neither execCommand nor queryCommandState, so we stub them
// and assert against the spies. queryCommandState defaults to false unless a
// test overrides it (used for the active-state assertions below).
let execCommand: ReturnType<typeof vi.fn>
let queryCommandState: ReturnType<typeof vi.fn>

beforeEach(() => {
  execCommand = vi.fn().mockReturnValue(true)
  queryCommandState = vi.fn().mockReturnValue(false)
  // @ts-expect-error - not present in jsdom's Document typings
  document.execCommand = execCommand
  // @ts-expect-error - not present in jsdom's Document typings
  document.queryCommandState = queryCommandState
})

const props = { x: 100, y: 100 }

describe('FormatMenu', () => {
  describe('accessibility roles', () => {
    it('exposes a menu role with an accessible label', () => {
      const wrapper = mount(FormatMenu, { props })
      const menu = wrapper.get('[role="menu"]')
      expect(menu.attributes('aria-label')).toBe('Text formatting')
    })

    it('labels the inline-formatting group', () => {
      const wrapper = mount(FormatMenu, { props })
      const group = wrapper.get('[aria-label="Inline formatting"]')
      expect(group.attributes('role')).toBe('group')
    })

    it('marks list items with the menuitem role', () => {
      const wrapper = mount(FormatMenu, { props })
      expect(wrapper.findAll('[role="menuitem"]').length).toBeGreaterThan(0)
    })
  })

  describe('formatting commands', () => {
    it('runs the bold command and emits "applied" when Bold is clicked', async () => {
      const wrapper = mount(FormatMenu, { props })
      await wrapper.get('[aria-label="Bold"]').trigger('click')
      expect(execCommand).toHaveBeenCalledWith('bold', false, undefined)
      expect(wrapper.emitted('applied')).toBeTruthy()
    })

    it('forces CSS styling for colour commands', async () => {
      const wrapper = mount(FormatMenu, { props })
      await wrapper.get('[aria-label="No text colour"]').trigger('click')
      expect(execCommand).toHaveBeenCalledWith('styleWithCSS', false, 'true')
      expect(execCommand).toHaveBeenCalledWith('foreColor', false, '#242424')
    })

    it('applies a highlight colour via hiliteColor', async () => {
      const wrapper = mount(FormatMenu, { props })
      await wrapper.get('[aria-label="No highlight"]').trigger('click')
      expect(execCommand).toHaveBeenCalledWith('hiliteColor', false, 'transparent')
    })

    it('prompts for and normalises a link URL', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('example.com')
      const wrapper = mount(FormatMenu, { props })
      await wrapper.get('[title="Insert link (Ctrl+K)"]').trigger('click')
      expect(promptSpy).toHaveBeenCalled()
      expect(execCommand).toHaveBeenCalledWith('createLink', false, 'https://example.com')
    })
  })

  describe('active-state indicators', () => {
    it('reflects the current selection state via aria-pressed and .active', () => {
      queryCommandState.mockImplementation((cmd: string) => cmd === 'bold')
      const wrapper = mount(FormatMenu, { props })
      const bold = wrapper.get('[aria-label="Bold"]')
      expect(bold.attributes('aria-pressed')).toBe('true')
      expect(bold.classes()).toContain('active')

      const italic = wrapper.get('[aria-label="Italic"]')
      expect(italic.attributes('aria-pressed')).toBe('false')
      expect(italic.classes()).not.toContain('active')
    })
  })

  describe('keyboard shortcuts', () => {
    it('runs bold on Ctrl+B', () => {
      mount(FormatMenu, { props, attachTo: document.body })
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }))
      expect(execCommand).toHaveBeenCalledWith('bold', false, undefined)
    })

    it('runs strikethrough only with the Shift modifier on Ctrl+Shift+X', () => {
      mount(FormatMenu, { props, attachTo: document.body })
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', ctrlKey: true }))
      expect(execCommand).not.toHaveBeenCalledWith('strikeThrough', false, undefined)

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, shiftKey: true })
      )
      expect(execCommand).toHaveBeenCalledWith('strikeThrough', false, undefined)
    })

    it('emits "close" on Escape', () => {
      const wrapper = mount(FormatMenu, { props })
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('ignores shortcut keys without a modifier', () => {
      mount(FormatMenu, { props })
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))
      expect(execCommand).not.toHaveBeenCalledWith('bold', false, undefined)
    })
  })

  describe('selection preservation', () => {
    it('prevents default on mousedown so the selection is not stolen', async () => {
      const wrapper = mount(FormatMenu, { props })
      const event = new MouseEvent('mousedown', { cancelable: true, bubbles: true })
      wrapper.get('[role="menu"]').element.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    })
  })

  describe('lifecycle', () => {
    it('stops listening for selection changes after unmount', async () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener')
      const wrapper = mount(FormatMenu, { props })
      await nextTick()
      wrapper.unmount()
      expect(removeSpy).toHaveBeenCalledWith('selectionchange', expect.any(Function))
    })
  })
})

