/**
 * Quote/layout store (Svelte 5 runes) — the drawn layout, job details, margin,
 * and the derived priced quote. Persists the working layout to localStorage so
 * nothing is lost on reload (mirrors the legacy React behaviour).
 */
import { GRID, APPLIANCE_TYPES, snapV } from '$lib/calc/constants.js';
import { calcQuote, buildScope } from '$lib/calc/pricing.js';
import { calcMaterials } from '$lib/calc/materials.js';
import { DEFAULT_CONFIG } from '$lib/config/defaults.js';
import { settings } from './settings.svelte.js';

const hasLS = typeof localStorage !== 'undefined';
const load = (key, fallback) => {
  if (!hasLS) return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

const Q_DEFAULTS = { addr: '', pressure: 2.0, newMeter: true, pens: 0, dig: 0, conc: 0, twoS: false };
let segs = $state(load('chk_gq_segs', []));
let apps = $state(load('chk_gq_apps', []));
// Merge with defaults so an older/partial saved object can't leave undefined
// fields (which would produce NaN costs downstream).
let q = $state({ ...Q_DEFAULTS, ...load('chk_gq_q', {}) });
let margin = $state(load('chk_gq_margin', DEFAULT_CONFIG.margin));
let step = $state(load('chk_gq_step', 'draw')); // draw | questionnaire | quote

let tool = $state('draw'); // draw | appliance | erase
let appT = $state('cooktop');
let selSeg = $state(null);
let editVal = $state('');
let editErr = $state('');
let drawPreview = $state(null);
let mouse = $state(null);
let toast = $state('');
let history = $state([]);

let sid = Math.max(0, ...segs.map((s) => Number(s.id) || 0)) + 1;
let aid = Math.max(0, ...apps.map((a) => Number(a.id) || 0)) + 1;
let toastTimer = null;

const quote = $derived(calcQuote(segs, apps, q, settings.cfg, margin));
const appCounts = $derived(
  APPLIANCE_TYPES.map((at) => ({ ...at, count: apps.filter((a) => a.typeId === at.id).length })).filter(
    (a) => a.count > 0
  )
);

function persist() {
  if (!hasLS) return;
  try {
    localStorage.setItem('chk_gq_segs', JSON.stringify(segs));
    localStorage.setItem('chk_gq_apps', JSON.stringify(apps));
    localStorage.setItem('chk_gq_q', JSON.stringify(q));
    localStorage.setItem('chk_gq_margin', JSON.stringify(margin));
    localStorage.setItem('chk_gq_step', JSON.stringify(step));
  } catch {
    /* ignore */
  }
}

function showToast(msg) {
  toast = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast = ''), 2500);
}

function pushHistory() {
  history = [...history.slice(-29), { segs: $state.snapshot(segs), apps: $state.snapshot(apps) }];
}

export const quoteStore = {
  get segs() { return segs; },
  get apps() { return apps; },
  get q() { return q; },
  get margin() { return margin; },
  get step() { return step; },
  get tool() { return tool; },
  get appT() { return appT; },
  get selSeg() { return selSeg; },
  get editVal() { return editVal; },
  get editErr() { return editErr; },
  get drawPreview() { return drawPreview; },
  get mouse() { return mouse; },
  get toast() { return toast; },
  get quote() { return quote; },
  get appCounts() { return appCounts; },
  get totalDemand() { return apps.reduce((s, a) => s + a.mj, 0); },
  get canUndo() { return history.length > 0; },

  setStep(s) { step = s; persist(); },
  setTool(t) { tool = t; },
  setAppT(id) { appT = id; },
  setMargin(m) { margin = Math.min(60, Math.max(0, Number(m) || 0)); persist(); },
  setMouse(p) { mouse = p; },
  setQ(patch) { Object.assign(q, patch); persist(); },

  scope() { return buildScope(segs, apps, q, appCounts); },
  materials() { return calcMaterials(segs, apps, q, quote); },

  // ── Drawing ──
  startDraw(p) { drawPreview = { x1: p.x, y1: p.y, x2: p.x, y2: p.y }; },
  updateDraw(p) {
    mouse = p;
    if (drawPreview) drawPreview = { ...drawPreview, x2: p.x, y2: p.y };
  },
  commitDraw() {
    const d = drawPreview;
    drawPreview = null;
    if (!d) return;
    if (Math.abs(d.x2 - d.x1) > 4 || Math.abs(d.y2 - d.y1) > 4) {
      pushHistory();
      segs = [...segs, { ...d, id: sid++, length: null }];
      persist();
      showToast('✓ Pipe segment added');
    }
  },
  cancelDraw() { drawPreview = null; },

  // ── Appliance placement (snap to nearest endpoint within 1.5 grid) ──
  addAppliance(p) {
    let pos = p;
    let best = GRID * 1.5;
    segs.forEach((s) => {
      [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }].forEach((ep) => {
        const d = Math.hypot(p.x - ep.x, p.y - ep.y);
        if (d < best) { best = d; pos = ep; }
      });
    });
    const aType = APPLIANCE_TYPES.find((a) => a.id === appT);
    pushHistory();
    apps = [...apps, { ...aType, typeId: aType.id, id: aid++, x: pos.x, y: pos.y }];
    persist();
    showToast(`✓ ${aType.label} added`);
  },

  // ── Erase / undo ──
  delSeg(id) {
    pushHistory();
    segs = segs.filter((s) => s.id !== id);
    if (selSeg === id) selSeg = null;
    persist();
    showToast('Segment removed');
  },
  delApp(id) {
    pushHistory();
    apps = apps.filter((a) => a.id !== id);
    persist();
    showToast('Appliance removed');
  },
  toggleExternal(id) {
    pushHistory();
    segs = segs.map((s) => (s.id === id ? { ...s, external: !s.external } : s));
    persist();
    showToast('✓ External flag updated');
  },
  undo() {
    if (!history.length) { showToast('Nothing to undo'); return; }
    const prev = history[history.length - 1];
    segs = [...prev.segs];
    apps = [...prev.apps];
    history = history.slice(0, -1);
    persist();
    showToast('↩ Undone');
  },

  // ── Inline length editor ──
  openEdit(seg) {
    if (tool === 'erase') { this.delSeg(seg.id); return; }
    selSeg = seg.id;
    editVal = seg.length != null ? String(seg.length) : '';
    editErr = '';
  },
  setEditVal(v) { editVal = v; editErr = ''; },
  commitEdit() {
    if (selSeg != null) {
      const v = parseFloat(editVal);
      if (isNaN(v) || v <= 0) { editErr = 'Enter a length > 0 m'; return; }
      pushHistory();
      segs = segs.map((s) => (s.id === selSeg ? { ...s, length: v } : s));
      persist();
      showToast(`✓ Length set to ${v} m`);
    }
    selSeg = null;
    editVal = '';
    editErr = '';
  },
  cancelEdit() { selSeg = null; editVal = ''; editErr = ''; },

  newJob() {
    pushHistory();
    segs = [];
    apps = [];
    q = { ...Q_DEFAULTS };
    step = 'draw';
    selSeg = null;
    persist();
    showToast('New job started');
  }
};
