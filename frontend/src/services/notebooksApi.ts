import { apiJson } from './httpClient'
import type { Notebook, NotebookRequest } from '@/types'

/** List all notebooks owned by the authenticated user. */
export async function listNotebooks(): Promise<Notebook[]> {
  return apiJson<Notebook[]>('/api/notebooks', { method: 'GET' })
}

/** Create a new notebook. */
export async function createNotebook(request: NotebookRequest): Promise<Notebook> {
  return apiJson<Notebook>('/api/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}

/** Update an existing notebook. */
export async function updateNotebook(id: string, request: NotebookRequest): Promise<Notebook> {
  return apiJson<Notebook>(`/api/notebooks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}

/** Delete a notebook. */
export async function deleteNotebook(id: string): Promise<void> {
  await apiJson<void>(`/api/notebooks/${id}`, { method: 'DELETE' })
}
