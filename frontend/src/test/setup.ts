import { vi } from 'vitest'
import type { Notebook, Page, PageRequest, NotebookRequest } from '@/types'

// Node's experimental global `localStorage` can shadow jsdom's and lacks the
// Storage methods when it has no backing file, so install a plain in-memory one.
if (typeof globalThis.localStorage?.clear !== 'function') {
  const data = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value))
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
}

// In-memory stand-in for the REST backend so store/component tests never
// perform real network requests.
vi.mock('@/services/notebooksApi', () => ({
  listNotebooks: async (): Promise<Notebook[]> => [],
  createNotebook: async (request: NotebookRequest): Promise<Notebook> => ({
    id: crypto.randomUUID(),
    ...request
  }),
  updateNotebook: async (id: string, request: NotebookRequest): Promise<Notebook> => ({
    id,
    ...request
  }),
  deleteNotebook: async (): Promise<void> => undefined,
  uploadNotebookPdf: async (id: string): Promise<Notebook> => ({ id, title: '', color: '' }),
  removeNotebookPdf: async (id: string): Promise<Notebook> => ({ id, title: '', color: '' })
}))

vi.mock('@/services/pagesApi', () => ({
  listAllPages: async (): Promise<Page[]> => [],
  listPagesForNotebook: async (): Promise<Page[]> => [],
  createPage: async (notebookId: string, request: PageRequest): Promise<Page> => ({
    id: crypto.randomUUID(),
    notebookId,
    parentId: request.parentId ?? null,
    title: request.title,
    content: request.content,
    boxes: [],
    images: [],
    order: request.order ?? 0
  }),
  updatePage: async (id: string, request: PageRequest): Promise<Page> => ({
    id,
    notebookId: '',
    parentId: request.parentId ?? null,
    title: request.title,
    content: request.content,
    boxes: (request.boxes ?? []).map((box) => ({
      ...box,
      id: box.id ?? crypto.randomUUID(),
      references: box.references ?? []
    })) as Page['boxes'],
    images: [],
    order: request.order ?? 0
  }),
  deletePage: async (): Promise<void> => undefined,
  uploadPageImage: async () => {
    throw new Error('not available in tests')
  },
  fetchPageImage: async () => new Blob()
}))
