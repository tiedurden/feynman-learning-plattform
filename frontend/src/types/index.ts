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

/**
 * A free-floating text box placed on the page canvas (OneNote style).
 * Position is stored in pixels relative to the top-left of the canvas.
 * Empty boxes are never persisted — they live only as local drafts until
 * the user types something into them.
 */
export interface TextBox {
  id: string
  /** Horizontal offset in px from the canvas left edge. */
  x: number
  /** Vertical offset in px from the canvas top edge. */
  y: number
  text: string
  /** Optional authored width in px (auto if omitted). */
  width?: number
}

export interface Page {
  id: string
  notebookId: string
  /** null => top-level page directly under the notebook. */
  parentId: string | null
  title: string
  /** Editor body (plain text / HTML depending on editor implementation). */
  content: string
  /** Free-positioned text boxes placed on the page canvas. */
  boxes: TextBox[]
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

