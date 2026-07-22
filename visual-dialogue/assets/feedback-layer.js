/*!
 * feedback-layer.js — fixed asset of the visual-dialogue skill
 * A sticky-note feedback layer inlined into generated proposal HTML.
 * Lives entirely inside a Shadow DOM; never interferes with proposal CSS.
 *
 * Contract with the proposal HTML:
 *   <body data-issue="nav-redesign" data-round="1">
 *   Variant roots:        <section data-variant="variant-a" data-variant-label="Option A">
 *   Meaningful elements:  data-ref="variant-a.header.cta"
 *
 * Localization:
 *   All user-facing strings default to English. The proposal HTML may define
 *   `window.DFB_LABELS = {...}` BEFORE this script to override any subset,
 *   allowing the UI to speak the user's language while this file stays fixed.
 *   Data keys (JSON payload, note types, anchors) are always English.
 */
(function () {
  'use strict';
  if (window.__DFB_LOADED__) return;
  window.__DFB_LOADED__ = true;

  /* ---------- labels (EN defaults, overridable) ---------- */
  var DEFAULT_LABELS = {
    startFeedback: 'Start feedback',
    stopFeedback: 'Stop feedback',
    noteTypes: { good: 'Good', change: 'Change', question: 'Question' },
    notePrefix: 'Note:',
    chosenPrefix: 'Choose:',
    copy: 'Copy',
    save: 'Save',
    copied: 'Copied. Paste it into the CLI.',
    savedFile: 'Feedback JSON downloaded.',
    placeholder: 'Write a comment…',
    deleteTitle: 'Delete',
    orphan: 'Original position could not be resolved',
    count: function (n) { return n + ' note' + (n === 1 ? '' : 's'); }
  };
  var L = (function merge(base, over) {
    if (!over) return base;
    var out = {};
    Object.keys(base).forEach(function (k) {
      if (over[k] == null) { out[k] = base[k]; }
      else if (typeof base[k] === 'object' && typeof over[k] === 'object' && typeof base[k] !== 'function') {
        out[k] = merge(base[k], over[k]);
      } else { out[k] = over[k]; }
    });
    return out;
  })(DEFAULT_LABELS, window.DFB_LABELS);

  /* ---------- config ---------- */
  var body = document.body;
  var CONFIG = {
    issue: body.getAttribute('data-issue') || 'untitled-issue',
    round: body.getAttribute('data-round') || '1',
    file: (location.pathname.split('/').pop() || 'proposal.html')
  };
  var LS_KEY = 'dfb:' + CONFIG.issue + ':r' + CONFIG.round;

  /* Data keys stay English regardless of UI language. */
  var NOTE_TYPES = {
    good:     { color: '#2e7d46', bg: '#e6f4ea' },
    change:   { color: '#b3541e', bg: '#fdeee2' },
    question: { color: '#2b5aa0', bg: '#e8f0fb' }
  };

  /* ---------- state ---------- */
  var state = {
    mode: 'view',            // 'view' | 'feedback'
    noteType: 'change',
    chosen: null,            // data-variant value of the adopted option
    notes: []                // {id, anchor, fallback, offset:[fx,fy], page:[x,y], type, text}
  };

  // localStorage is best-effort only. Fail silently; copy/save buttons are the
  // authoritative retrieval path.
  try {
    var saved = localStorage.getItem(LS_KEY);
    if (saved) {
      var parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.notes)) {
        state.notes = parsed.notes;
        state.chosen = parsed.chosen || null;
      }
    }
  } catch (e) { /* noop */ }

  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ notes: state.notes, chosen: state.chosen }));
    } catch (e) { /* noop */ }
  }

  /* ---------- shadow DOM host ---------- */
  var host = document.createElement('div');
  host.id = 'dfb-host';
  host.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483000;';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });

  var style = document.createElement('style');
  style.textContent = [
    ':host { all: initial; }',
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
    '.dfb { font-family: system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif; font-size: 13px; color: #222; }',

    /* overlay (feedback mode only) */
    '#overlay { position: fixed; inset: 0; cursor: crosshair; display: none; z-index: 1; background: rgba(43,90,160,0.03); }',
    '#overlay.on { display: block; }',

    /* note container (document coordinates) */
    '#notes { position: absolute; top: 0; left: 0; width: 100%; z-index: 2; pointer-events: none; }',

    /* sticky note */
    '.note { position: absolute; width: 200px; pointer-events: auto; border-radius: 3px;' +
      'box-shadow: 0 2px 10px rgba(0,0,0,0.22); border-left: 4px solid; padding: 6px 8px 8px; }',
    '.note .head { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }',
    '.note .tag { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; }',
    '.note .del { margin-left: auto; border: 0; background: none; cursor: pointer; font-size: 13px;' +
      'line-height: 1; color: #888; padding: 2px; display: none; }',
    '.note .del:hover { color: #c0392b; }',
    '.note textarea { width: 100%; border: 0; background: transparent; resize: vertical; min-height: 44px;' +
      'font: inherit; font-size: 12px; line-height: 1.5; outline: none; }',
    '.note textarea[readonly] { cursor: default; }',
    '.note .orphan-msg { display: block; font-size: 10px; color: #999; margin-top: 4px; }',
    '.note.dragging { opacity: .85; }',
    '.feedback-mode .note .head { cursor: grab; }',
    '.feedback-mode .note.dragging .head { cursor: grabbing; }',
    '.feedback-mode .note .del { display: block; }',

    /* toolbar */
    '#bar { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 3;' +
      'display: flex; align-items: center; gap: 10px; background: #1d1f24; color: #e8e8e8;' +
      'padding: 9px 14px; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,0.35);' +
      'white-space: nowrap; max-width: 96vw; overflow-x: auto; }',
    '#bar .sep { width: 1px; height: 20px; background: #45484f; flex: none; }',
    '#bar .lbl { font-size: 11px; color: #9a9da4; flex: none; }',
    '#bar button { border: 1px solid #45484f; background: #2a2d33; color: #e8e8e8; border-radius: 6px;' +
      'padding: 4px 10px; font: inherit; font-size: 12px; cursor: pointer; flex: none; }',
    '#bar button:hover { background: #34383f; }',
    '#bar button:disabled { opacity: .35; cursor: not-allowed; }',
    '#bar button:disabled:hover { background: #2a2d33; }',
    '#bar button.active { background: #e8e8e8; color: #1d1f24; border-color: #e8e8e8; font-weight: 700; }',
    '#bar button.t-good.active { background: ' + NOTE_TYPES.good.bg + '; color: ' + NOTE_TYPES.good.color + '; border-color:' + NOTE_TYPES.good.color + '; }',
    '#bar button.t-change.active { background: ' + NOTE_TYPES.change.bg + '; color: ' + NOTE_TYPES.change.color + '; border-color:' + NOTE_TYPES.change.color + '; }',
    '#bar button.t-question.active { background: ' + NOTE_TYPES.question.bg + '; color: ' + NOTE_TYPES.question.color + '; border-color:' + NOTE_TYPES.question.color + '; }',
    '#typeGroup { display: none; align-items: center; gap: 6px; }',
    '#variantGroup { display: flex; align-items: center; gap: 6px; }',
    '.feedback-mode #typeGroup { display: flex; }',
    '#variantGroup button.active:disabled { opacity: 1; }',
    '#count { font-size: 11px; color: #9a9da4; flex: none; }',

    /* toast */
    '#toast { position: fixed; left: 50%; bottom: 72px; transform: translateX(-50%) translateY(8px);' +
      'background: #2e7d46; color: #fff; padding: 8px 16px; border-radius: 8px; font-size: 12px;' +
      'opacity: 0; transition: all .25s; pointer-events: none; z-index: 4; }',
    '#toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }'
  ].join('\n');
  root.appendChild(style);

  var wrap = document.createElement('div');
  wrap.className = 'dfb';
  wrap.innerHTML =
    '<div id="overlay"></div>' +
    '<div id="notes"></div>' +
    '<div id="bar">' +
      '<button id="modeBtn"></button>' +
      '<span id="typeGroup"><span class="lbl"></span>' +
        '<button class="t-good" data-type="good"></button>' +
        '<button class="t-change" data-type="change"></button>' +
        '<button class="t-question" data-type="question"></button>' +
      '</span>' +
      '<span id="variantGroup"><span class="lbl"></span></span>' +
      '<span class="sep"></span>' +
      '<span id="count"></span>' +
      '<button id="copyBtn"></button>' +
      '<button id="saveBtn"></button>' +
    '</div>' +
    '<div id="toast"></div>';
  root.appendChild(wrap);

  var $ = function (sel) { return root.querySelector(sel); };
  var overlay = $('#overlay');
  var notesBox = $('#notes');
  var modeBtn = $('#modeBtn');
  var toast = $('#toast');

  /* apply labels */
  $('#typeGroup .lbl').textContent = L.notePrefix;
  $('#variantGroup .lbl').textContent = L.chosenPrefix;
  $('#copyBtn').textContent = L.copy;
  $('#saveBtn').textContent = L.save;
  Object.keys(NOTE_TYPES).forEach(function (t) {
    root.querySelector('#typeGroup [data-type="' + t + '"]').textContent = L.noteTypes[t];
  });

  /* ---------- variant selection ---------- */
  var variantGroup = $('#variantGroup');
  var variants = Array.prototype.map.call(
    document.querySelectorAll('[data-variant]'),
    function (el) {
      return { id: el.getAttribute('data-variant'), label: el.getAttribute('data-variant-label') || el.getAttribute('data-variant') };
    }
  );
  variants.forEach(function (v) {
    var b = document.createElement('button');
    b.textContent = v.label;
    b.setAttribute('data-choose', v.id);
    b.addEventListener('click', function () {
      if (state.mode !== 'feedback') return; /* adoption is a feedback-mode action */
      state.chosen = (state.chosen === v.id) ? null : v.id;
      persist();
      renderVariantButtons();
    });
    variantGroup.appendChild(b);
  });
  function renderVariantButtons() {
    Array.prototype.forEach.call(variantGroup.querySelectorAll('button'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-choose') === state.chosen);
    });
  }
  renderVariantButtons();
  if (!variants.length) variantGroup.style.display = 'none';

  /* ---------- anchor resolution ---------- */
  function cssPath(el) {
    var parts = [];
    var cur = el;
    var depth = 0;
    while (cur && cur !== document.body && depth < 5) {
      var part = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(part + '#' + cur.id); break; }
      var parent = cur.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === cur.tagName; });
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(cur) + 1) + ')';
      }
      parts.unshift(part);
      cur = parent;
      depth++;
    }
    return parts.join(' > ');
  }

  function resolveAnchorFromPoint(clientX, clientY) {
    var stack = document.elementsFromPoint(clientX, clientY).filter(function (el) {
      return el !== host && el !== document.documentElement && el !== document.body;
    });
    var target = stack[0] || document.body;
    var refEl = target.closest ? target.closest('[data-ref]') : null;
    var result = { anchor: null, fallback: null, offset: null, page: [clientX + window.scrollX, clientY + window.scrollY] };
    var base = refEl || target;
    if (refEl) result.anchor = refEl.getAttribute('data-ref');
    else result.fallback = cssPath(target);
    var r = base.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      result.offset = [
        Math.round(((clientX - r.left) / r.width) * 1000) / 1000,
        Math.round(((clientY - r.top) / r.height) * 1000) / 1000
      ];
    }
    return result;
  }

  function resolveNotePosition(note) {
    var el = null;
    if (note.anchor) el = document.querySelector('[data-ref="' + CSS.escape(note.anchor) + '"]');
    if (!el && note.fallback) { try { el = document.querySelector(note.fallback); } catch (e) { /* noop */ } }
    if (el && note.offset) {
      var r = el.getBoundingClientRect();
      return {
        x: r.left + window.scrollX + r.width * note.offset[0],
        y: r.top + window.scrollY + r.height * note.offset[1],
        orphan: false
      };
    }
    if (note.page) return { x: note.page[0], y: note.page[1], orphan: !note.anchor && !el };
    return { x: 24, y: 24, orphan: true };
  }

  /* ---------- note rendering ---------- */
  function renderNotes() {
    notesBox.innerHTML = '';
    state.notes.forEach(function (note) {
      var t = NOTE_TYPES[note.type] || NOTE_TYPES.change;
      var pos = resolveNotePosition(note);
      var div = document.createElement('div');
      div.className = 'note';
      div.style.left = Math.round(pos.x) + 'px';
      div.style.top = Math.round(pos.y) + 'px';
      div.style.background = t.bg;
      div.style.borderLeftColor = t.color;
      div.innerHTML =
        '<div class="head"><span class="tag" style="color:' + t.color + '"></span>' +
        '<button class="del">×</button></div>';
      div.querySelector('.tag').textContent = L.noteTypes[note.type] || note.type;
      div.querySelector('.del').title = L.deleteTitle;
      /* drag to move (feedback mode only); re-anchors at the drop point */
      div.querySelector('.head').addEventListener('mousedown', function (e) {
        if (state.mode !== 'feedback') return;
        if (e.target.closest('.del')) return;
        e.preventDefault();
        startDrag(div, note, e);
      });
      var ta = document.createElement('textarea');
      ta.value = note.text || '';
      ta.placeholder = L.placeholder;
      ta.readOnly = state.mode !== 'feedback';
      ta.addEventListener('input', function () { note.text = ta.value; persist(); });
      div.appendChild(ta);
      if (pos.orphan) {
        var msg = document.createElement('span');
        msg.className = 'orphan-msg';
        msg.textContent = L.orphan;
        div.appendChild(msg);
      }
      div.querySelector('.del').addEventListener('click', function () {
        state.notes = state.notes.filter(function (n) { return n.id !== note.id; });
        persist();
        renderNotes();
        updateCount();
      });
      notesBox.appendChild(div);
      if (note.__focus) { delete note.__focus; ta.focus(); }
    });
    updateCount();
  }

  function updateCount() {
    $('#count').textContent = L.count(state.notes.length);
  }

  /* ---------- note dragging ---------- */
  function startDrag(div, note, startEvent) {
    var rect = div.getBoundingClientRect();
    var grabDX = startEvent.clientX - rect.left;
    var grabDY = startEvent.clientY - rect.top;
    div.classList.add('dragging');
    function onMove(e) {
      div.style.left = Math.round(e.clientX - grabDX + window.scrollX) + 'px';
      div.style.top = Math.round(e.clientY - grabDY + window.scrollY) + 'px';
    }
    function onUp(e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      div.classList.remove('dragging');
      /* re-anchor at the note's new top-left, exactly like placing it anew */
      var a = resolveAnchorFromPoint(e.clientX - grabDX, e.clientY - grabDY);
      note.anchor = a.anchor;
      note.fallback = a.fallback;
      note.offset = a.offset;
      note.page = a.page;
      persist();
      renderNotes();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /* ---------- mode switching ---------- */
  function setMode(mode) {
    state.mode = mode;
    var fb = mode === 'feedback';
    overlay.classList.toggle('on', fb);
    wrap.classList.toggle('feedback-mode', fb);
    modeBtn.textContent = fb ? L.stopFeedback : L.startFeedback;
    modeBtn.classList.toggle('active', fb);
    /* copy/save are settlement actions: disabled while editing to prevent
       exporting a half-finished state; user must exit feedback mode first */
    $('#copyBtn').disabled = fb;
    $('#saveBtn').disabled = fb;
    /* adoption stays visible in view mode (so the settled choice is always
       readable) but is only changeable during feedback */
    Array.prototype.forEach.call(variantGroup.querySelectorAll('button'), function (b) {
      b.disabled = !fb;
    });
    renderNotes();
  }
  modeBtn.addEventListener('click', function () { setMode(state.mode === 'view' ? 'feedback' : 'view'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.mode === 'feedback') setMode('view');
  });

  /* note type selection */
  Array.prototype.forEach.call(root.querySelectorAll('#typeGroup button'), function (b) {
    b.classList.toggle('active', b.getAttribute('data-type') === state.noteType);
    b.addEventListener('click', function () {
      state.noteType = b.getAttribute('data-type');
      Array.prototype.forEach.call(root.querySelectorAll('#typeGroup button'), function (x) {
        x.classList.toggle('active', x === b);
      });
    });
  });

  /* overlay click = place a note */
  overlay.addEventListener('click', function (e) {
    var a = resolveAnchorFromPoint(e.clientX, e.clientY);
    state.notes.push({
      id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      anchor: a.anchor,
      fallback: a.fallback,
      offset: a.offset,
      page: a.page,
      type: state.noteType,
      text: '',
      __focus: true
    });
    persist();
    renderNotes();
  });

  /* ---------- retrieval ---------- */
  function buildPayload() {
    return {
      issue: CONFIG.issue,
      round: CONFIG.round,
      generated: CONFIG.file,
      chosen: state.chosen,
      timestamp: new Date().toISOString(),
      notes: state.notes.map(function (n) {
        return { anchor: n.anchor, fallback: n.fallback, offset: n.offset, type: n.type, text: n.text };
      })
    };
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  $('#copyBtn').addEventListener('click', function () {
    var json = JSON.stringify(buildPayload(), null, 2);
    function fallbackCopy() {
      var ta = document.createElement('textarea');
      ta.value = json;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* noop */ }
      document.body.removeChild(ta);
      showToast(L.copied);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(function () {
        showToast(L.copied);
      }, fallbackCopy);
    } else fallbackCopy();
  });

  $('#saveBtn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'feedback-' + CONFIG.issue + '-r' + CONFIG.round + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    showToast(L.savedFile);
  });

  /* ---------- repositioning ---------- */
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderNotes, 120);
  });

  /* initial render */
  setMode('view');
})();
