# Website Editor

A small, no-install, in-browser tool that opens a local `.html` file and lets you visually edit text, links, and images — like Chrome's "Inspect element" mode, but for direct edits.

## Quick start

1. Open `index.html` in a Chromium-based browser (Chrome, Edge, Brave, Opera) — just double-click it.
2. Click **Open HTML** and pick an HTML file (try `sample.html`).
3. Hover over elements in the page — a blue outline follows your cursor.
4. Click an element — a confirmation popover appears: *"Edit this `<tag>` element?"*. Click **Yes, edit**.
5. The edit panel opens on the right with fields appropriate to the element:
   - **Text** elements → text content
   - **`<a>` links** → text + `href`
   - **`<img>` images** → `src` + `alt`
6. Click **Apply** to update the page in place.
7. Click **Save Copy** to write your changes to `<filename>.edited.html`. The original file is never modified.

## How it works

- The opened HTML is rendered inside an `<iframe>` (via `srcdoc`) so its styles don't bleed into the editor UI.
- An inspector script is injected into the iframe at load time. It handles hover highlighting, the confirmation popover, and reports the selected element to the parent.
- Edits are applied directly to the iframe's live DOM.
- Saving serializes the iframe's document (stripped of inspector artifacts) and uses the File System Access API (`showSaveFilePicker`). In non-Chromium browsers it falls back to a download.

## Files

- `index.html` — editor UI + inlined inspector source
- `styles.css` — editor chrome styling
- `editor.js` — open / edit-panel / save controller
- `sample.html` — example file to play with

## Limitations

- Chromium-only for direct file save (other browsers fall back to download).
- URL-only image editing (no upload).
- No structural edits (add/delete/move elements) or style edits — only text, `href`, `src`, `alt`.
- Saves to a copy (`*.edited.html`), never overwrites the original.
