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

  describe('link-type tabs', () => {
    it('shows the Page tab first and selected by default', async () => {
      const wrapper = await openModal({ initialText: 'X' })
      const tabs = document.querySelectorAll('.kind-tab')
      expect(tabs[0].textContent).toContain('Page')
      expect(tabs[0].classList.contains('active')).toBe(true)
      expect(tabs[1].textContent).toContain('Web')
      wrapper.unmount()
    })

    it('confirms a web link with a normalized URL payload', async () => {
      const wrapper = await openModal({ initialText: 'Google' })
      // Switch to the Web URL tab (second tab).
      ;(document.querySelectorAll('.kind-tab')[1] as HTMLElement).click()
      await wrapper.vm.$nextTick()

      const url = document.querySelector(
        'input[placeholder="https://example.com"]'
      ) as HTMLInputElement
      url.value = 'example.com'
      url.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const submit = document.querySelectorAll('.dialog-actions .btn')[1] as HTMLButtonElement
      expect(submit.disabled).toBe(false)
      submit.click()

      expect(wrapper.emitted('confirm')![0][0]).toEqual({
        linkText: 'Google',
        url: 'https://example.com'
      })
      wrapper.unmount()
    })

    it('pre-fills the URL field in web edit mode and re-emits it', async () => {
      const wrapper = await openModal({
        initialText: 'Anchor',
        mode: 'edit',
        initialKind: 'web',
        initialUrl: 'https://a.com'
      })

      const url = document.querySelector(
        'input[placeholder="https://example.com"]'
      ) as HTMLInputElement
      expect(url.value).toBe('https://a.com')

      const submit = document.querySelectorAll('.dialog-actions .btn')[1] as HTMLButtonElement
      expect(submit.disabled).toBe(false)
      submit.click()

      expect(wrapper.emitted('confirm')![0][0]).toEqual({
        linkText: 'Anchor',
        url: 'https://a.com'
      })
      wrapper.unmount()
    })
  })
})

