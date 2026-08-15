import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import NoteEditor from '@/components/NoteEditor.vue'
import TextBoxItem from '@/components/TextBoxItem.vue'
import { useNotesStore } from '@/stores/notesStore'
import type { Page } from '@/types'

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useNotesStore()
  const nb = store.addNotebook('Test NB')
  const page = store.addPage(nb.id, null, 'Test Page')
  return { pinia, store, page }
}

function mountEditor(page: Page | undefined, pinia = createPinia()) {
  return mount(NoteEditor, {
    props: { page },
    global: { plugins: [pinia] },
    attachTo: document.body
  })
}

describe('NoteEditor — text box behaviour', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates a draft box when the canvas is clicked', async () => {
    const { pinia, store, page } = setup()
    const wrapper = mountEditor(page, pinia)

    expect(wrapper.findComponent(TextBoxItem).exists()).toBe(false)

    await wrapper.get('.canvas').trigger('mousedown')

    const boxes = wrapper.findAllComponents(TextBoxItem)
    expect(boxes).toHaveLength(1)
    expect(boxes[0].props('isDraft')).toBe(true)
    // Not persisted until it has text.
    expect(store.pageById(page.id)!.boxes).toHaveLength(0)
    wrapper.unmount()
  })

  it('calls preventDefault on canvas mousedown (keeps focus on the new box)', async () => {
    const { pinia, page } = setup()
    const wrapper = mountEditor(page, pinia)

    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    wrapper.get('.canvas').element.dispatchEvent(event)
    await nextTick()

    expect(event.defaultPrevented).toBe(true)
    wrapper.unmount()
  })

  it('persists a draft that has text when it blurs', async () => {
    const { pinia, store, page } = setup()
    const wrapper = mountEditor(page, pinia)

    await wrapper.get('.canvas').trigger('mousedown')
    const textarea = wrapper.get('textarea')
    await textarea.setValue('Buy milk')
    await textarea.trigger('blur')

    const saved = store.pageById(page.id)!.boxes
    expect(saved).toHaveLength(1)
    expect(saved[0].text).toBe('Buy milk')
    wrapper.unmount()
  })

  it('discards an empty draft on blur', async () => {
    const { pinia, store, page } = setup()
    const wrapper = mountEditor(page, pinia)

    await wrapper.get('.canvas').trigger('mousedown')
    await wrapper.get('textarea').trigger('blur')

    expect(store.pageById(page.id)!.boxes).toHaveLength(0)
    expect(wrapper.findComponent(TextBoxItem).exists()).toBe(false)
    wrapper.unmount()
  })

  it('treats a whitespace-only draft as empty', async () => {
    const { pinia, store, page } = setup()
    const wrapper = mountEditor(page, pinia)

    await wrapper.get('.canvas').trigger('mousedown')
    const textarea = wrapper.get('textarea')
    await textarea.setValue('   ')
    await textarea.trigger('blur')

    expect(store.pageById(page.id)!.boxes).toHaveLength(0)
    wrapper.unmount()
  })

  it('prunes a previous empty draft when creating a new one', async () => {
    const { pinia, page } = setup()
    const wrapper = mountEditor(page, pinia)

    await wrapper.get('.canvas').trigger('mousedown')
    await wrapper.get('.canvas').trigger('mousedown')

    // Old empty draft pruned, only the newest remains.
    expect(wrapper.findAllComponents(TextBoxItem)).toHaveLength(1)
    wrapper.unmount()
  })

  it('updates the store when a saved box is edited', async () => {
    const { pinia, store, page } = setup()
    store.addTextBox(page.id, { x: 10, y: 10, text: 'Old' })
    const wrapper = mountEditor(page, pinia)

    // Saved boxes start in display mode — click to reveal the textarea.
    await wrapper.get('.text-display').trigger('click')
    const textarea = wrapper.get('textarea')
    await textarea.setValue('New text')

    expect(store.pageById(page.id)!.boxes[0].text).toBe('New text')
    wrapper.unmount()
  })

  it('deletes a saved box when it is emptied', async () => {
    const { pinia, store, page } = setup()
    store.addTextBox(page.id, { x: 10, y: 10, text: 'Old' })
    const wrapper = mountEditor(page, pinia)

    // Saved boxes start in display mode — click to reveal the textarea.
    await wrapper.get('.text-display').trigger('click')
    const textarea = wrapper.get('textarea')
    await textarea.setValue('')
    await textarea.trigger('blur')

    expect(store.pageById(page.id)!.boxes).toHaveLength(0)
    wrapper.unmount()
  })

  it('clears drafts when the page changes', async () => {
    const { pinia, store, page } = setup()
    const other = store.addPage(page.notebookId, null, 'Other Page')
    const wrapper = mountEditor(page, pinia)

    await wrapper.get('.canvas').trigger('mousedown')
    expect(wrapper.findComponent(TextBoxItem).exists()).toBe(true)

    await wrapper.setProps({ page: other })
    expect(wrapper.findComponent(TextBoxItem).exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the placeholder and no canvas when no page is selected', () => {
    const wrapper = mountEditor(undefined)
    expect(wrapper.find('.placeholder').exists()).toBe(true)
    expect(wrapper.find('.canvas').exists()).toBe(false)
    wrapper.unmount()
  })
})

