import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

// Teleport targets <body>; query the document to find dialog content.
function mountDialog(props: Record<string, unknown> = {}) {
  return mount(ConfirmDialog, {
    props: { open: true, ...props },
    attachTo: document.body
  })
}

describe('ConfirmDialog', () => {
  it('does not render when closed', () => {
    const wrapper = mount(ConfirmDialog, { props: { open: false } })
    expect(document.querySelector('.overlay')).toBeNull()
    wrapper.unmount()
  })

  it('renders title and message when open', () => {
    const wrapper = mountDialog({ title: 'Delete notebook?', message: 'Are you sure?' })
    expect(document.querySelector('.dialog-title')!.textContent).toBe('Delete notebook?')
    expect(document.querySelector('.dialog-message')!.textContent).toBe('Are you sure?')
    wrapper.unmount()
  })

  it('omits the message paragraph when message is empty', () => {
    const wrapper = mountDialog({ message: '' })
    expect(document.querySelector('.dialog-message')).toBeNull()
    wrapper.unmount()
  })

  it('uses custom confirm/cancel labels', () => {
    const wrapper = mountDialog({ confirmLabel: 'Delete', cancelLabel: 'Keep' })
    const buttons = document.querySelectorAll('.dialog-actions .btn')
    expect(buttons[0].textContent!.trim()).toBe('Keep')
    expect(buttons[1].textContent!.trim()).toBe('Delete')
    wrapper.unmount()
  })

  it('applies the danger class to the confirm button when danger is set', () => {
    const wrapper = mountDialog({ danger: true })
    expect(document.querySelector('.dialog-actions .btn-danger')).not.toBeNull()
    expect(document.querySelector('.dialog-actions .btn-primary')).toBeNull()
    wrapper.unmount()
  })

  it('applies the primary class by default (non-danger)', () => {
    const wrapper = mountDialog()
    expect(document.querySelector('.dialog-actions .btn-primary')).not.toBeNull()
    expect(document.querySelector('.dialog-actions .btn-danger')).toBeNull()
    wrapper.unmount()
  })

  it('emits confirm when the confirm button is clicked', async () => {
    const wrapper = mountDialog()
    const confirmBtn = document.querySelectorAll('.dialog-actions .btn')[1] as HTMLButtonElement
    confirmBtn.click()
    await nextTick()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mountDialog()
    const cancelBtn = document.querySelectorAll('.dialog-actions .btn')[0] as HTMLButtonElement
    cancelBtn.click()
    await nextTick()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits cancel when clicking the backdrop', async () => {
    const wrapper = mountDialog()
    const overlay = document.querySelector('.overlay') as HTMLElement
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    wrapper.unmount()
  })

  it('does not emit cancel when clicking inside the dialog card', async () => {
    const wrapper = mountDialog()
    const dialog = document.querySelector('.dialog') as HTMLElement
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('cancel')).toBeUndefined()
    wrapper.unmount()
  })

  it('emits cancel on Escape keydown while open', async () => {
    const wrapper = mountDialog()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    wrapper.unmount()
  })

  it('ignores Escape when closed', async () => {
    const wrapper = mount(ConfirmDialog, { props: { open: false }, attachTo: document.body })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.emitted('cancel')).toBeUndefined()
    wrapper.unmount()
  })

  it('autofocuses the confirm button when opened', async () => {
    const wrapper = mount(ConfirmDialog, { props: { open: false }, attachTo: document.body })
    await wrapper.setProps({ open: true })
    await nextTick()
    await nextTick()
    const confirmBtn = document.querySelectorAll('.dialog-actions .btn')[1] as HTMLButtonElement
    expect(document.activeElement).toBe(confirmBtn)
    wrapper.unmount()
  })
})

