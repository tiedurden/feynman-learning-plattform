import { apiFetch, apiJson } from './httpClient'
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

/**
 * Upload (or replace) the reference PDF of a notebook.
 *
 * Sent as `multipart/form-data` — the Content-Type header is deliberately not
 * set so the browser can add the multipart boundary itself.
 */
export async function uploadNotebookPdf(id: string, file: File): Promise<Notebook> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await apiFetch(`/api/notebooks/${id}/pdf`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    // The backend replies with an RFC 7807 ProblemDetail for invalid files.
    const problem = await res.json().catch(() => undefined)
    throw new Error(problem?.detail ?? `PDF upload failed: ${res.status} ${res.statusText}`)
  }

  return (await res.json()) as Notebook
}

/** Remove the reference PDF previously uploaded for a notebook. */
export async function removeNotebookPdf(id: string): Promise<Notebook> {
  return apiJson<Notebook>(`/api/notebooks/${id}/pdf`, { method: 'DELETE' })
}

