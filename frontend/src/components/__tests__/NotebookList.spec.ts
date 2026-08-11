import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import NotebookList from '@/components/NotebookList.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { Notebook } from '@/types'

const notebooks: Notebook[] = [
  { id: 'nb-1', title: 'Work', color: '#7719aa' },
  { id: 'nb-2', title: 'Personal', color: '#0078d4' }
]

function mountList(props: Record<string, unknown> = {}) {
  return mount(NotebookList, {
    props: { notebooks, activeId: 'nb-1', ...props },
    attachTo: document.body
  })
}

describe('NotebookList', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders one item per notebook', () => {
    const wrapper = mountList()
    expect(wrapper.findAll('.item')).toHaveLength(2)
    wrapper.unmount()
  })

  it('emits select when an item is clicked', async () => {
    const wrapper = mountList()
    await wrapper.findAll('.item')[1].trigger('click')
    expect(wrapper.emitted('select')!.at(-1)).toEqual(['nb-2'])
    wrapper.unmount()
  })

  it('emits add when the header button is clicked', async () => {
    const wrapper = mountList()
    await wrapper.get('.icon-btn').trigger('click')
    expect(wrapper.emitted('add')).toHaveLength(1)
    wrapper.unmount()
  })

  // --- Rename -------------------------------------------------------------
  it('enters rename mode via the rename button and shows an input', async () => {
    const wrapper = mountList()
    await wrapper.findAll('.item')[0].get('.mini').trigger('click')
    const input = wrapper.get('.rename-input')
    expect((input.element as HTMLInputElement).value).toBe('Work')
    wrapper.unmount()
  })

  it('enters rename mode on double-click', async () => {
    const wrapper = mountList()
    await wrapper.findAll('.item')[0].trigger('dblclick')
    expect(wrapper.find('.rename-input').exists()).toBe(true)
    wrapper.unmount()
  })

  it('emits rename with the trimmed title on Enter', async () => {
    const wrapper = mountList()
    await wrapper.findAll('.item')[0].trigger('dblclick')
    const input = wrapper.get('.rename-input')
    await input.setValue('  Renamed  ')
    await input.trigger('keyup.enter')
    expect(wrapper.emitted('rename')!.at(-1)).toEqual(['nb-1', 'Renamed'])
    // Leaves edit mode.
    expect(wrapper.find('.rename-input').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not emit rename when the title is unchanged', async () => {
    const wrapper = mountList()
    await wrapper.findAll('.item')[0].trigger('dblclick')
    await wrapper.get('.rename-input').trigger('keyup.enter')
    expect(wrapper.emitted('rename')).toBeUndefined()
    wrapper.unmount()
  })

  it('does not emit rename for a blank title', async () => {
    const wrapper = mountList()
    await wrapper.findAll('.item')[0].trigger('dblclick')
    const input = wrapper.get('.rename-input')
    await input.setValue('   ')
    await input.trigger('keyup.enter')
    expect(wrapper.emitted('rename')).toBeUndefined()
    wrapper.unmount()
  })

  it('cancels rename on Escape without emitting', async () => {
    const wrapper = mountList()
    await wrapper.findAll('.item')[0].trigger('dblclick')
    const input = wrapper.get('.rename-input')
    await input.setValue('Changed')
    await input.trigger('keyup.esc')
    expect(wrapper.emitted('rename')).toBeUndefined()
    expect(wrapper.find('.rename-input').exists()).toBe(false)
    wrapper.unmount()
  })

  // --- Delete -------------------------------------------------------------
  it('opens the confirm dialog when the delete button is clicked', async () => {
    const wrapper = mountList()
    // Second .mini button in the item is the delete (danger) button.
    await wrapper.findAll('.item')[0].get('.mini.danger').trigger('click')
    expect(wrapper.findComponent(ConfirmDialog).props('open')).toBe(true)
    // Message mentions the notebook title.
    expect(document.querySelector('.dialog-message')!.textContent).toContain('Work')
    wrapper.unmount()
  })

  it('emits delete when the dialog is confirmed', async () => {
    const wrapper = mountList()
    await wrapper.findAll('.item')[0].get('.mini.danger').trigger('click')
    wrapper.findComponent(ConfirmDialog).vm.$emit('confirm')
    await nextTick()
    expect(wrapper.emitted('delete')!.at(-1)).toEqual(['nb-1'])
    // Dialog closes.
    expect(wrapper.findComponent(ConfirmDialog).props('open')).toBe(false)
    wrapper.unmount()
  })

  it('does not emit delete when the dialog is cancelled', async () => {
    const wrapper = mountList()
    await wrapper.findAll('.item')[0].get('.mini.danger').trigger('click')
    wrapper.findComponent(ConfirmDialog).vm.$emit('cancel')
    await nextTick()
    expect(wrapper.emitted('delete')).toBeUndefined()
    expect(wrapper.findComponent(ConfirmDialog).props('open')).toBe(false)
    wrapper.unmount()
  })
})

