<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

const props = defineProps<{
  /** Viewport x/y (px) where the menu should appear. */
  x: number
  y: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  /** Fired after a formatting command has been applied to the selection. */
  (e: 'applied'): void
  /** Ask the host to open the shared link dialog for the current selection. */
  (e: 'request-link', payload: { text: string }): void
}>()

/** A few tasteful text / highlight colours. */
const textColors = ['#242424', '#c50f1f', '#0f6cbd', '#0f7b0f', '#8764b8']
const highlightColors = ['#fff3a3', '#c6efce', '#ffd6d6', '#d6e4ff', '#ffe0b3']
/** The editor's default text colour — used by the "no text colour" option. */
const DEFAULT_TEXT_COLOR = '#242424'

const menuEl = ref<HTMLElement | null>(null)
/** Resolved (viewport-clamped) position. Starts at the requested point. */
const pos = ref({ left: props.x, top: props.y })
/** Hidden until measured so it never flashes in the wrong spot. */
const ready = ref(false)

/**
 * Reactive "is this format currently applied to the selection" map, used to
 * render pressed/active toggle states (and expose them via `aria-pressed`).
 * Kept in sync with the live selection via `refreshActive()`.
 */
const active = reactive({
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  subscript: false,
  superscript: false,
  insertUnorderedList: false,
  insertOrderedList: false,
  justifyLeft: false,
  justifyCenter: false,
  justifyRight: false,
})

/**
 * Query the browser for which inline/block commands are active on the current
 * selection and mirror the result into `active`. `queryCommandState` throws in
 * some edge cases (detached selection), so each read is defensively guarded.
 */
function refreshActive() {
  const read = (command: string) => {
    try {
      return document.queryCommandState(command)
    } catch {
      return false
    }
  }
  active.bold = read('bold')
  active.italic = read('italic')
  active.underline = read('underline')
  active.strikeThrough = read('strikeThrough')
  active.subscript = read('subscript')
  active.superscript = read('superscript')
  active.insertUnorderedList = read('insertUnorderedList')
  active.insertOrderedList = read('insertOrderedList')
  active.justifyLeft = read('justifyLeft')
  active.justifyCenter = read('justifyCenter')
  active.justifyRight = read('justifyRight')
}

/**
 * The text selection is captured when the menu opens and restored before every
 * command. Clicking a menu button can otherwise collapse/steal the selection,
 * which is why colour changes only appeared to "take" after the menu closed.
 */
let savedRange: Range | null = null

function saveSelection() {
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange()
}

function restoreSelection() {
  if (!savedRange) return
  // Focus the owning editable so execCommand targets it, then reinstate range.
  const node = savedRange.commonAncestorContainer
  const host = (node instanceof Element ? node : node.parentElement)?.closest(
    '[contenteditable="true"]'
  ) as HTMLElement | null
  host?.focus()
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(savedRange)
}

/** Re-emit input on the active editable so its owner persists the new HTML. */
function notifyChanged() {
  const active = document.activeElement
  if (active instanceof HTMLElement) {
    active.dispatchEvent(new Event('input', { bubbles: true }))
  }
  // Refresh toggle indicators so the menu reflects the new selection state.
  refreshActive()
  emit('applied')
}

/**
 * Run a rich-text command against the (restored) selection via the browser's
 * built-in editing commands. Deprecated on paper but still the simplest
 * cross-browser way to toggle inline styles inside a `contenteditable`.
 */
function run(command: string, value?: string) {
  restoreSelection()
  document.execCommand(command, false, value)
  saveSelection()
  notifyChanged()
}

/**
 * Colour commands force CSS styling so they emit `<span style="…">` (which our
 * sanitizer allows) and apply immediately/reactively to the live selection.
 */
function applyColor(command: 'foreColor' | 'hiliteColor', value: string) {
  restoreSelection()
  document.execCommand('styleWithCSS', false, 'true')
  document.execCommand(command, false, value)
  document.execCommand('styleWithCSS', false, 'false')
  saveSelection()
  notifyChanged()
}

/** Insert an interactive tick box at the caret. */
function insertCheckbox() {
  // contenteditable="false" keeps the caret out of the checkbox itself so it
  // stays clickable, while the trailing space gives the user a place to type.
  run(
    'insertHTML',
    '<span class="tick" contenteditable="false"><input type="checkbox"></span>&nbsp;'
  )
}

/** Font size uses execCommand's 1–7 scale. */
function setFontSize(size: string) {
  run('fontSize', size)
}

/**
 * Block-level commands (headings, alignment, indent) are forced to emit inline
 * CSS via `styleWithCSS` so they produce sanitizer-friendly markup rather than
 * deprecated attributes.
 */
function runBlock(command: string, value?: string) {
  restoreSelection()
  document.execCommand('styleWithCSS', false, 'true')
  document.execCommand(command, false, value)
  document.execCommand('styleWithCSS', false, 'false')
  saveSelection()
  notifyChanged()
}

/** Apply (or clear) a block format such as a heading or blockquote. */
function setBlock(tag: string) {
  runBlock('formatBlock', tag)
}

/**
 * Wrap the current selection in an inline `<code>` element. execCommand has no
 * native inline-code command, so we manipulate the range directly.
 */
function toggleInlineCode() {
  restoreSelection()
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed) return
  const code = document.createElement('code')
  try {
    range.surroundContents(code)
  } catch {
    // Range crosses element boundaries — extract then wrap.
    code.appendChild(range.extractContents())
    range.insertNode(code)
  }
  saveSelection()
  notifyChanged()
}

/**
 * Open the shared link dialog for the current selection. The host (NoteEditor)
 * owns the modal and performs the actual insertion once the user confirms,
 * supporting both external URLs and internal page links.
 */
function insertLink() {
  saveSelection()
  const text = savedRange ? savedRange.toString() : ''
  emit('request-link', { text })
}

/** Insert a horizontal divider line at the caret. */
function insertDivider() {
  run('insertHorizontalRule')
}

/**
 * Menu buttons must not steal focus from the editable element, otherwise the
 * text selection collapses before the command runs.  Suppressing the default
 * mousedown behaviour preserves the selection.
 */
function keepSelection(e: MouseEvent) {
  e.preventDefault()
}

/**
 * Keep the menu fully on-screen: shift left if it overflows the right edge and
 * flip it *above* the cursor if it would be clipped at the bottom.
 */
function clampToViewport() {
  const el = menuEl.value
  if (!el) return
  const margin = 8
  const { width, height } = el.getBoundingClientRect()
  let left = props.x
  let top = props.y
  if (left + width + margin > window.innerWidth) {
    left = window.innerWidth - width - margin
  }
  if (top + height + margin > window.innerHeight) {
    // Render above the click point (anchor the menu's bottom to the cursor).
    top = props.y - height
  }
  pos.value = { left: Math.max(margin, left), top: Math.max(margin, top) }
  ready.value = true
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  // Standard rich-text shortcuts while the menu is open. Ctrl (Win/Linux) or
  // Cmd (macOS) act as the modifier; each handler mirrors a menu button.
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  switch (e.key.toLowerCase()) {
    case 'b':
      e.preventDefault()
      run('bold')
      break
    case 'i':
      e.preventDefault()
      run('italic')
      break
    case 'u':
      e.preventDefault()
      run('underline')
      break
    case 'e':
      e.preventDefault()
      toggleInlineCode()
      break
    case 'k':
      e.preventDefault()
      insertLink()
      break
    case 'x':
      if (e.shiftKey) {
        e.preventDefault()
        run('strikeThrough')
      }
      break
  }
}

onMounted(() => {
  saveSelection()
  refreshActive()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', clampToViewport)
  document.addEventListener('selectionchange', refreshActive)
  nextTick(clampToViewport)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', clampToViewport)
  document.removeEventListener('selectionchange', refreshActive)
})
</script>

<template>
  <div
    ref="menuEl"
    class="format-menu"
    role="menu"
    aria-label="Text formatting"
    :style="{ left: pos.left + 'px', top: pos.top + 'px', visibility: ready ? 'visible' : 'hidden' }"
    @mousedown="keepSelection"
    @contextmenu.prevent
  >
    <div class="row" role="group" aria-label="Inline formatting">
      <button
        type="button"
        class="icon"
        title="Bold (Ctrl+B)"
        aria-label="Bold"
        :aria-pressed="active.bold"
        :class="{ active: active.bold }"
        @click="run('bold')"
      >
        <b>B</b>
      </button>
      <button
        type="button"
        class="icon"
        title="Italic (Ctrl+I)"
        aria-label="Italic"
        :aria-pressed="active.italic"
        :class="{ active: active.italic }"
        @click="run('italic')"
      >
        <i>I</i>
      </button>
      <button
        type="button"
        class="icon"
        title="Underline (Ctrl+U)"
        aria-label="Underline"
        :aria-pressed="active.underline"
        :class="{ active: active.underline }"
        @click="run('underline')"
      >
        <u>U</u>
      </button>
      <button
        type="button"
        class="icon"
        title="Strikethrough (Ctrl+Shift+X)"
        aria-label="Strikethrough"
        :aria-pressed="active.strikeThrough"
        :class="{ active: active.strikeThrough }"
        @click="run('strikeThrough')"
      >
        <s>S</s>
      </button>
      <button
        type="button"
        class="icon"
        title="Subscript"
        aria-label="Subscript"
        :aria-pressed="active.subscript"
        :class="{ active: active.subscript }"
        @click="run('subscript')"
      >
        X<sub>2</sub>
      </button>
      <button
        type="button"
        class="icon"
        title="Superscript"
        aria-label="Superscript"
        :aria-pressed="active.superscript"
        :class="{ active: active.superscript }"
        @click="run('superscript')"
      >
        X<sup>2</sup>
      </button>
      <button
        type="button"
        class="icon"
        title="Inline code (Ctrl+E)"
        aria-label="Inline code"
        @click="toggleInlineCode"
      >
        <code>&lt;/&gt;</code>
      </button>
    </div>

    <div class="sep" role="separator" />

    <button type="button" class="item" role="menuitem" @click="insertCheckbox">
      ☑ Tick box
    </button>
    <button
      type="button"
      class="item"
      role="menuitem"
      :aria-pressed="active.insertUnorderedList"
      :class="{ active: active.insertUnorderedList }"
      @click="run('insertUnorderedList')"
    >
      • Bulleted list
    </button>
    <button
      type="button"
      class="item"
      role="menuitem"
      :aria-pressed="active.insertOrderedList"
      :class="{ active: active.insertOrderedList }"
      @click="run('insertOrderedList')"
    >
      1. Numbered list
    </button>
    <button type="button" class="item" role="menuitem" @click="setBlock('blockquote')">
      ❝ Quote block
    </button>
    <button type="button" class="item" role="menuitem" title="Insert link (Ctrl+K)" @click="insertLink">
      🔗 Insert link…
    </button>
    <button type="button" class="item" role="menuitem" @click="insertDivider">
      — Divider line
    </button>

    <div class="sep" role="separator" />

    <div class="label" id="fm-headings">Headings</div>
    <div class="row" role="group" aria-labelledby="fm-headings">
      <button type="button" class="chip" title="Heading 1" @click="setBlock('h1')">
        H1
      </button>
      <button type="button" class="chip" title="Heading 2" @click="setBlock('h2')">
        H2
      </button>
      <button type="button" class="chip" title="Heading 3" @click="setBlock('h3')">
        H3
      </button>
      <button type="button" class="chip" title="Normal text" @click="setBlock('p')">
        ¶
      </button>
    </div>

    <div class="sep" role="separator" />

    <div class="label" id="fm-alignment">Alignment</div>
    <div class="row" role="group" aria-labelledby="fm-alignment">
      <button
        type="button"
        class="chip"
        title="Align left"
        aria-label="Align left"
        :aria-pressed="active.justifyLeft"
        :class="{ active: active.justifyLeft }"
        @click="runBlock('justifyLeft')"
      >
        ⯇
      </button>
      <button
        type="button"
        class="chip"
        title="Align centre"
        aria-label="Align centre"
        :aria-pressed="active.justifyCenter"
        :class="{ active: active.justifyCenter }"
        @click="runBlock('justifyCenter')"
      >
        ≡
      </button>
      <button
        type="button"
        class="chip"
        title="Align right"
        aria-label="Align right"
        :aria-pressed="active.justifyRight"
        :class="{ active: active.justifyRight }"
        @click="runBlock('justifyRight')"
      >
        ⯈
      </button>
      <button type="button" class="chip" title="Outdent" aria-label="Outdent" @click="runBlock('outdent')">
        ⇤
      </button>
      <button type="button" class="chip" title="Indent" aria-label="Indent" @click="runBlock('indent')">
        ⇥
      </button>
    </div>

    <div class="sep" role="separator" />

    <div class="label" id="fm-fontsize">Font size</div>
    <div class="row" role="group" aria-labelledby="fm-fontsize">
      <button type="button" class="chip" title="Small" @click="setFontSize('1')">
        S
      </button>
      <button type="button" class="chip" title="Normal" @click="setFontSize('3')">
        M
      </button>
      <button type="button" class="chip" title="Large" @click="setFontSize('5')">
        L
      </button>
      <button type="button" class="chip" title="Huge" @click="setFontSize('7')">
        XL
      </button>
    </div>

    <div class="sep" role="separator" />

    <div class="label" id="fm-textcolor">Text colour</div>
    <div class="row" role="group" aria-labelledby="fm-textcolor">
      <button
        type="button"
        class="swatch none"
        title="No text colour"
        aria-label="No text colour"
        @click="applyColor('foreColor', DEFAULT_TEXT_COLOR)"
      >⦸</button>
      <button
        v-for="c in textColors"
        :key="'t' + c"
        type="button"
        class="swatch"
        :style="{ background: c }"
        :title="'Text ' + c"
        :aria-label="'Text colour ' + c"
        @click="applyColor('foreColor', c)"
      />
    </div>

    <div class="label" id="fm-highlight">Highlight</div>
    <div class="row" role="group" aria-labelledby="fm-highlight">
      <button
        type="button"
        class="swatch none"
        title="No highlight"
        aria-label="No highlight"
        @click="applyColor('hiliteColor', 'transparent')"
      >⦸</button>
      <button
        v-for="c in highlightColors"
        :key="'h' + c"
        type="button"
        class="swatch"
        :style="{ background: c }"
        :title="'Highlight ' + c"
        :aria-label="'Highlight ' + c"
        @click="applyColor('hiliteColor', c)"
      />
    </div>

    <div class="sep" role="separator" />

    <button type="button" class="item" role="menuitem" @click="run('removeFormat')">
      ✕ Clear formatting
    </button>
  </div>
</template>

<style scoped>
.format-menu {
  position: fixed;
  z-index: 1000;
  min-width: 200px;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--sidebar-border, #e1dfdd);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  padding: 6px;
  user-select: none;
  font-size: 13px;
}

.row {
  display: flex;
  gap: 4px;
  padding: 2px;
  flex-wrap: wrap;
}

.sep {
  height: 1px;
  background: var(--sidebar-border, #e1dfdd);
  margin: 6px 2px;
}

.label {
  color: var(--text-muted, #605e5c);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 4px 4px 2px;
}

.icon,
.chip {
  min-width: 30px;
  height: 30px;
  border: 1px solid var(--sidebar-border, #e1dfdd);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  color: var(--text, #242424);
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.chip {
  font-size: 12px;
  padding: 0 8px;
}
.icon:hover,
.chip:hover,
.item:hover {
  background: #f3f2f1;
}

/* Pressed/active toggle state (mirrors aria-pressed="true"). */
.icon.active,
.chip.active {
  background: #f2e7fa;
  border-color: var(--accent, #7719aa);
  color: var(--accent, #7719aa);
}
.item.active {
  background: #f2e7fa;
  color: var(--accent, #7719aa);
}

.item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
  color: var(--text, #242424);
  font-size: 13px;
}

.swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.15);
  cursor: pointer;
  padding: 0;
}
.swatch:hover {
  transform: scale(1.1);
}
/* "No colour" option: white chip with a muted slashed-circle glyph. */
.swatch.none {
  background: #fff;
  color: var(--text-muted, #605e5c);
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>

