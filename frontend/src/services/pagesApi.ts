import { apiJson } from './httpClient'
import type { Page, PageRequest } from '@/types'

/**
 * Bulk load all pages owned by the authenticated user across all notebooks.
 * Used to hydrate the notesStore on app startup.
 */
export async function listAllPages(): Promise<Page[]> {
  return apiJson<Page[]>('/api/pages', { method: 'GET' })
}

/**
 * List all pages within a specific notebook.
 * @param notebookId - UUID of the notebook to query
 */
export async function listPagesForNotebook(notebookId: string): Promise<Page[]> {
  return apiJson<Page[]>(`/api/notebooks/${notebookId}/pages`, { method: 'GET' })
}

/**
 * Create a new page within a notebook.
 * @param notebookId - UUID of the parent notebook
 * @param request - Page creation request (title, content, optional parentId/boxes)
 */
export async function createPage(notebookId: string, request: PageRequest): Promise<Page> {
  return apiJson<Page>(`/api/notebooks/${notebookId}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}

/**
 * Update an existing page.
 * @param id - UUID of the page to update
 * @param request - Page update request (title, content, boxes, parentId, order)
 */
export async function updatePage(id: string, request: PageRequest): Promise<Page> {
  return apiJson<Page>(`/api/pages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}

/**
 * Delete a page.
 * @param id - UUID of the page to delete
 */
export async function deletePage(id: string): Promise<void> {
  await apiJson<void>(`/api/pages/${id}`, { method: 'DELETE' })
}
