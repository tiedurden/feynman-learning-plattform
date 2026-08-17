import DOMPurify from 'dompurify'

/**
 * Central HTML sanitizer for rich-text note boxes.
 *
 * Text boxes store user-authored HTML (bold/italic/underline/colours/lists and
 * interactive tick boxes). That HTML is produced by `document.execCommand`, by
 * pasting, and by re-loading persisted content — all of which can smuggle in
 * unsafe markup. Everything that enters or leaves persistence is funnelled
 * through {@link sanitizeBoxHtml} so only a small, known-safe allowlist survives.
 *
 * The allowlist is intentionally tight: exactly the tags/attributes the
 * FormatMenu can generate, plus checkbox inputs for tick boxes. We rely on
 * DOMPurify's default (safe) configuration and never enable risky options
 * (IN_PLACE, USE_PROFILES, custom hooks, SAFE_FOR_TEMPLATES), and we never
 * re-parse the output inside raw-text wrappers — both being the preconditions
 * for the library's known bypass classes.
 */

/** Inline formatting + list/structure tags the editor may emit. */
const ALLOWED_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'br',
  'div',
  'p',
  'span',
  'font',
  'ul',
  'ol',
  'li',
  'input'
]

/**
 * Attributes we allow. `style`/`color` carry execCommand's colour + font-size
 * output; the checkbox attributes keep tick boxes interactive and persistable.
 */
const ALLOWED_ATTR = ['style', 'color', 'size', 'face', 'class', 'type', 'checked']

/**
 * Sanitize a rich-text HTML string down to the editor's safe allowlist.
 * Returns a plain string suitable for both `innerHTML` and persistence.
 */
export function sanitizeBoxHtml(dirty: string): string {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Tick boxes are `<input type="checkbox">`; keep them but nothing else.
    ADD_ATTR: ['checked'],
    // Never allow anything that could load/execute external resources.
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'img'],
    FORBID_ATTR: ['srcdoc', 'src', 'href', 'formaction', 'action'],
    ALLOW_DATA_ATTR: false
  })
}

