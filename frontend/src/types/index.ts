/**
 * Core domain types for the OneNote-style notes app.
 *
 * Hierarchy:
 *   Notebook (1) ──< Page (many, tree via parentId)
 *
 *   Notebook { id, title, color, pages[] }
 *   Page     { id, notebookId, parentId|null, title, content, order }
 *
 * A Page self-references through `parentId` allowing unlimited nesting.
 * `children` is not stored on the raw Page — it is derived at runtime by the
 * store's tree-building helpers (see PageNode).
 */

export interface Notebook {
  id: string
  title: string
  /** Accent color used for the notebook chip / active state. */
  color: string
}

export interface Page {
  id: string
  notebookId: string
  /** null => top-level page directly under the notebook. */
  parentId: string | null
  title: string
  /** Editor body (plain text / HTML depending on editor implementation). */
  content: string
  /** Sort order among siblings. */
  order: number
}

/**
 * A Page enriched with its resolved children — the recursive shape consumed by
 * the PageTree / PageTreeItem components.
 */
export interface PageNode extends Page {
  children: PageNode[]
}

