import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ReferenceModal from '@/components/ReferenceModal.vue'
import type { NotebookTree } from '@/types'

const notebookTrees: NotebookTree[] = [
  {
    notebook: { id: 'nb1', title: 'History', color: '#000000' },
    tree: [
      {
        id: 'pg1',
        notebookId: 'nb1',
        parentId: null,
        title: 'Napoleon',
        content: '',
        boxes: [],
        order: 0,
        children: []
      }
    ]
  }
]

describe('ReferenceModal', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  /** Mount then open (open must transition false→true to trigger the reset watch). */
  async function openModal(props: Record<string, unknown>) {
    const wrapper = mount(ReferenceModal, {
      props: { open: false, initialText: '', notebookTrees, ...props },
      attachTo: document.body
    })
    await wrapper.setProps({ open: true })
    return wrapper
  }

  it('shows create-mode title and label by default', async () => {
    const wrapper = await openModal({ initialText: 'Nap' })
    expect(document.querySelector('.dialog-title')?.textContent).toBe('Create link')
    const submit = document.querySelectorAll('.dialog-actions .btn')[1]
    expect(submit.textContent?.trim()).toBe('Create link')
    wrapper.unmount()
  })

  it('shows edit-mode title/label and pre-selects the target', async () => {
    const wrapper = await openModal({
      initialText: 'Napoleon',
      mode: 'edit',
      initialTargetPageId: 'pg1'
    })
    expect(document.querySelector('.dialog-title')?.textContent).toBe('Edit link')
    const submit = document.querySelectorAll('.dialog-actions .btn')[1] as HTMLButtonElement
    expect(submit.textContent?.trim()).toBe('Save link')
    // Pre-selected target means the confirm button is enabled immediately.
    expect(submit.disabled).toBe(false)
    wrapper.unmount()
  })

  it('disables confirm until a page is selected, then emits the payload', async () => {
    const wrapper = await openModal({ initialText: 'Nap' })
    const submit = document.querySelectorAll('.dialog-actions .btn')[1] as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    // Expand the notebook, then select the page.
    ;(document.querySelector('.nb-row') as HTMLElement).click()
    await wrapper.vm.$nextTick()
    ;(document.querySelector('.picker-item .row') as HTMLElement).click()
    await wrapper.vm.$nextTick()

    expect(submit.disabled).toBe(false)
    submit.click()

    const payload = wrapper.emitted('confirm')![0][0] as {
      linkText: string
      targetPageId: string
    }
    expect(payload).toEqual({ linkText: 'Nap', targetPageId: 'pg1' })
    wrapper.unmount()
  })

  it('emits cancel on Escape', async () => {
    const wrapper = await openModal({ initialText: 'Nap' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })
})

