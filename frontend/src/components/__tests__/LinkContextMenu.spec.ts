import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LinkContextMenu from '@/components/LinkContextMenu.vue'

describe('LinkContextMenu', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  function makeItems() {
    return [
      { label: 'Edit link…', action: vi.fn() },
      { label: 'Remove link', danger: true, action: vi.fn() }
    ]
  }

  it('renders one button per item with danger styling', () => {
    const items = makeItems()
    const wrapper = mount(LinkContextMenu, {
      props: { x: 10, y: 20, items },
      attachTo: document.body
    })

    const buttons = document.querySelectorAll('.menu-item')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].textContent?.trim()).toBe('Edit link…')
    expect(buttons[1].classList.contains('danger')).toBe(true)
    wrapper.unmount()
  })

  it('runs an item action when clicked', async () => {
    const items = makeItems()
    const wrapper = mount(LinkContextMenu, {
      props: { x: 0, y: 0, items },
      attachTo: document.body
    })

    ;(document.querySelectorAll('.menu-item')[0] as HTMLElement).click()
    expect(items[0].action).toHaveBeenCalledTimes(1)
    expect(items[1].action).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('emits close on Escape', async () => {
    const wrapper = mount(LinkContextMenu, {
      props: { x: 0, y: 0, items: makeItems() },
      attachTo: document.body
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })

  it('emits close on an outside pointer down', () => {
    const wrapper = mount(LinkContextMenu, {
      props: { x: 0, y: 0, items: makeItems() },
      attachTo: document.body
    })

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })
})

