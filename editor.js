(function () {
  'use strict';

  var openBtn = document.getElementById('open-btn');
  var saveBtn = document.getElementById('save-btn');
  var fileLabel = document.getElementById('file-label');
  var dirtyIndicator = document.getElementById('dirty-indicator');
  var frame = document.getElementById('frame');
  var emptyState = document.getElementById('empty-state');
  var editPanel = document.getElementById('edit-panel');
  var editTitle = document.getElementById('edit-panel-title');
  var editFields = document.getElementById('edit-fields');
  var editClose = document.getElementById('edit-close');
  var editCancel = document.getElementById('edit-cancel');
  var editApply = document.getElementById('edit-apply');
  var inspectorSource = document.getElementById('inspector-source').textContent;

  var state = {
    fileHandle: null,    // FileSystemFileHandle for the opened file (used to derive save name)
    fileName: null,      // string, e.g. "page.html"
    originalText: '',    // last loaded HTML text
    dirty: false,
    activeSelector: null, // selector path of element being edited
    activeKind: null      // 'text' | 'link' | 'image' | 'image-link'
  };

  function setDirty(d) {
    state.dirty = d;
    dirtyIndicator.hidden = !d;
  }

  function setFileName(name) {
    state.fileName = name;
    fileLabel.textContent = name;
  }

  // --- Open ---------------------------------------------------------------

  async function openFile() {
    try {
      if (window.showOpenFilePicker) {
        var picks = await window.showOpenFilePicker({
          types: [{ description: 'HTML files', accept: { 'text/html': ['.html', '.htm'] } }],
          multiple: false
        });
        var handle = picks[0];
        var file = await handle.getFile();
        var text = await file.text();
        state.fileHandle = handle;
        loadHtml(text, file.name);
      } else {
        // Fallback: hidden <input type=file>
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html,.htm,text/html';
        input.addEventListener('change', async function () {
          var file = input.files && input.files[0];
          if (!file) return;
          var text = await file.text();
          state.fileHandle = null;
          loadHtml(text, file.name);
        });
        input.click();
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      alert('Could not open file: ' + (err && err.message ? err.message : err));
    }
  }

  function loadHtml(text, name) {
    state.originalText = text;
    setFileName(name);
    setDirty(false);
    closeEditPanel();
    emptyState.hidden = true;
    frame.hidden = false;
    saveBtn.disabled = false;
    frame.srcdoc = text;
    // Inject inspector after the frame's document is ready.
    frame.addEventListener('load', onFrameLoad, { once: true });
  }

  function onFrameLoad() {
    try {
      var fdoc = frame.contentDocument;
      if (!fdoc) return;
      var s = fdoc.createElement('script');
      s.textContent = inspectorSource;
      fdoc.documentElement.appendChild(s);
    } catch (err) {
      console.error('Failed to inject inspector:', err);
    }
  }

  // --- Edit panel ---------------------------------------------------------

  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || data.source !== 'editor-inspector') return;
    if (data.type === 'edit-request') {
      openEditPanel(data.selector, data.kind);
    }
  });

  function resolveElement(selector) {
    try {
      return frame.contentDocument.querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  function openEditPanel(selector, kind) {
    var el = resolveElement(selector);
    if (!el) {
      alert('Could not locate the selected element. Try selecting again.');
      return;
    }
    state.activeSelector = selector;
    state.activeKind = kind;
    editFields.innerHTML = '';

    if (kind === 'image' || (kind === 'image-link' && el.tagName.toLowerCase() === 'img')) {
      buildImageFields(el);
      editTitle.textContent = 'Edit image';
    } else if (kind === 'image-link') {
      // anchor wrapping an image: edit the image src/alt + the anchor href
      var img = el.querySelector('img');
      buildImageFields(img || el);
      buildField('href', 'Link URL (href)', el.getAttribute('href') || '', 'input');
      editTitle.textContent = 'Edit image link';
    } else if (kind === 'link') {
      buildField('text', 'Link text', el.textContent || '', 'textarea');
      buildField('href', 'Link URL (href)', el.getAttribute('href') || '', 'input');
      editTitle.textContent = 'Edit link';
    } else {
      buildField('text', 'Text content', el.textContent || '', 'textarea');
      editTitle.textContent = 'Edit text (<' + el.tagName.toLowerCase() + '>)';
    }

    editPanel.hidden = false;
    var first = editFields.querySelector('input, textarea');
    if (first) first.focus();
  }

  function buildImageFields(imgEl) {
    buildField('src', 'Image URL (src)', imgEl.getAttribute('src') || '', 'input');
    buildField('alt', 'Alt text', imgEl.getAttribute('alt') || '', 'input');
  }

  function buildField(name, labelText, value, kind) {
    var label = document.createElement('label');
    label.textContent = labelText;
    var field = document.createElement(kind === 'textarea' ? 'textarea' : 'input');
    if (kind !== 'textarea') field.type = 'text';
    field.name = name;
    field.value = value;
    field.dataset.field = name;
    label.appendChild(field);
    editFields.appendChild(label);
  }

  function closeEditPanel() {
    editPanel.hidden = true;
    state.activeSelector = null;
    state.activeKind = null;
    if (frame.contentWindow) {
      frame.contentWindow.postMessage({ source: 'editor-parent', type: 'clear-selection' }, '*');
    }
  }

  function applyEdit() {
    if (!state.activeSelector) return;
    var el = resolveElement(state.activeSelector);
    if (!el) {
      alert('Element no longer exists.');
      closeEditPanel();
      return;
    }
    var values = {};
    editFields.querySelectorAll('[data-field]').forEach(function (input) {
      values[input.dataset.field] = input.value;
    });

    var kind = state.activeKind;
    if (kind === 'image' || (kind === 'image-link' && el.tagName.toLowerCase() === 'img')) {
      if ('src' in values) el.setAttribute('src', values.src);
      if ('alt' in values) el.setAttribute('alt', values.alt);
    } else if (kind === 'image-link') {
      var img = el.querySelector('img');
      if (img) {
        if ('src' in values) img.setAttribute('src', values.src);
        if ('alt' in values) img.setAttribute('alt', values.alt);
      }
      if ('href' in values) el.setAttribute('href', values.href);
    } else if (kind === 'link') {
      if ('text' in values) el.textContent = values.text;
      if ('href' in values) el.setAttribute('href', values.href);
    } else {
      if ('text' in values) el.textContent = values.text;
    }

    setDirty(true);
    closeEditPanel();
  }

  editClose.addEventListener('click', closeEditPanel);
  editCancel.addEventListener('click', closeEditPanel);
  editApply.addEventListener('click', applyEdit);

  // --- Save ---------------------------------------------------------------

  function suggestedSaveName() {
    var base = state.fileName || 'page.html';
    var dot = base.lastIndexOf('.');
    if (dot <= 0) return base + '.edited.html';
    return base.slice(0, dot) + '.edited' + base.slice(dot);
  }

  function serializeFrame() {
    var fdoc = frame.contentDocument;
    if (!fdoc) return state.originalText;
    // Remove inspector-injected nodes before serializing.
    var clone = fdoc.documentElement.cloneNode(true);
    var style = clone.querySelector('#__editor-inspector-style');
    if (style) style.parentNode.removeChild(style);
    var pop = clone.querySelector('#__editor-confirm-popover');
    if (pop) pop.parentNode.removeChild(pop);
    // Strip inspector marker attributes and any leftover inspector script.
    clone.querySelectorAll('[data-editor-hover]').forEach(function (n) { n.removeAttribute('data-editor-hover'); });
    clone.querySelectorAll('[data-editor-selected]').forEach(function (n) { n.removeAttribute('data-editor-selected'); });
    var scripts = clone.querySelectorAll('script');
    scripts.forEach(function (s) {
      if (s.textContent && s.textContent.indexOf('__editorInspectorLoaded') !== -1) {
        s.parentNode.removeChild(s);
      }
    });
    var doctype = fdoc.doctype
      ? '<!DOCTYPE ' + fdoc.doctype.name +
        (fdoc.doctype.publicId ? ' PUBLIC "' + fdoc.doctype.publicId + '"' : '') +
        (fdoc.doctype.systemId ? ' "' + fdoc.doctype.systemId + '"' : '') + '>\n'
      : '';
    return doctype + clone.outerHTML;
  }

  async function saveCopy() {
    if (!state.fileName) return;
    var html = serializeFrame();
    var suggested = suggestedSaveName();
    try {
      if (window.showSaveFilePicker) {
        var opts = {
          suggestedName: suggested,
          types: [{ description: 'HTML files', accept: { 'text/html': ['.html', '.htm'] } }]
        };
        var handle = await window.showSaveFilePicker(opts);
        var writable = await handle.createWritable();
        await writable.write(html);
        await writable.close();
        setDirty(false);
      } else {
        downloadBlob(html, suggested);
        setDirty(false);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      // Fallback to download on any save error.
      try { downloadBlob(html, suggested); setDirty(false); }
      catch (e2) { alert('Could not save: ' + (err && err.message ? err.message : err)); }
    }
  }

  function downloadBlob(text, name) {
    var blob = new Blob([text], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // --- Wiring -------------------------------------------------------------

  openBtn.addEventListener('click', openFile);
  saveBtn.addEventListener('click', saveCopy);

  window.addEventListener('beforeunload', function (e) {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
})();
