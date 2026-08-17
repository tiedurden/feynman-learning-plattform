<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  /** Viewport x/y (px) where the menu should appear. */
  x: number
  y: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  /** Fired after a formatting command has been applied to the selection. */
  (e: 'applied'): void
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
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  saveSelection()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', clampToViewport)
  nextTick(clampToViewport)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', clampToViewport)
})
</script>

<template>
  <div
    ref="menuEl"
    class="format-menu"
    :style="{ left: pos.left + 'px', top: pos.top + 'px', visibility: ready ? 'visible' : 'hidden' }"
    @mousedown="keepSelection"
    @contextmenu.prevent
  >
    <div class="row">
      <button type="button" class="icon" title="Bold" @click="run('bold')">
        <b>B</b>
      </button>
      <button type="button" class="icon" title="Italic" @click="run('italic')">
        <i>I</i>
      </button>
      <button type="button" class="icon" title="Underline" @click="run('underline')">
        <u>U</u>
      </button>
      <button
        type="button"
        class="icon"
        title="Strikethrough"
        @click="run('strikeThrough')"
      >
        <s>S</s>
      </button>
    </div>

    <div class="sep" />

    <button type="button" class="item" @click="insertCheckbox">
      ☑ Tick box
    </button>
    <button type="button" class="item" @click="run('insertUnorderedList')">
      • Bulleted list
    </button>
    <button type="button" class="item" @click="run('insertOrderedList')">
      1. Numbered list
    </button>

    <div class="sep" />

    <div class="label">Font size</div>
    <div class="row">
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

    <div class="sep" />

    <div class="label">Text colour</div>
    <div class="row">
      <button
        type="button"
        class="swatch none"
        title="No text colour"
        @click="applyColor('foreColor', DEFAULT_TEXT_COLOR)"
      >⦸</button>
      <button
        v-for="c in textColors"
        :key="'t' + c"
        type="button"
        class="swatch"
        :style="{ background: c }"
        :title="'Text ' + c"
        @click="applyColor('foreColor', c)"
      />
    </div>

    <div class="label">Highlight</div>
    <div class="row">
      <button
        type="button"
        class="swatch none"
        title="No highlight"
        @click="applyColor('hiliteColor', 'transparent')"
      >⦸</button>
      <button
        v-for="c in highlightColors"
        :key="'h' + c"
        type="button"
        class="swatch"
        :style="{ background: c }"
        :title="'Highlight ' + c"
        @click="applyColor('hiliteColor', c)"
      />
    </div>

    <div class="sep" />

    <button type="button" class="item" @click="run('removeFormat')">
      ✕ Clear formatting
    </button>
  </div>
</template>

<style scoped>
.format-menu {
  position: fixed;
  z-index: 1000;
  min-width: 200px;
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

