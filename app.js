'use strict';
/* ReturnPlay — منطق التطبيق
   بيانات اللاعبين تُحفظ في localStorage لهذا المتصفح فقط. */

/* ================= أدوات عامة ================= */
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => 'id' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const todayISO = () => new Date().toLocaleDateString('en-CA');
function fmtDate(iso){ if(!iso) return '—'; try { return new Intl.DateTimeFormat('ar-EG', {dateStyle:'medium'}).format(new Date(iso)); } catch(e){ return iso; } }
let toastTimer = null;
function toast(msg, warn){
  const t = $('toast'); t.textContent = msg; t.className = 'toast show' + (warn ? ' warn' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = 'toast', 3400);
}
function openModal(html, wide){
  $('modalBox').className = 'modal' + (wide ? ' wide' : '');
  $('modalBox').innerHTML = '<button class="icon-button modal-close" type="button" id="modalCloseBtn" aria-label="إغلاق">✕</button>' + html;
  $('modalRoot').hidden = false;
  $('modalCloseBtn').onclick = closeModal;
}
function closeModal(){ $('modalRoot').hidden = true; $('modalBox').innerHTML = ''; }
function msg(id, txt, ok){ const el = $(id); el.textContent = txt; el.classList.toggle('ok', !!ok); }
function loadScript(src){
  return new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => err(new Error('فشل تحميل ' + src)); document.head.appendChild(s); });
}

/* ================= الحالة والتخزين ================= */
const STORE_KEY = 'returnplay.v1';
let state = { v: 1, players: [], customEx: [], videoLinks: {}, demoPlayerId: null, aiKey: null, lastBackupAt: null, preventionTeam: '' };
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function load(){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw){
      state = Object.assign(state, JSON.parse(raw));
      // ترقية البيانات القديمة: منطقة واحدة → قائمة مناطق + تصحيح الشدة
      (state.players || []).forEach(p => (p.injuries || []).forEach(i => {
        if (typeof i.region === 'string' && !Array.isArray(i.regions)) i.regions = [i.region];
        if (!Array.isArray(i.regions) || !i.regions.length) i.regions = ['knee'];
        if (typeof i.grade === 'string' && i.grade !== '') i.grade = Number(i.grade);
        if (i.grade === '' || i.grade === undefined) i.grade = null;
      }));
      return true;
    }
  } catch(e){ console.warn('تعذر تحميل البيانات', e); }
  return false;
}
const allExercises = () => EXERCISES.concat(state.customEx || []);
const findEx = (id) => allExercises().find(e => e.id === id);
const regionLabel = (r) => REGIONS[r]?.ar || r;
const regionsLabel = (regions) => (regions || []).map(regionLabel).join(' + ');
const aiReady = () => !!state.aiKey;

/* ================= التنقل ================= */
const CRUMBS = { players: 'اللاعبون والحالات', player: 'ملف اللاعب', injury: 'تسجيل إصابة جديدة', builder: 'مولّد البرنامج', program: 'عرض البرنامج', sheet: 'شيت الجلسة', doctor: 'تقرير للطبيب', library: 'مكتبة التمارين', prevention: 'برامج الوقاية', settings: 'النسخ الاحتياطي' };
let currentPlayerId = null, currentInjuryId = null, currentProgramId = null;
function show(view){
  document.querySelectorAll('.page-section').forEach(el => el.hidden = el.id !== 'view-' + view);
  document.querySelectorAll('.nav-link').forEach(el => {
    const active = el.dataset.view === view;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  let crumb = CRUMBS[view] || '';
  if (view === 'player' || view === 'injury' || view === 'builder' || view === 'program' || view === 'sheet' || view === 'doctor'){
    const p = state.players.find(x => x.id === currentPlayerId);
    if (p) crumb = `اللاعبون / <b>${esc(p.name)}</b> / ${CRUMBS[view]}`;
  }
  $('breadcrumb').innerHTML = crumb;
  $('sidebar').classList.remove('open'); $('sidebarBackdrop').classList.remove('show');
  window.scrollTo({ top: 0 });
}

/* ================= خريطة الجسم (اختيار متعدد) ================= */
const HOTSPOTS = [
  { r: 'neck', x: 140, y: 74 }, { r: 'shoulder', x: 164, y: 90 }, { r: 'elbow', x: 185, y: 152 },
  { r: 'wrist', x: 181, y: 198 }, { r: 'chest_abs', x: 140, y: 125 }, { r: 'groin', x: 140, y: 208 },
  { r: 'quad', x: 152, y: 255 }, { r: 'knee', x: 155, y: 302 }, { r: 'ankle', x: 158, y: 388 },
  { r: 'lower_back', x: 420, y: 148 }, { r: 'hip', x: 420, y: 202 }, { r: 'hamstring', x: 434, y: 255 },
  { r: 'calf', x: 421, y: 332 }
];
function figureSVG(x0){
  const s = (dx) => x0 + dx;
  return `
  <g>
    <circle cx="${s(0)}" cy="42" r="24" fill="#dfe9e2" stroke="#a9c0b3" stroke-width="2"/>
    <rect x="${s(-8)}" y="60" width="16" height="16" fill="#dfe9e2" stroke="#a9c0b3" stroke-width="2"/>
    <path d="M${s(-24)} 88 Q${s(0)} 74 ${s(24)} 88 L${s(28)} 190 Q${s(0)} 206 ${s(-28)} 190 Z" fill="#dfe9e2" stroke="#a9c0b3" stroke-width="2"/>
    <path d="M${s(-26)} 96 Q${s(-42)} 122 ${s(-44)} 152 L${s(-40)} 196" stroke="#c9d9cf" stroke-width="15" fill="none" stroke-linecap="round"/>
    <path d="M${s(26)} 96 Q${s(42)} 122 ${s(44)} 152 L${s(40)} 196" stroke="#c9d9cf" stroke-width="15" fill="none" stroke-linecap="round"/>
    <circle cx="${s(-40)}" cy="202" r="8" fill="#c9d9cf"/><circle cx="${s(40)}" cy="202" r="8" fill="#c9d9cf"/>
    <ellipse cx="${s(0)}" cy="206" rx="30" ry="17" fill="#dfe9e2" stroke="#a9c0b3" stroke-width="2"/>
    <path d="M${s(-11)} 214 L${s(-15)} 300 L${s(-16)} 390" stroke="#c9d9cf" stroke-width="19" fill="none" stroke-linecap="round"/>
    <path d="M${s(11)} 214 L${s(15)} 300 L${s(16)} 390" stroke="#c9d9cf" stroke-width="19" fill="none" stroke-linecap="round"/>
    <ellipse cx="${s(-19)}" cy="396" rx="11" ry="6" fill="#c9d9cf"/><ellipse cx="${s(19)}" cy="396" rx="11" ry="6" fill="#c9d9cf"/>
  </g>`;
}
function bodyMapSVG(){
  return `<svg viewBox="0 0 560 420" aria-hidden="true">
    <text x="140" y="414" text-anchor="middle" font-size="14" fill="#7a958a">منظر أمامي</text>
    <text x="420" y="414" text-anchor="middle" font-size="14" fill="#7a958a">منظر خلفي</text>
    ${figureSVG(140)}${figureSVG(420)}
  </svg>`;
}
function renderBodyMap(){
  const sel = (r) => injDraft.regions.has(r);
  $('bodyMap').innerHTML = bodyMapSVG() + HOTSPOTS.map(h =>
    `<button type="button" class="hotspot${sel(h.r) ? ' sel' : ''}" data-region="${h.r}"
      title="${esc(regionLabel(h.r))}" aria-label="${esc(regionLabel(h.r))}" aria-pressed="${sel(h.r)}"
      style="left:${(h.x / 560 * 100).toFixed(2)}%;top:${(h.y / 420 * 100).toFixed(2)}%">●</button>`).join('');
  $('regionChips').innerHTML = Object.entries(REGIONS).map(([k, v]) =>
    `<button type="button" class="region-chip${sel(k) ? ' sel' : ''}" data-region="${k}" aria-pressed="${sel(k)}">${esc(v.ar)} <small>${esc(CAT_LABEL[v.cat] || '')}</small></button>`).join('')
    + '<p class="bodymap-legend">💡 الدوائر على الرسم والقائمة يمثلان نفس المناطق — واضغط تاني على منطقة مختارة لإلغائها.</p>';
  $('regionsCountTag').textContent = injDraft.regions.size + ' مناطق';
}

/* ================= التمرين: رسم + فيديو ================= */
function exerciseThumb(ex){
  const p = PATTERNS[ex.pattern] || PATTERNS.iso;
  return `<svg viewBox="0 0 200 150" role="img" aria-label="رسم توضيحي: ${esc(ex.ar)}">
    <rect width="200" height="150" fill="#f6f4ee"/>
    <circle cx="100" cy="74" r="62" fill="${p.accent}" opacity=".13"/>
    <line x1="30" y1="128" x2="170" y2="128" stroke="#c8d4cc" stroke-width="3" stroke-dasharray="7 8"/>
    ${p.svg}</svg>`;
}
function ytId(url){
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}
function videoInfo(ex){
  const link = state.videoLinks[ex.id];
  if (link){
    const id = ytId(link);
    if (id) return { kind: 'embed', embed: `https://www.youtube.com/embed/${id}`, url: link };
    return { kind: 'link', url: link };
  }
  const q = ex.video || ex.en || ex.ar;
  return { kind: 'search', search: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q), query: q };
}

/* ================= المحلل الذكي المحلي ================= */
function analyzeText(text){
  const res = { regions: [], type: null, grade: null, side: null, pain: null, restrictions: '', phaseHint: null, hits: 0 };
  if (!text || text.trim().length < 3) return res;
  ANALYZER_REGIONS.forEach(r => { if (r.re.test(text) && !res.regions.includes(r.k)){ res.regions.push(r.k); res.hits++; } });
  for (const t of ANALYZER_TYPES){ if (t.re.test(text)){ res.type = t.k; if (res.grade === null && t.grade !== undefined) res.grade = t.grade; res.hits++; break; } }
  for (const g of ANALYZER_GRADE){ if (g.re.test(text)){ res.grade = g.g; res.hits++; break; } }
  for (const s of ANALYZER_SIDE){ if (s.re.test(text)){ res.side = s.s; res.hits++; break; } }
  const num = text.match(/(\d{1,2})\s*(?:من|\/)\s*(?:10|عشرة)/);
  if (num){ const v = Number(num[1]); if (v >= 0 && v <= 10){ res.pain = v; res.hits++; } }
  else for (const p of ANALYZER_PAIN){ if (p.re.test(text)){ res.pain = p.p; res.hits++; break; } }
  const bans = [...text.matchAll(/ممنوع\s+([^،.؛\n]{3,80})/g)].map(m => m[1].trim());
  if (bans.length){ res.restrictions = 'ممنوع: ' + bans.join('، '); res.hits++; }
  for (const ph of ANALYZER_PHASE){ if (ph.re.test(text)){ res.phaseHint = ph.ph; break; } }
  return res;
}

/* ================= الذكاء الاصطناعي (اختياري — Gemini) ================= */
let pendingReport = null; // {name, mime, text?, base64?}
function arrayBufferToBase64(buf){
  const bytes = new Uint8Array(buf); let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}
async function extractPdfText(buf){
  if (!window.pdfjsLib) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  const max = Math.min(doc.numPages, 6);
  for (let i = 1; i <= max; i++){
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map(it => it.str).join(' ') + '\n';
  }
  return text.trim();
}
async function aiAnalyzeReport(desc){
  const key = state.aiKey;
  const parts = [{ text: AI_PROMPT }];
  if (desc) parts.push({ text: 'وصف المدرب: ' + desc });
  if (pendingReport?.text) parts.push({ text: 'نص التقرير المستخرج:\n' + pendingReport.text });
  if (pendingReport?.base64){
    const mime = pendingReport.mime || 'application/pdf';
    parts.push({ inline_data: { mime_type: mime, data: pendingReport.base64 } });
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2 } })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const txt = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('رد غير مفهوم');
  const out = JSON.parse(m[0]);
  return {
    regions: Array.isArray(out.regions) ? out.regions.filter(r => REGIONS[r]) : [],
    type: INJURY_TYPES[out.type] ? out.type : null,
    grade: [0, 1, 2].includes(out.grade) ? out.grade : null,
    side: ['right', 'left', 'both', 'na'].includes(out.side) ? out.side : null,
    pain: out.pain !== null && out.pain !== undefined && Number.isFinite(+out.pain) ? Math.min(10, Math.max(0, +out.pain)) : null,
    summary: String(out.summary || ''),
    restrictions: String(out.restrictions || ''),
    phaseHint: null, source: 'ai'
  };
}

/* ================= مسودة نموذج الإصابة ================= */
const QUICK_TYPE_ICONS = { strain: '💥', sprain: '🌀', tendon: '⚡', overuse: '🔁', postop: '🏥', bone: '🦴' };
const QUICK_GRADES = [{ g: 0, ar: 'بسيط' }, { g: 1, ar: 'متوسط' }, { g: 2, ar: 'شديد / كامل' }];
const QUICK_SIDES = [{ s: 'right', ar: 'يمين' }, { s: 'left', ar: 'شمال' }, { s: 'both', ar: 'الاتنين' }, { s: 'na', ar: 'مش محدد' }];
const QUICK_CLEAR = [{ c: 'allowed', ar: '✅ مسموح تأهيل', hint: 'الطبيب سمح بتمارين' }, { c: 'pending', ar: '⏳ مستني تصريح', hint: 'لسه مفيش قرار' }, { c: 'stopped', ar: '⛔ ممنوع حاليًا', hint: 'الطبيب منع التدريب' }];
let injDraft = null;
function freshDraft(){
  return { regions: new Set(), type: '', grade: '', side: 'na', clearance: 'allowed', pain: 3 };
}
function renderQuickChips(){
  $('quickType').innerHTML = Object.entries(INJURY_TYPES).map(([k, v]) =>
    `<button type="button" class="quick-chip${injDraft.type === k ? ' sel' : ''}" data-qtype="${k}">${QUICK_TYPE_ICONS[k]} ${esc(v.ar)}</button>`).join('');
  $('quickGrade').innerHTML = QUICK_GRADES.map(x =>
    `<button type="button" class="quick-chip${injDraft.grade === x.g ? ' sel' : ''}" data-qgrade="${x.g}">${x.ar}</button>`).join('');
  $('quickSide').innerHTML = QUICK_SIDES.map(x =>
    `<button type="button" class="quick-chip${injDraft.side === x.s ? ' sel' : ''}" data-qside="${x.s}">${x.ar}</button>`).join('');
  $('quickClearance').innerHTML = QUICK_CLEAR.map(x =>
    `<button type="button" class="quick-chip${injDraft.clearance === x.c ? ' sel' : ''}" data-qclear="${x.c}" title="${esc(x.hint)}">${x.ar}</button>`).join('');
  $('painValue').textContent = injDraft.pain;
}
function renderUnderstanding(sourceLabel){
  const box = $('understanding');
  const d = injDraft;
  const items = [];
  if (d.regions.size) items.push('📍 ' + [...d.regions].map(regionLabel).join(' + '));
  if (d.type) items.push(QUICK_TYPE_ICONS[d.type] + ' ' + INJURY_TYPES[d.type].ar + (d.grade !== '' && d.grade !== null ? ' · ' + QUICK_GRADES[d.grade]?.ar : ''));
  if (d.side !== 'na') items.push('↔️ ' + (QUICK_SIDES.find(x => x.s === d.side)?.ar || ''));
  if (d.pain) items.push('😣 ألم ' + d.pain + '/10');
  if (d.phaseHint) items.push('🧭 نقترح نبدأ بـ' + PHASES[d.phaseHint]?.ar);
  if (d.restrictions) items.push('🚫 ' + d.restrictions);
  if (!items.length){ box.hidden = true; return; }
  $('understandingChips').innerHTML = items.map(i => `<span class="understand-chip">${esc(i)}</span>`).join('')
    + (sourceLabel ? `<span class="tag subtle">${esc(sourceLabel)}</span>` : '');
  box.hidden = false;
}
function applyAnalysis(res, sourceLabel){
  if (!res) return;
  (res.regions || []).forEach(r => injDraft.regions.add(r));
  if (res.type) injDraft.type = res.type;
  if (res.grade !== null && res.grade !== undefined && res.grade !== '') injDraft.grade = res.grade;
  if (res.side && res.side !== 'na') injDraft.side = res.side;
  if (res.pain !== null && res.pain !== undefined) injDraft.pain = res.pain;
  if (res.phaseHint) injDraft.phaseHint = res.phaseHint;
  if (res.restrictions && !$('injRestrictions').value.trim()) $('injRestrictions').value = res.restrictions;
  if (res.summary && !$('injReport').value.trim()) $('injReport').value = res.summary;
  renderBodyMap(); renderQuickChips(); renderUnderstanding(sourceLabel);
}
async function runReportAnalysis(label){
  const describe = $('injDescribe').value.trim();
  const hasFile = !!pendingReport;
  if (!hasFile && describe.length < 3) return;
  if (aiReady()){
    $('aiStatus').innerHTML = '<span class="tag blue">🤖 الذكاء الاصطناعي بيقرا التقرير…</span>';
    try {
      const out = await aiAnalyzeReport(describe);
      applyAnalysis(out, '📄 ' + (label || 'من التقرير') + ' — بالذكاء الاصطناعي');
      $('aiStatus').innerHTML = '<span class="tag green">🤖 اتحلل بالذكاء الاصطناعي — راجع الخطوة ٣</span>';
      return;
    } catch(e){
      $('aiStatus').innerHTML = '<span class="tag amber">تعذر تحليل الذكاء الاصطناعي (' + esc(e.message) + ') — استخدمنا المحلل المحلي</span>';
    }
  } else if (hasFile && pendingReport.base64 && !pendingReport.text){
    $('aiStatus').innerHTML = '<span class="tag amber">📄 الصور/المستندات المسوّدة محتاجة تفعيل الذكاء الاصطناعي من صفحة النسخ الاحتياطي — أو انسخ لنا نص التقرير في المربع</span>';
  }
  const local = analyzeText(describe + ' ' + (pendingReport?.text || ''));
  if (local.hits){ applyAnalysis(local, '🔤 ' + (label || 'من وصفك') + ' — محلل محلي'); }
}
function renderAiStatus(){
  $('aiStatus').innerHTML = aiReady()
    ? '<span class="tag green">🤖 الذكاء الاصطناعي مفعّل — هيتقرا الصور والمستندات تلقائيًا</span>'
    : '<span class="tag subtle">🔤 المحلل المحلي شغال (يفهم الوصف المكتوب و PDF النصي) — <a href="#" id="goSettingsAi">فعّل الذكاء الاصطناعي للصور من هنا</a></span>';
  const link = $('goSettingsAi');
  if (link) link.onclick = (e) => { e.preventDefault(); show('settings'); };
}

/* ================= الترشيح: توليد اقتراحات التمارين ================= */
function suggestExercises(region, type, phase){
  const related = REGION_RELATED[region] || [region];
  const scored = allExercises()
    .filter(e => e.phases.includes(phase) && e.regions.some(r => related.includes(r)))
    .map(e => {
      let s = e.regions.includes(region) ? 10 : 2;
      if (e.section === 'warmup') s += 4;
      if (e.section === 'cooldown') s += 3;
      const t = e.tag;
      if (type === 'tendon' && (t === 'isometric' || t === 'eccentric')) s += 6;
      if (type === 'sprain' && (t === 'balance' || t === 'rom' || t === 'mobility')) s += 5;
      if (type === 'strain' && t === 'eccentric' && (phase === 'strength' || phase === 'rtp')) s += 5;
      if (type === 'strain' && t === 'isometric') s += 3;
      if (type === 'postop' && (t === 'rom' || t === 'isometric')) s += 4;
      if (type === 'overuse' && t === 'strength') s += 3;
      if (type === 'bone' && (t === 'rom' || t === 'mobility')) s += 3;
      return { e, s };
    });
  const pick = (section, max) => scored.filter(x => x.e.section === section).sort((a, b) => b.s - a.s).slice(0, max).map(x => x.e);
  return { warmup: pick('warmup', 3), main: pick('main', 8), cooldown: pick('cooldown', 3) };
}
function suggestForInjury(inj, phase){
  const buckets = { warmup: new Map(), main: new Map(), cooldown: new Map() };
  const cap = { warmup: 3, main: 9, cooldown: 4 };
  (inj.regions || []).forEach(r => {
    const sug = suggestExercises(r, inj.type, phase);
    ['warmup', 'main', 'cooldown'].forEach(s => sug[s].forEach(e => { if (!buckets[s].has(e.id)) buckets[s].set(e.id, e); }));
  });
  const out = {};
  ['warmup', 'main', 'cooldown'].forEach(s => out[s] = [...buckets[s].values()].slice(0, cap[s]));
  return out;
}
function defaultDose(ex, phase){
  return (ex.dose && ex.dose[phase]) || DEFAULT_DOSE[ex.tag] || '3×10';
}

/* ================= عرض: اللاعبون ================= */
function clearancesTag(c){
  if (c === 'allowed') return '<span class="tag green">تصريح بالتأهيل</span>';
  if (c === 'pending') return '<span class="tag amber">بانتظار تصريح</span>';
  return '<span class="tag red">ممنوع التدريب حاليًا</span>';
}
function renderPlayers(){
  const grid = $('playersGrid');
  $('playersCount').textContent = state.players.length;
  if (!state.players.length){
    grid.innerHTML = '<div class="empty-note"><h3>لا يوجد لاعبون بعد</h3><p>اضغط «عندي لاعب مصاب — ابدأ هنا» واكتب اسم اللاعب، وهنمشي معاك خطوة خطوة.</p></div>';
    return;
  }
  grid.innerHTML = state.players.map(p => {
    const inj = p.injuries[p.injuries.length - 1];
    const lastInj = inj
      ? `<div class="injury-chip"><span>🩹 ${esc(regionsLabel(inj.regions))} — ${esc(INJURY_TYPES[inj.type]?.ar || '')}</span>${clearancesTag(inj.clearance)}</div>`
      : '<div class="injury-chip"><span>لا إصابات مسجلة</span><span class="tag green">جاهز</span></div>';
    return `<article class="player-card">
      <div class="player-top">
        <div class="avatar">${esc((p.name || '؟').trim().charAt(0))}</div>
        <div><h3>${esc(p.name)}</h3><div class="player-meta">${p.age ? esc(p.age) + ' سنة · ' : ''}${esc(p.position || 'لاعب')}</div></div>
      </div>
      ${lastInj}
      <div class="player-meta">${p.injuries.length} إصابة مسجلة · ${p.injuries.reduce((n, i) => n + i.programs.length, 0)} برنامج</div>
      <div class="btn-row">
        <button class="btn btn-secondary" type="button" data-open-player="${p.id}">فتح الملف</button>
        <button class="btn btn-plain" type="button" data-edit-player="${p.id}">تعديل</button>
      </div>
    </article>`;
  }).join('');
}

/* ================= نافذة إضافة / تعديل لاعب ================= */
function playerFormModal(playerId, thenInjury, prefillName){
  const p = playerId ? state.players.find(x => x.id === playerId) : null;
  openModal(`
    <h2>${p ? 'تعديل بيانات اللاعب' : 'إضافة لاعب جديد'}</h2>
    <p class="player-meta">الاسم بس كفاية — الباقي اختياري.</p>
    <form id="playerForm">
      <label class="field"><span>اسم اللاعب *</span><input id="pfName" maxlength="60" value="${esc(p?.name || prefillName || '')}" placeholder="مثال: يوسف محمد" required></label>
      <div class="field-grid">
        <label class="field"><span>السن (اختياري)</span><input id="pfAge" type="number" min="5" max="70" value="${esc(p?.age || '')}"></label>
        <label class="field"><span>المركز / التخصص (اختياري)</span><input id="pfPos" maxlength="40" value="${esc(p?.position || '')}" placeholder="مثال: لاعب وسط"></label>
      </div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn btn-primary" type="submit">${p ? 'حفظ التعديلات' : (thenInjury ? 'حفظ وابدأ تسجيل الإصابة ←' : 'إضافة اللاعب')}</button>
        <button class="btn btn-plain" type="button" id="pfCancel">إلغاء</button>
      </div>
    </form>`);
  $('pfCancel').onclick = closeModal;
  $('playerForm').onsubmit = (ev) => {
    ev.preventDefault();
    const name = $('pfName').value.trim();
    if (!name) return;
    let pid;
    if (p){ p.name = name; p.age = $('pfAge').value; p.position = $('pfPos').value.trim(); pid = p.id; }
    else {
      const np = { id: uid(), name, age: $('pfAge').value, position: $('pfPos').value.trim(), notes: '', injuries: [] };
      state.players.push(np); pid = np.id;
    }
    save(); closeModal(); renderPlayers();
    if (thenInjury) openInjuryForm(pid);
    else { if (p && currentPlayerId === p.id) renderPlayerView(p.id); toast(p ? 'تم حفظ التعديلات' : 'تمت إضافة اللاعب'); }
  };
}
function quickStartModal(){
  openModal(`
    <h2>يلا نبدأ 🚑</h2>
    <p class="player-meta">اختار اللاعب المصاب — أو اكتب اسم لاعب جديد ونكمل على طول.</p>
    <div id="qsList" class="qs-list">
      ${state.players.map(p => `<button type="button" class="program-row" data-qs="${p.id}" style="width:100%;text-align:right">
        <div><strong>${esc(p.name)}</strong><div class="when">${esc(p.position || 'لاعب')}${p.age ? ' · ' + esc(p.age) + ' سنة' : ''}</div></div>
        <span class="tag green">اختيار ←</span></button>`).join('') || '<p class="player-meta">مفيش لاعبون بعد — اكتب الاسم تحت 👇</p>'}
    </div>
    <div class="video-save" style="margin-top:12px">
      <input id="qsName" placeholder="اسم لاعب جديد (مثال: كريم)">
      <button class="btn btn-primary" type="button" id="qsGo">ابدأ ←</button>
    </div>`);
  $('qsList').querySelectorAll('[data-qs]').forEach(b => b.onclick = () => { closeModal(); openInjuryForm(b.dataset.qs); });
  $('qsGo').onclick = () => {
    const name = $('qsName').value.trim();
    if (!name){ toast('اكتب اسم اللاعب أو اختر من القائمة', true); return; }
    const existing = state.players.find(p => p.name === name);
    closeModal();
    if (existing) openInjuryForm(existing.id);
    else playerFormModal(null, true, name);
  };
}

/* ================= عرض: ملف اللاعب ================= */
function renderPlayerView(pid){
  const p = state.players.find(x => x.id === pid);
  if (!p){ show('players'); return; }
  const sec = $('view-player');
  sec.innerHTML = `
    <div class="page-heading">
      <div><span class="section-overline">PLAYER FILE</span><h2>ملف اللاعب</h2></div>
      <div class="btn-row">
        <button class="btn btn-primary" type="button" id="newInjuryBtn">＋ إصابة جديدة</button>
        <button class="btn btn-secondary" type="button" id="doctorReportBtn">📋 تقرير للطبيب</button>
        <button class="btn btn-plain" type="button" id="backPlayersBtn">← كل اللاعبين</button>
      </div>
    </div>
    <div class="card player-head-card">
      <div class="avatar">${esc((p.name || '؟').trim().charAt(0))}</div>
      <div style="flex:1">
        <h2 style="font-size:1.25rem">${esc(p.name)}</h2>
        <div class="player-meta">${p.age ? esc(p.age) + ' سنة · ' : ''}${esc(p.position || '—')} · مسجل ${fmtDate(p.created)}</div>
        ${p.notes ? `<p style="margin:.3em 0 0;font-size:.88rem;color:var(--ink-soft)">${esc(p.notes)}</p>` : ''}
      </div>
      <button class="btn btn-plain" type="button" id="editPlayerBtn">تعديل البيانات</button>
    </div>
    <h3 class="list-title">الإصابات والبرامج <span class="tag subtle">${p.injuries.length}</span></h3>
    <div id="injuriesList">
      ${p.injuries.length ? p.injuries.slice().reverse().map(inj => injuryBlockHTML(p, inj)).join('') : '<div class="empty-note">لا إصابات مسجلة لهذا اللاعب بعد.</div>'}
    </div>`;
  $('newInjuryBtn').onclick = () => openInjuryForm(p.id);
  $('backPlayersBtn').onclick = () => { show('players'); renderPlayers(); };
  $('editPlayerBtn').onclick = () => playerFormModal(p.id);
  $('doctorReportBtn').onclick = () => openDoctorReport(p.id);
  sec.querySelectorAll('[data-open-program]').forEach(b => b.onclick = () => openProgram(p.id, b.dataset.openProgram.split('|')[0], b.dataset.openProgram.split('|')[1]));
  sec.querySelectorAll('[data-edit-program]').forEach(b => b.onclick = () => openBuilder(p.id, b.dataset.editProgram.split('|')[0], b.dataset.editProgram.split('|')[1]));
  sec.querySelectorAll('[data-sheet-program]').forEach(b => b.onclick = () => openSheet(p.id, b.dataset.sheetProgram.split('|')[0], b.dataset.sheetProgram.split('|')[1]));
  sec.querySelectorAll('[data-del-program]').forEach(b => b.onclick = () => {
    const [injId, progId] = b.dataset.delProgram.split('|');
    const inj = p.injuries.find(i => i.id === injId);
    if (inj && confirm('حذف هذا البرنامج نهائيًا؟')){ inj.programs = inj.programs.filter(x => x.id !== progId); save(); renderPlayerView(p.id); toast('تم حذف البرنامج'); }
  });
  sec.querySelectorAll('[data-add-log]').forEach(b => b.onclick = () => {
    const injId = b.dataset.addLog;
    const inj = p.injuries.find(i => i.id === injId);
    const pain = Number($('logPain-' + injId).value), rpe = Number($('logRpe-' + injId).value), date = $('logDate-' + injId).value, notes = $('logNotes-' + injId).value.trim();
    if (!date || Number.isNaN(pain) || Number.isNaN(rpe) || pain < 0 || pain > 10 || rpe < 0 || rpe > 10){ toast('تأكد من التاريخ والقيم (0–10)', true); return; }
    inj.logs.push({ date, pain, rpe, notes });
    save(); renderPlayerView(p.id);
    toast(pain > inj.pain ? 'تم الحفظ — ⚠️ الألم أعلى من المستوى المسجل: راجع الأحمال' : 'تم تسجيل الجلسة');
  });
  // اختبارات الجاهزية (تحدّث فوري بدون إعادة رسم كاملة حتى لا يفقد المدرب أماكنه)
  sec.querySelectorAll('[data-rtp]').forEach(cb => cb.onchange = () => {
    const [injId, testId] = cb.dataset.rtp.split('|');
    const inj = p.injuries.find(i => i.id === injId); if (!inj) return;
    inj.rtp = inj.rtp || {};
    if (cb.checked) inj.rtp[testId] = { done: todayISO() }; else delete inj.rtp[testId];
    save(); refreshRTPSummary(sec, injId);
  });
  // الترقية التلقائية للمرحلة التالية
  sec.querySelectorAll('[data-promote]').forEach(b => b.onclick = () => {
    const [injId, nextPhase] = b.dataset.promote.split('|');
    const inj = p.injuries.find(i => i.id === injId); if (!inj) return;
    toast('ولّدنا برنامج ' + PHASES[nextPhase].ar + ' — راجع الجرعات قبل الحفظ');
    openBuilder(p.id, injId, null, nextPhase);
  });
  show('player');
}
function injuryBlockHTML(p, inj){
  const type = INJURY_TYPES[inj.type] || {};
  const logsChart = logChartHTML(inj.logs);
  const gradeTxt = (inj.grade !== null && inj.grade !== undefined && inj.grade !== '') ? (type.grades?.[inj.grade] || '') : '';
  const prog = progressionStatus(inj);
  let progBanner = '';
  if (prog === 'stable'){
    const lastProg = inj.programs[inj.programs.length - 1];
    const curN = lastProg ? (PHASES[lastProg.phase]?.n || 1) : 0;
    const next = Object.values(PHASES).find(ph => ph.n === curN + 1);
    if (next) progBanner = `<div class="promo-banner">
      <div><strong>🟢 ${esc(p.name)} مستقر</strong> — آخر الجلسات بدون ألم يُذكر. بمعايير الانتقال دي ${esc(p.name)} مرشح ينتقل إلى <b>${esc(next.ar)}</b> (راجع معايير المرحلة الأول برضه).</div>
      <button class="btn btn-primary" type="button" data-promote="${inj.id}|${next.key}">ولّد برنامج ${esc(next.ar.split('—')[0].trim())} ←</button>
    </div>`;
  } else if (prog === 'worse'){
    progBanner = `<div class="promo-banner warn"><div><strong>🔴 خد بالك:</strong> الألم في الآخر ٣ جلسات مرتفع ومتزايد. قلل الأحمال 30–50%، ارجع لتمارين المرحلة الأخف، وراجع الطبيب لو استمر.</div></div>`;
  }
  return `<div class="injury-block">
    <div class="injury-head">
      <h3>🩹 ${esc(regionsLabel(inj.regions))} — ${esc(type.ar || inj.type)}</h3>
      ${gradeTxt ? `<span class="tag subtle">${esc(gradeTxt)}</span>` : ''}
      <span class="tag blue">${({ right: 'يمين', left: 'شمال', both: 'الجهتين', na: '—' })[inj.side] || '—'}</span>
      ${clearancesTag(inj.clearance)}
      <span class="tag amber">ألم ${inj.pain}/10</span>
      <span class="player-meta" style="margin-inline-start:auto">${fmtDate(inj.date)}</span>
    </div>
    <div class="injury-body">
      ${progBanner}
      ${timelineHTML(inj)}
      ${inj.describe ? `<div class="label">وصف المدرب</div><div class="value">${esc(inj.describe)}</div>` : ''}
      ${inj.report ? `<div class="label">ملخص التقرير الطبي</div><div class="value">${esc(inj.report)}</div>` : ''}
      ${inj.restrictions ? `<div class="label">المحظورات</div><div class="value">${esc(inj.restrictions)}</div>` : ''}
      <div class="label" style="margin-top:14px">البرامج (${inj.programs.length})</div>
      ${inj.programs.length ? inj.programs.map(pr => `
        <div class="program-row">
          <div><strong>${esc(PHASES[pr.phase]?.ar || pr.phase)}</strong>
            <div class="when">${pr.sessionsPerWeek} جلسات/أسبوع · أُنشئ ${fmtDate(pr.created)} · ${pr.items.length} تمرين</div></div>
          <div class="btn-row">
            <button class="btn btn-secondary" type="button" data-open-program="${inj.id}|${pr.id}">عرض / طباعة</button>
            <button class="btn btn-plain" type="button" data-sheet-program="${inj.id}|${pr.id}">📄 شيت الجلسة</button>
            <button class="btn btn-plain" type="button" data-edit-program="${inj.id}|${pr.id}">تعديل</button>
            <button class="btn btn-plain" type="button" data-del-program="${inj.id}|${pr.id}">حذف</button>
          </div>
        </div>`).join('') : '<p class="player-meta" style="margin:6px 0">لم يُولَّد برنامج بعد لهذه الإصابة.</p>'}
      ${rtpBlockHTML(inj)}
      <div class="label" style="margin-top:16px">متابعة الجلسات (${inj.logs.length})</div>
      <div class="log-form-grid" style="margin-top:8px">
        <label class="field"><span>التاريخ</span><input type="date" id="logDate-${inj.id}" value="${todayISO()}"></label>
        <label class="field"><span>الألم بعد الجلسة</span><input type="number" id="logPain-${inj.id}" min="0" max="10" value="2"></label>
        <label class="field"><span>المجهود RPE</span><input type="number" id="logRpe-${inj.id}" min="0" max="10" value="3"></label>
      </div>
      <label class="field"><span>ملاحظة</span><input id="logNotes-${inj.id}" maxlength="200" placeholder="اختياري"></label>
      <button class="btn btn-secondary" type="button" data-add-log="${inj.id}">حفظ المتابعة</button>
      ${logsChart}
      <div class="log-history">
        ${inj.logs.slice().reverse().slice(0, 6).map(l => `<div class="log-item"><div><strong>${fmtDate(l.date)}</strong><span> · مجهود ${l.rpe}/10</span>${l.notes ? `<p>${esc(l.notes)}</p>` : ''}</div><span class="pain-bubble">ألم ${l.pain}/10</span></div>`).join('')}
      </div>
    </div>
  </div>`;
}
function logChartHTML(logs){
  if (!logs || logs.length < 2) return '';
  const vals = logs.map(l => l.pain);
  const W = 520, H = 130, pad = 26, max = 10;
  const pts = vals.map((v, i) => {
    const x = pad + i * ((W - pad * 2) / Math.max(1, vals.length - 1));
    const y = H - 20 - (v / max) * (H - 45);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const dots = vals.map((v, i) => {
    const x = pad + i * ((W - pad * 2) / Math.max(1, vals.length - 1));
    const y = H - 20 - (v / max) * (H - 45);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${v >= 5 ? '#b5482f' : '#1c7c54'}"/>`;
  }).join('');
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="منحنى الألم">
    <line x1="${pad}" y1="${H - 20}" x2="${W - pad}" y2="${H - 20}" stroke="#c8d4cc" stroke-width="2"/>
    <line x1="${pad}" y1="15" x2="${pad}" y2="${H - 20}" stroke="#c8d4cc" stroke-width="2"/>
    <text x="${pad - 8}" y="20" font-size="11" fill="#7a958a" text-anchor="end">10</text>
    <text x="${pad - 8}" y="${H - 16}" font-size="11" fill="#7a958a" text-anchor="end">0</text>
    <polyline points="${pts.join(' ')}" fill="none" stroke="#1c7c54" stroke-width="2.5"/>${dots}
    <text x="${W - pad}" y="14" font-size="11" fill="#7a958a" text-anchor="end">تطور الألم عبر الجلسات</text>
  </svg></div>`;
}

/* ================= الترقية التلقائية بين المراحل ================= */
function progressionStatus(inj){
  const logs = (inj.logs || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const recent = logs.filter(l => (Date.now() - new Date(l.date).getTime()) <= 14 * 864e5).slice(-4);
  if (recent.length < 3) return null;
  const avg = recent.reduce((s, l) => s + l.pain, 0) / recent.length;
  if (avg <= 2.2 && recent.every(l => l.pain <= 3)) return 'stable';
  if (avg >= 5.5) return 'worse';
  return null;
}

/* ================= الخط الزمني المتوقع للتعافي ================= */
function fmtWeeks(w){ return w >= 8 ? 'حوالين ' + Math.round(w / 4.33) + ' شهور' : 'حوالين ' + Math.round(w) + ' أسبوع'; }
function timelineHTML(inj){
  const tl = TIMELINES[inj.type];
  if (!tl) return '';
  const gradeIdx = (inj.grade !== null && inj.grade !== undefined && inj.grade !== '') ? inj.grade : 0;
  const spans = tl.spans[Math.min(gradeIdx, tl.spans.length - 1)];
  if (!spans) return '';
  const keys = Object.keys(PHASES);
  const start = new Date(inj.date || todayISO());
  const totalW = spans.reduce((s, w) => s + w, 0);
  const elapsedDays = Math.max(0, (Date.now() - start.getTime()) / 864e5);
  const todayPct = Math.min(100, (elapsedDays / (totalW * 7)) * 100);
  const lastProg = inj.programs && inj.programs.length ? inj.programs[inj.programs.length - 1] : null;
  let currentIdx = null;
  if (lastProg) currentIdx = keys.indexOf(lastProg.phase);
  else { let acc0 = 0; for (let i = 0; i < spans.length; i++){ acc0 += spans[i] * 7; if (elapsedDays <= acc0){ currentIdx = i; break; } } }
  let acc = 0, segs = '', legend = '';
  spans.forEach((w, i) => {
    const pct = (w / totalW) * 100;
    const from = new Date(start.getTime() + acc * 7 * 864e5);
    const to = new Date(start.getTime() + (acc + w) * 7 * 864e5);
    acc += w;
    const ph = PHASES[keys[i]];
    const now = currentIdx === i;
    segs += `<div class="tl-seg${now ? ' now' : ''}" style="width:${pct}%;background:${PHASE_COLORS[keys[i]]}">${ph.n}</div>`;
    legend += `<span class="tl-item${now ? ' now' : ''}"><i style="background:${PHASE_COLORS[keys[i]]}"></i>${esc(ph.ar.split('—')[0].trim())}: ${fmtDate(from.toISOString().slice(0, 10))} ← ${fmtDate(to.toISOString().slice(0, 10))}</span>`;
  });
  return `<div class="timeline">
    <div class="tl-title">🗓 الخط الزمني المتوقع <span class="tag subtle">الإجمالي ${fmtWeeks(totalW)}</span></div>
    <div class="tl-bar">${segs}<div class="tl-today" style="right:${todayPct.toFixed(1)}%"><span>النهارده</span></div></div>
    <div class="tl-legend">${legend}</div>
    <p class="minor">تقدير إرشادي عام حسب نوع ودرجة الإصابة — الجدول الحقيقي بيحدده استجابة اللاعب وقرار الطبيب.</p>
  </div>`;
}

/* ================= اختبارات الجاهزية للرجوع للملاعب ================= */
function rtpListFor(inj){
  const list = RTP_GENERAL.map(t => ({ ...t }));
  const seen = new Set(RTP_GENERAL.map(t => t.id));
  (inj.regions || []).forEach(r => (RTP_TESTS[r] || []).forEach(t => { if (!seen.has(t.id)){ seen.add(t.id); list.push(t); } }));
  return list;
}
function rtpPct(inj){
  const list = rtpListFor(inj);
  const done = list.filter(t => inj.rtp && inj.rtp[t.id]).length;
  return { done, total: list.length, pct: list.length ? Math.round(done / list.length * 100) : 0 };
}
function rtpBlockHTML(inj){
  const st = rtpPct(inj);
  const rows = rtpListFor(inj).map(t => {
    const rec = inj.rtp && inj.rtp[t.id];
    return `<label class="rtp-row${rec ? ' done' : ''}">
      <input type="checkbox" data-rtp="${inj.id}|${t.id}" ${rec ? 'checked' : ''}>
      <span class="rtp-main"><b>${esc(t.name)}</b><small>${esc(t.how)}</small>${rec ? `<span class="rtp-date">✓ اجتازه ${fmtDate(rec.done)}</span>` : ''}</span>
    </label>`;
  }).join('');
  return `<details class="rtp-block" id="rtpBlock-${inj.id}" ${st.done ? 'open' : ''}>
    <summary>✅ اختبارات الرجوع للملاعب <span class="tag ${st.pct >= 100 ? 'green' : st.pct >= 60 ? 'amber' : 'subtle'}" data-rtp-pct="${inj.id}">${st.pct}% جاهزية (${st.done}/${st.total})</span></summary>
    <p class="minor">علّم على كل اختبار أول ما اللاعب يجتازه — لما يوصل 100% الأداة تحسبه جاهز للعودة، وتواريخ الاجتياز تظهر في تقرير الطبيب.</p>
    ${rows}
  </details>`;
}
function refreshRTPSummary(sec, injId){
  const p = state.players.find(x => x.id === currentPlayerId); if (!p) return;
  const inj = p.injuries.find(i => i.id === injId); if (!inj) return;
  const details = sec.querySelector('#rtpBlock-' + injId); if (!details) return;
  const st = rtpPct(inj);
  const tag = details.querySelector('[data-rtp-pct]');
  if (tag){
    tag.className = 'tag ' + (st.pct >= 100 ? 'green' : st.pct >= 60 ? 'amber' : 'subtle');
    tag.textContent = st.pct + '% جاهزية (' + st.done + '/' + st.total + ')';
  }
  const rows = details.querySelectorAll('.rtp-row');
  rtpListFor(inj).forEach((t, i) => {
    const row = rows[i]; if (!row) return;
    const rec = inj.rtp && inj.rtp[t.id];
    row.classList.toggle('done', !!rec);
    const dateEl = row.querySelector('.rtp-date');
    if (rec && !dateEl) row.querySelector('.rtp-main').insertAdjacentHTML('beforeend', `<span class="rtp-date">✓ اجتازه ${fmtDate(rec.done)}</span>`);
    if (!rec && dateEl) dateEl.remove();
  });
  if (st.pct >= 100) toast('🎉 ' + p.name + ' استوفى كل اختبارات الجاهزية — جاهز للعودة بموافقة الطبيب');
}

/* ================= فيديوهات محلية من جهاز المدرب (IndexedDB — تعمل أوفلاين) ================= */
let mediaDB = null;
function mediaOpen(){
  return new Promise((ok, err) => {
    if (mediaDB) return ok(mediaDB);
    if (!('indexedDB' in window)) return err(new Error('غير مدعوم'));
    const rq = indexedDB.open('returnplay-media', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('videos');
    rq.onsuccess = () => { mediaDB = rq.result; ok(mediaDB); };
    rq.onerror = () => err(rq.error);
  });
}
function mediaTxC(mode, fn){
  return mediaOpen().then(db => new Promise((ok, err) => {
    const tx = db.transaction('videos', mode);
    const rq = fn(tx.objectStore('videos'));
    tx.oncomplete = () => ok(rq && rq.result);
    tx.onerror = () => err(tx.error);
  }));
}
const mediaGet = (id) => mediaTxC('readonly', s => s.get(id));
const mediaPut = (id, blob) => mediaTxC('readwrite', s => s.put(blob, id));
const mediaDel = (id) => mediaTxC('readwrite', s => s.delete(id));
async function mediaStats(){
  try {
    const keys = await mediaTxC('readonly', s => s.getAllKeys());
    let usage = 0;
    if (navigator.storage && navigator.storage.estimate) usage = (await navigator.storage.estimate()).usage || 0;
    return { count: keys.length, mb: (usage / 1048576).toFixed(1) };
  } catch(e){ return { count: 0, mb: '0' }; }
}
async function hydrateLocalVideo(exId){
  try {
    const blob = await mediaGet(exId);
    if (!blob) return;
    const slot = document.getElementById('localVideoSlot-' + exId);
    if (!slot) return;
    slot.innerHTML = `<div class="video-frame"><video controls playsinline src="${URL.createObjectURL(blob)}"></video></div>
      <button class="mini-btn danger" type="button" id="delLocalVideo-${exId}" style="margin-top:6px">حذف الفيديو المحلي ✕</button>`;
    const del = document.getElementById('delLocalVideo-' + exId);
    if (del) del.onclick = async () => { await mediaDel(exId); toast('تم حذف الفيديو المحلي'); closeModal(); exerciseModal(exId); };
  } catch(e){ /* التخزين غير متاح — نتجاهل بصمت */ }
}
async function renderMediaStats(){
  const s = await mediaStats();
  $('mediaStats').textContent = s.count
    ? 'عدد الفيديوهات المحفوظة: ' + s.count + ' · مساحة مستخدمة على الجهاز: ~' + s.mb + ' ميجا'
    : 'مفيش فيديوهات محلية لسه — افتح أي تمرين من المكتبة واضغط «ارفع فيديو من جهازك».';
}

/* ================= QR + مشاركة البرنامج برابط (بدون سيرفر) ================= */
function makeQR(text){
  try {
    if (typeof qrcode === 'undefined') return null;
    const qr = qrcode(0, 'M');
    qr.addData(text); qr.make();
    return qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true });
  } catch(e){ return null; }
}
function b64urlEncode(str){ return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64urlDecode(str){ return decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/')))); }
function programShareURL(meta, items){
  const payload = Object.assign({}, meta, { items: items.map(i => [i.exId, (findEx(i.exId) || {}).ar || i.ar || '', i.dose]) });
  const base = (location.protocol === 'file:' || location.origin === 'null')
    ? 'https://coral-cattle-635358.hostingersite.com/rehab/'
    : location.origin + location.pathname;
  return base + '#share=' + b64urlEncode(JSON.stringify(payload));
}
function parseShareHash(){
  const m = location.hash.match(/#share=([\w-]+)/);
  if (!m) return null;
  try { return JSON.parse(b64urlDecode(m[1])); } catch(e){ return null; }
}
async function copyText(t){
  try { await navigator.clipboard.writeText(t); return true; }
  catch(e){
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const okr = document.execCommand('copy'); ta.remove(); return okr;
  }
}
function shareWhatsApp(title, url){
  window.open('https://wa.me/?text=' + encodeURIComponent(title + '\n' + url), '_blank');
}
function renderShareView(data){
  document.body.classList.add('share-mode');
  const items = (data.items || []).map(([exId, ar, dose]) => ({ exId, ar, dose, ex: findEx(exId) }));
  const ph = PHASES[data.p];
  const sections = ['warmup', 'main', 'cooldown'];
  const body = sections.map(s => {
    const list = items.filter(i => (i.ex ? i.ex.section : 'main') === s);
    if (!list.length) return '';
    return `<div class="prog-section-title"><span class="bar" style="background:${SECTIONS[s].color}"></span><h3>${esc(SECTIONS[s].ar)}</h3></div>
      <div class="prog-ex-grid">${list.map(i => {
        const ex = i.ex;
        const vi = ex ? videoInfo(ex) : null;
        return `<div class="prog-ex">
          <div class="row">${ex ? `<div class="thumb">${exerciseThumb(ex)}</div>` : ''}
            <div><h4>${esc(ex ? ex.ar : i.ar || 'تمرين')}</h4><div class="dose">${esc(i.dose || '')}</div></div></div>
          ${ex ? `<p>${esc(ex.desc)}</p>` : ''}
          ${ex && ex.cues.length ? `<p><b>تصحيحات:</b> ${esc(ex.cues.join(' — '))}</p>` : ''}
          ${vi ? `<div class="video-hint">▶ شرح بالفيديو: ${vi.kind === 'search' ? 'youtube.com/results?search_query=' + encodeURIComponent(vi.query) : esc(vi.url || '')}</div>` : ''}
        </div>`;
      }).join('')}</div>`;
  }).join('');
  $('view-share').innerHTML = `
    <div class="print-sheet">
      <div class="prog-header">
        <div>
          <div class="section-overline">RETURNPLAY — SHARED PROGRAM</div>
          <h2>${data.tm ? 'برنامج وقاية جماعي' : 'برنامج تأهيلي مشترك'}</h2>
          <div class="who"><b>${esc(data.n || '')}</b></div>
          ${data.m ? `<div class="who">${esc(data.m)}</div>` : ''}
        </div>
        <div style="text-align:left;font-size:.85rem;color:var(--ink-soft)">${ph ? `<div>${esc(ph.ar)}</div>` : ''}<div>${fmtDate(todayISO())}</div></div>
      </div>
      ${body}
      <div class="prog-criteria">${data.tm ? '<h4>برنامج وقائي عام للفريق</h4><ul><li>يُنفذ بعد الإحماء وبإشراف المدرب</li><li>زِد الجرعات تدريجيًا من أسبوع لأسبوع</li></ul>' : '<h4>ملاحظات</h4><ul><li>أوقف أي تمرين يسبب ألمًا حادًا أو تورمًا</li><li>البرنامج مسودة إرشادية — الجرعات النهائية يعتمدها أخصائي التأهيل</li></ul>'}</div>
      <div class="prog-footer-note">هذا البرنامج مُشارك من أداة <b>ReturnPlay</b> — <a href="${esc(location.pathname)}">افتح الأداة الكاملة ↗</a></div>
    </div>`;
  show('share');
}

/* ================= شيت الجلسة اليومي (طباعة + QR) ================= */
function openSheet(pid, injId, progId){
  currentPlayerId = pid; currentInjuryId = injId; currentProgramId = progId;
  const p = state.players.find(x => x.id === pid);
  const inj = p && p.injuries.find(i => i.id === injId);
  const pr = inj && inj.programs.find(x => x.id === progId);
  if (!p || !inj || !pr){ show('players'); return; }
  const ph = PHASES[pr.phase] || {};
  const type = INJURY_TYPES[inj.type] || {};
  const url = programShareURL({ n: p.name, m: regionsLabel(inj.regions) + ' — ' + (type.ar || ''), p: pr.phase }, pr.items);
  const qr = makeQR(url);
  const rows = pr.items.map(item => {
    const ex = findEx(item.exId); if (!ex) return '';
    return `<div class="sheet-row">
      <span class="sheet-check"></span>
      <div class="thumb">${exerciseThumb(ex)}</div>
      <div class="sheet-main"><h4>${esc(ex.ar)}</h4><div class="dose">${esc(item.dose)}</div>${ex.cues.length ? `<div class="cue">${esc(ex.cues[0])}</div>` : ''}</div>
    </div>`;
  }).join('');
  const sec = $('view-sheet');
  sec.innerHTML = `
    <div class="prog-toolbar no-print">
      <button class="btn btn-primary" type="button" id="printSheetBtn">🖨 طباعة الشيت</button>
      <button class="btn btn-secondary" type="button" id="sheetWaBtn">💬 واتساب للاعب</button>
      <button class="btn btn-plain" type="button" id="sheetCopyBtn">🔗 نسخ رابط الفيديوهات</button>
      <button class="btn btn-plain" type="button" id="sheetBackBtn">← رجوع للملف</button>
    </div>
    <div class="print-sheet">
      <div class="prog-header">
        <div>
          <div class="section-overline">SESSION SHEET — RETURNPLAY</div>
          <h2>شيت جلسة اليوم</h2>
          <div class="who"><b>${esc(p.name)}</b>${p.position ? ' · ' + esc(p.position) : ''}</div>
          <div class="who">${esc(regionsLabel(inj.regions))} — ${esc(type.ar || '')}</div>
        </div>
        <div style="text-align:left;font-size:.85rem;color:var(--ink-soft)">
          <div>التاريخ: <b>${fmtDate(todayISO())}</b></div>
          <div>${esc(ph.ar || '')}</div>
          <div>${esc(pr.sessionsPerWeek)} جلسات أسبوعيًا</div>
        </div>
      </div>
      ${qr ? `<div class="sheet-qr"><div class="qr-box">${qr}</div><small>امسح الكود بكاميرا الموبايل → يفتح البرنامج وفيديوهات كل تمرين</small></div>` : ''}
      ${inj.restrictions ? `<div class="prog-restrict"><strong>محظورات طبية:</strong> ${esc(inj.restrictions)}</div>` : ''}
      ${rows}
      <div class="prog-footer-note">علّم ✓ بعد كل تمرين. أوقف أي تمرين يسبب ألمًا حادًا. الأداة: ReturnPlay — مسودة إرشادية لا تغني عن الطبيب أو أخصائي التأهيل.</div>
    </div>`;
  $('printSheetBtn').onclick = () => window.print();
  $('sheetBackBtn').onclick = () => renderPlayerView(currentPlayerId);
  $('sheetCopyBtn').onclick = async () => { (await copyText(url)) ? toast('تم نسخ الرابط — يفتح البرنامج وفيديوهاته من أي موبايل') : toast('تعذر النسخ', true); };
  $('sheetWaBtn').onclick = () => shareWhatsApp('برنامج جلسة النهارده لـ ' + p.name + ' (' + (ph.ar || '') + ')', url);
  show('sheet');
}

/* ================= تقرير للطبيب / أخصائي التأهيل ================= */
function openDoctorReport(pid){
  currentPlayerId = pid;
  const p = state.players.find(x => x.id === pid); if (!p) return;
  const injBlocks = p.injuries.length ? p.injuries.map(inj => {
    const type = INJURY_TYPES[inj.type] || {};
    const gradeTxt = (inj.grade !== null && inj.grade !== undefined && inj.grade !== '') ? (type.grades?.[inj.grade] || '') : '';
    const st = rtpPct(inj);
    const logs = (inj.logs || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const first = logs[0], last = logs[logs.length - 1];
    const doneTests = rtpListFor(inj).filter(t => inj.rtp && inj.rtp[t.id]);
    const lastProg = inj.programs[inj.programs.length - 1];
    return `<div class="doc-injury">
      <h3>🩹 ${esc(regionsLabel(inj.regions))} — ${esc(type.ar || inj.type)}${gradeTxt ? ' (' + esc(gradeTxt) + ')' : ''} ${inj.side !== 'na' ? '· ' + ({ right: 'يمين', left: 'شمال', both: 'الجهتين' })[inj.side] : ''}</h3>
      <table class="dose-table">
        <tr><td>تاريخ الإصابة</td><td>${fmtDate(inj.date)}</td></tr>
        <tr><td>الألم عند التسجيل → الآن</td><td>${inj.pain}/10 → ${last ? last.pain + '/10' : inj.pain + '/10'}${last ? ' (أول تسجيل ' + first.pain + '/10)' : ''}</td></tr>
        <tr><td>حالة المتابعة</td><td>${logs.length} جلسة مسجلة · التصريح: ${({ allowed: 'تأهيل مسموح', pending: 'بانتظار تصريح', stopped: 'ممنوع حاليًا' })[inj.clearance] || '—'}</td></tr>
        ${inj.report ? `<tr><td>ملخص التقرير الطبي</td><td>${esc(inj.report)}</td></tr>` : ''}
        ${inj.restrictions ? `<tr><td>المحظورات</td><td>${esc(inj.restrictions)}</td></tr>` : ''}
        ${lastProg ? `<tr><td>البرنامج الحالي</td><td>${esc(PHASES[lastProg.phase]?.ar || lastProg.phase)} · ${lastProg.sessionsPerWeek} جلسات/أسبوع · ${lastProg.items.length} تمرين</td></tr>` : ''}
        <tr><td>اختبارات الجاهزية</td><td><b>${st.pct}%</b> (${st.done}/${st.total})${doneTests.length ? '<br>' + doneTests.map(t => '✓ ' + esc(t.name) + ' — ' + fmtDate(inj.rtp[t.id].done)).join('<br>') : ''}</td></tr>
      </table>
      ${logs.length ? logChartHTML(logs) : ''}
      ${logs.length ? `<div class="doc-logs">${logs.slice(-8).map(l => `<span class="tag subtle">${fmtDate(l.date)}: ألم ${l.pain} · مجهود ${l.rpe}</span>`).join(' ')}</div>` : ''}
    </div>`;
  }).join('') : '<p class="player-meta">لا إصابات مسجلة.</p>';
  const sec = $('view-doctor');
  sec.innerHTML = `
    <div class="prog-toolbar no-print">
      <button class="btn btn-primary" type="button" id="printDocBtn">🖨 طباعة / حفظ PDF</button>
      <button class="btn btn-plain" type="button" id="docBackBtn">← رجوع للملف</button>
    </div>
    <div class="print-sheet">
      <div class="prog-header">
        <div>
          <div class="section-overline">REHAB FOLLOW-UP REPORT — RETURNPLAY</div>
          <h2>تقرير متابعة تأهيلي</h2>
          <div class="who"><b>${esc(p.name)}</b>${p.age ? ' · ' + esc(p.age) + ' سنة' : ''}${p.position ? ' · ' + esc(p.position) : ''}</div>
        </div>
        <div style="text-align:left;font-size:.85rem;color:var(--ink-soft)">
          <div>تاريخ التقرير: <b>${fmtDate(todayISO())}</b></div>
          <div>أُعد بواسطة المدرب عبر أداة ReturnPlay</div>
        </div>
      </div>
      ${injBlocks}
      <div class="doc-sign">
        <span>توقيع المدرب: ..................</span>
        <span>توقيع الطبيب / الأخصائي: ..................</span>
      </div>
      <div class="prog-footer-note">هذا التقرير مُجمّع آليًا من تسجيلات المدرب في أداة ReturnPlay لغرض التواصل مع الفريق الطبي — البيانات تقديرية وذاتية ولا تغني عن التقييم المباشر.</div>
    </div>`;
  $('printDocBtn').onclick = () => window.print();
  $('docBackBtn').onclick = () => renderPlayerView(currentPlayerId);
  show('doctor');
}

/* ================= برامج الوقاية الجماعية ================= */
let currentPreventionId = null;
function renderPrevention(){
  $('preventionGrid').hidden = false;
  $('preventionSheetWrap').hidden = true;
  $('preventionGrid').innerHTML = PREVENTION_PROGRAMS.map(pr => `
    <article class="prevention-card">
      <span class="section-overline">${esc(pr.when || '')}</span>
      <h3>${esc(pr.ar)}</h3>
      <p>${esc(pr.desc)}</p>
      <div class="player-meta">⏱ ${esc(pr.duration)} · ${pr.items.length} تمرين</div>
      <div class="btn-row">
        <button class="btn btn-primary" type="button" data-prev-open="${pr.id}">عرض وطباعة ←</button>
        <button class="btn btn-plain" type="button" data-prev-share="${pr.id}">💬 واتساب</button>
      </div>
    </article>`).join('');
  $('preventionGrid').querySelectorAll('[data-prev-open]').forEach(b => b.onclick = () => openPreventionSheet(b.dataset.prevOpen));
  $('preventionGrid').querySelectorAll('[data-prev-share]').forEach(b => b.onclick = () => {
    const pr = PREVENTION_PROGRAMS.find(x => x.id === b.dataset.prevShare);
    shareWhatsApp('برنامج وقاية: ' + pr.ar + ' — من أداة ReturnPlay', programShareURL({ n: state.preventionTeam || 'الفريق', m: pr.ar, tm: 1 }, pr.items));
  });
}
function openPreventionSheet(id){
  const pr = PREVENTION_PROGRAMS.find(x => x.id === id); if (!pr) return;
  currentPreventionId = id;
  $('preventionGrid').hidden = true;
  $('preventionSheetWrap').hidden = false;
  const url = programShareURL({ n: state.preventionTeam || 'الفريق', m: pr.ar, tm: 1 }, pr.items);
  const qr = makeQR(url);
  const sections = ['warmup', 'main', 'cooldown'];
  const body = sections.map(s => {
    const list = pr.items.filter(i => (findEx(i.exId) || {}).section === s);
    if (!list.length) return '';
    return `<div class="prog-section-title"><span class="bar" style="background:${SECTIONS[s].color}"></span><h3>${esc(SECTIONS[s].ar)}</h3></div>
      <div class="prog-ex-grid">${list.map(i => {
        const ex = findEx(i.exId); if (!ex) return '';
        return `<div class="prog-ex"><div class="row"><div class="thumb">${exerciseThumb(ex)}</div>
          <div><h4>${esc(ex.ar)}</h4><div class="dose">${esc(i.dose)}</div></div></div>
          <p>${esc(ex.desc)}</p>
          ${ex.cues.length ? `<p><b>تصحيحات:</b> ${esc(ex.cues.slice(0, 2).join(' — '))}</p>` : ''}</div>`;
      }).join('')}</div>`;
  }).join('');
  $('preventionSheet').innerHTML = `
    <div class="prog-header">
      <div>
        <div class="section-overline">PREVENTION PROGRAM — RETURNPLAY</div>
        <h2>${esc(pr.ar)}</h2>
        <div class="who"><b>${esc(state.preventionTeam || 'الفريق')}</b> · ${esc(pr.duration)} · ${esc(pr.when || '')}</div>
      </div>
      <div style="text-align:left;font-size:.85rem;color:var(--ink-soft)"><div>التاريخ: <b>${fmtDate(todayISO())}</b></div></div>
    </div>
    ${qr ? `<div class="sheet-qr"><div class="qr-box">${qr}</div><small>امسح بكاميرا الموبايل → البرنامج وفيديوهاته</small></div>` : ''}
    ${body}
    <div class="prog-footer-note">برنامج وقاية إرشادي — اضبط الجرعات حسب أعمار اللاعبين ومستواهم، وأوقف أي تمرين يسبب ألمًا. أداة ReturnPlay لا تغني عن أخصائي التأهيل.</div>`;
  show('prevention');
}

/* ================= تذكير النسخة الاحتياطية ================= */
const BACKUP_DAYS = 7;
function renderBackupBanner(){
  const b = $('backupBanner'); if (!b) return;
  if (document.body.classList.contains('share-mode')){ b.hidden = true; }
  else {
    const hasData = state.players.length || (state.customEx || []).length;
    const days = state.lastBackupAt ? Math.floor((Date.now() - new Date(state.lastBackupAt).getTime()) / 864e5) : null;
    const need = hasData && (days === null || days >= BACKUP_DAYS);
    b.hidden = !need;
    if (need) $('backupBannerText').innerHTML = days === null
      ? '⚠️ بياناتك محفوظة على هذا المتصفح فقط — خد نسخة احتياطية دلوقتي (دقيقة واحدة وتنزل ملف على جهازك).'
      : '⚠️ آخر نسخة احتياطية كانت من <b>' + days + ' يوم</b> — الأفضل تصدّر نسخة جديدة.';
  }
  const info = $('lastBackupInfo');
  if (info) info.innerHTML = state.lastBackupAt
    ? 'آخر نسخة احتياطية: <b>' + fmtDate(state.lastBackupAt) + '</b> · الأداة بتفكّك كل ' + BACKUP_DAYS + ' أيام.'
    : 'لسه مفيش نسخة احتياطية من هذا الجهاز.';
}

/* ================= PWA: التثبيت كتطبيق ================= */
let deferredPrompt = null;
function setupPWA(){
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const btn = $('installBtn'), st = $('installStatus'); if (!btn) return;
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone){
    st.textContent = '✅ الأداة مثبتة بالفعل كتطبيق على هذا الجهاز.';
    return;
  }
  const refresh = () => {
    if (deferredPrompt){ btn.hidden = false; st.textContent = 'اضغط الزر — هتظهر نافذة تثبيت من المتصفح مباشرة.'; }
    else st.textContent = 'التثبيت متاح من قائمة المتصفح: (⋮) ← «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».';
  };
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; refresh(); });
  btn.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null; btn.hidden = true;
    st.textContent = 'لو ما ظهرتش نافذة التثبيت: افتح قائمة المتصفح (⋮) واختار «تثبيت التطبيق».';
  };
  refresh();
}

/* ================= عرض: تسجيل إصابة (٣ خطوات) ================= */
function openInjuryForm(pid){
  currentPlayerId = pid; currentInjuryId = null;
  const p = state.players.find(x => x.id === pid); if (!p) return;
  injDraft = freshDraft();
  pendingReport = null;
  $('injuryTitle').textContent = 'إصابة جديدة: ' + p.name;
  $('injuryPlayerInfo').innerHTML = `<span class="tag subtle">${esc(p.name)}</span>`;
  $('injDescribe').value = '';
  $('injReport').value = '';
  $('injRestrictions').value = '';
  $('injDate').value = todayISO();
  $('reportFileInfo').textContent = '';
  $('clearReportBtn').hidden = true;
  $('understanding').hidden = true;
  $('injuryForm').reset();
  $('injDate').value = todayISO();
  renderAiStatus();
  renderBodyMap(); renderQuickChips();
  msg('injuryMessage', '');
  show('injury');
}
function setupInjuryForm(){
  // اختيار المناطق (متعدد)
  const toggleRegion = (r) => {
    if (injDraft.regions.has(r)) injDraft.regions.delete(r);
    else { if (injDraft.regions.size >= 4){ toast('الحد الأقصى ٤ مناطق معًا — شيل واحدة الأول', true); return; } injDraft.regions.add(r); }
    renderBodyMap(); renderUnderstanding('');
  };
  $('bodyMap').addEventListener('click', (e) => { const b = e.target.closest('[data-region]'); if (b) toggleRegion(b.dataset.region); });
  $('regionChips').addEventListener('click', (e) => { const b = e.target.closest('[data-region]'); if (b) toggleRegion(b.dataset.region); });

  // الشيبس السريعة
  $('quickType').addEventListener('click', (e) => { const b = e.target.closest('[data-qtype]'); if (b){ injDraft.type = b.dataset.qtype; renderQuickChips(); renderUnderstanding('اختيارك'); } });
  $('quickGrade').addEventListener('click', (e) => { const b = e.target.closest('[data-qgrade]'); if (b){ injDraft.grade = Number(b.dataset.qgrade); renderQuickChips(); renderUnderstanding('اختيارك'); } });
  $('quickSide').addEventListener('click', (e) => { const b = e.target.closest('[data-qside]'); if (b){ injDraft.side = b.dataset.qside; renderQuickChips(); renderUnderstanding('اختيارك'); } });
  $('quickClearance').addEventListener('click', (e) => { const b = e.target.closest('[data-qclear]'); if (b){ injDraft.clearance = b.dataset.qclear; renderQuickChips(); } });
  $('injPain').oninput = (e) => { injDraft.pain = Number(e.target.value); $('painValue').textContent = e.target.value; };

  // تحليل حي أثناء الكتابة
  let descTimer = null;
  $('injDescribe').oninput = () => {
    clearTimeout(descTimer);
    descTimer = setTimeout(() => {
      const local = analyzeText($('injDescribe').value);
      if (!local.hits) return;
      local.regions.forEach(r => { if (injDraft.regions.size < 4) injDraft.regions.add(r); });
      if (!injDraft.type && local.type) injDraft.type = local.type;
      if (injDraft.grade === '' && local.grade !== null) injDraft.grade = local.grade;
      if (injDraft.side === 'na' && local.side) injDraft.side = local.side;
      if (local.pain !== null) injDraft.pain = local.pain;
      if (local.phaseHint) injDraft.phaseHint = local.phaseHint;
      if (local.restrictions && !$('injRestrictions').value.trim()) $('injRestrictions').value = local.restrictions;
      renderBodyMap(); renderQuickChips(); renderUnderstanding('🔤 من وصفك — راجع الخطوة ٣');
    }, 700);
  };

  // رفع التقرير
  $('uploadReportBtn').onclick = () => $('reportFile').click();
  $('reportFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    pendingReport = null;
    $('reportFileInfo').textContent = f.name;
    $('aiStatus').innerHTML = '<span class="tag amber">⏳ جاري قراءة الملف…</span>';
    try {
      const buf = await f.arrayBuffer();
      const mime = f.type || '';
      if (mime === 'application/pdf' || /\.pdf$/i.test(f.name)){
        let text = '';
        try { text = await extractPdfText(buf); } catch(err){ text = ''; }
        pendingReport = text ? { name: f.name, mime, text } : { name: f.name, mime: 'application/pdf', base64: arrayBufferToBase64(buf) };
        $('reportFileInfo').textContent = f.name + (text ? ' — استخرجنا النص ✓' : '');
      } else if (mime.startsWith('image/')){
        pendingReport = { name: f.name, mime, base64: arrayBufferToBase64(buf) };
        $('reportFileInfo').textContent = f.name;
      } else throw new Error('نوع غير مدعوم');
      $('clearReportBtn').hidden = false;
      await runReportAnalysis('من التقرير');
    } catch(err){
      $('aiStatus').innerHTML = '<span class="tag red">تعذر قراءة الملف — جرّب صورة أو PDF، أو انسخ أهم النقاط في المربع</span>';
    }
    e.target.value = '';
  };
  $('clearReportBtn').onclick = () => {
    pendingReport = null;
    $('reportFileInfo').textContent = '';
    $('clearReportBtn').hidden = true;
    renderAiStatus();
  };

  $('injuryCancel').onclick = () => { show('players'); renderPlayers(); };

  $('injuryForm').onsubmit = (ev) => {
    ev.preventDefault();
    const p = state.players.find(x => x.id === currentPlayerId); if (!p) return;
    if (!injDraft.regions.size){ msg('injuryMessage', 'اختار منطقة واحدة على الأقل من جسم اللاعب 👆'); return; }
    const type = injDraft.type || 'strain';
    if (!injDraft.type) toast('افترضنا إن المشكلة شد عضلي — صحّحها في الخطوة ٣ لو مختلفة', true);
    const inj = {
      id: uid(), regions: [...injDraft.regions], region: [...injDraft.regions][0],
      type, grade: injDraft.grade === '' ? null : injDraft.grade,
      side: injDraft.side, date: $('injDate').value || todayISO(),
      clearance: injDraft.clearance, pain: injDraft.pain,
      describe: $('injDescribe').value.trim(),
      report: $('injReport').value.trim(), restrictions: $('injRestrictions').value.trim(),
      phaseHint: injDraft.phaseHint || null,
      created: todayISO(), programs: [], logs: []
    };
    p.injuries.push(inj);
    save();
    toast('تم حفظ الإصابة — يلا نولّد البرنامج');
    openBuilder(p.id, inj.id);
  };
}

/* ================= عرض: مولّد البرنامج ================= */
let draftItems = [];
let builderPhase = 'subacute', builderSessions = '3';
function openBuilder(pid, injId, progId, forcePhase){
  currentPlayerId = pid; currentInjuryId = injId;
  const p = state.players.find(x => x.id === pid);
  const inj = p && p.injuries.find(i => i.id === injId);
  if (!p || !inj){ show('players'); return; }
  currentProgramId = progId || null;

  if (progId){
    const pr = inj.programs.find(x => x.id === progId);
    if (pr){
      draftItems = JSON.parse(JSON.stringify(pr.items));
      builderPhase = pr.phase; builderSessions = String(pr.sessionsPerWeek);
    }
  } else {
    draftItems = null;
    builderPhase = forcePhase || ((inj.clearance === 'stopped' || inj.pain >= 7) ? 'acute' : (inj.phaseHint || 'subacute'));
    builderSessions = '3';
  }
  renderBuilder();
  show('builder');
}
function renderBuilder(){
  const p = state.players.find(x => x.id === currentPlayerId);
  const inj = p.injuries.find(i => i.id === currentInjuryId);
  const sec = $('view-builder');
  const type = INJURY_TYPES[inj.type] || {};
  const phase = builderPhase;
  const ph = PHASES[phase];
  const gradeTxt = (inj.grade !== null && inj.grade !== undefined && inj.grade !== '') ? '· ' + (type.grades?.[inj.grade] || '') : '';

  if (!draftItems){
    const sug = suggestForInjury(inj, phase);
    draftItems = [];
    ['warmup', 'main', 'cooldown'].forEach(s => sug[s].forEach(e => draftItems.push({ exId: e.id, section: e.section, dose: defaultDose(e, phase), included: true })));
  }
  const painHigh = inj.pain >= 7 || inj.clearance === 'stopped';

  sec.innerHTML = `
    <div class="page-heading">
      <div><span class="section-overline">PROGRAM BUILDER</span><h2>مولّد البرنامج التدريبي</h2>
        <p>${esc(p.name)} — ${esc(regionsLabel(inj.regions))} · ${esc(type.ar)} ${esc(gradeTxt)}</p></div>
    </div>

    ${painHigh ? '<div class="card" style="border-right:4px solid var(--danger)"><strong style="color:var(--danger)">⚠️ تنبيه:</strong> الألم مرتفع أو التصريح ممنوع التدريب حاليًا. التزم بالتمارين الآمنة فقط (مدى حركة وإيسومتريك بدون ألم) وقبل أي شيء انتظر قرار الطبيب.</div>' : ''}

    <div class="card">
      <div class="card-head"><span class="step-pill">⚙</span><div><h3>إعدادات البرنامج</h3><p>غيّر المرحلة لإعادة توليد الاقتراحات المناسبة</p></div></div>
      <div class="builder-top">
        <label class="field"><span>مرحلة التأهيل</span>
          <select id="builderPhase">
            ${Object.values(PHASES).map(v => `<option value="${v.key}"${v.key === phase ? ' selected' : ''}>${esc(v.ar)}</option>`).join('')}
          </select></label>
        <label class="field"><span>عدد الجلسات أسبوعيًا</span>
          <select id="builderSessions">${[2, 3, 4, 5, 6].map(n => `<option${String(n) === builderSessions ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <div style="flex:1;min-width:220px">
          <div class="tag amber" style="margin-bottom:6px">${esc(ph.span)}</div>
          <p style="font-size:.83rem;color:var(--ink-soft);margin:0">${esc(ph.goal)}</p>
        </div>
      </div>
    </div>

    ${['warmup', 'main', 'cooldown'].map(s => sectionGroupHTML(s, phase)).join('')}

    <div class="builder-footer">
      <button class="btn btn-primary" type="button" id="saveProgramBtn">${currentProgramId ? 'حفظ التعديلات' : 'حفظ البرنامج'}</button>
      <button class="btn btn-plain" type="button" id="addFromLibraryBtn">＋ إضافة تمرين من المكتبة</button>
      <button class="btn btn-plain" type="button" id="builderBackBtn">← رجوع للملف</button>
      <span class="tag subtle ex-count-tag">${draftItems.filter(i => i.included).length} تمرين مختار</span>
    </div>`;
  $('builderPhase').onchange = () => { builderPhase = $('builderPhase').value; draftItems = null; renderBuilder(); toast('تم تحديث التمارين المقترحة للمرحلة الجديدة'); };
  $('builderSessions').onchange = () => { builderSessions = $('builderSessions').value; };
  $('saveProgramBtn').onclick = saveProgram;
  $('builderBackBtn').onclick = () => renderPlayerView(currentPlayerId);
  $('addFromLibraryBtn').onclick = addPickerModal;
  sec.querySelectorAll('[data-toggle-ex]').forEach(el => el.onchange = () => {
    const it = draftItems.find(i => i.exId === el.dataset.toggleEx);
    if (it) it.included = el.checked;
    sec.querySelectorAll('.ex-count-tag').forEach(t => t.textContent = draftItems.filter(i => i.included).length + ' تمرين مختار');
    el.closest('.exercise-row').classList.toggle('off', !el.checked);
  });
  sec.querySelectorAll('[data-dose-ex]').forEach(el => el.oninput = () => {
    const it = draftItems.find(i => i.exId === el.dataset.doseEx);
    if (it) it.dose = el.value;
  });
  sec.querySelectorAll('[data-remove-ex]').forEach(b => b.onclick = () => { draftItems = draftItems.filter(i => i.exId !== b.dataset.removeEx); renderBuilder(); });
  sec.querySelectorAll('[data-preview-ex]').forEach(b => b.onclick = () => exerciseModal(b.dataset.previewEx, phase));
}
function sectionGroupHTML(sectionKey, phase){
  const items = draftItems.filter(i => i.section === sectionKey);
  const secInfo = SECTIONS[sectionKey];
  const rows = items.map(item => {
    const ex = findEx(item.exId); if (!ex) return '';
    return `<div class="exercise-row${item.included ? '' : ' off'}">
      <input type="checkbox" class="ex-check" data-toggle-ex="${ex.id}" ${item.included ? 'checked' : ''} aria-label="تضمين ${esc(ex.ar)}">
      <div class="ex-thumb">${exerciseThumb(ex)}</div>
      <div class="ex-main">
        <h4>${esc(ex.ar)} <span class="ex-en">${esc(ex.en)}</span></h4>
        <div class="ex-desc">${esc(ex.desc)}</div>
        <ul class="ex-cues">${ex.cues.slice(0, 2).map(c => `<li>${esc(c)}</li>`).join('')}</ul>
        <div class="ex-dose-row">
          <input type="text" data-dose-ex="${ex.id}" value="${esc(item.dose)}" placeholder="الجرعة: تكرارات × مجموعات" aria-label="جرعة التمرين">
        </div>
      </div>
      <div class="ex-actions">
        <button class="mini-btn" type="button" data-preview-ex="${ex.id}">تفاصيل ↗</button>
        <button class="mini-btn danger" type="button" data-remove-ex="${ex.id}">إزالة</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="section-group">
    <div class="section-group-title"><span class="bar" style="background:${secInfo.color}"></span><h3>${esc(secInfo.ar)} <span class="tag subtle">${items.length}</span></h3></div>
    ${rows || '<p class="player-meta">لا توجد تمارين مقترحة في هذا القسم لهذه الحالة.</p>'}
  </div>`;
}
function addPickerModal(){
  const existing = new Set(draftItems.map(i => i.exId));
  const pool = allExercises().filter(e => !existing.has(e.id));
  openModal(`
    <h2>إضافة تمرين</h2>
    <div class="search-field"><span class="search-glyph">⌕</span><input id="pickerSearch" type="search" placeholder="ابحث..."></div>
    <div id="pickerList" style="max-height:340px;overflow-y:auto"></div>`, true);
  const render = (q) => {
    const list = pool.filter(e => !q || (e.ar + ' ' + e.en + ' ' + e.desc).toLowerCase().includes(q));
    $('pickerList').innerHTML = list.map(e => `<button type="button" class="program-row" data-pick="${e.id}" style="width:100%;text-align:right">
      <div><strong>${esc(e.ar)}</strong> <span class="ex-en">${esc(e.en)}</span><div class="when">${esc(regionLabel(e.regions[0]))} · ${esc(SECTIONS[e.section].ar)}</div></div>
      <span class="tag green">إضافة +</span></button>`).join('') || '<p class="player-meta">لا نتائج.</p>';
    $('pickerList').querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
      const ex = findEx(b.dataset.pick);
      draftItems.push({ exId: ex.id, section: ex.section, dose: defaultDose(ex, builderPhase), included: true });
      save(); closeModal(); renderBuilder(); toast('تمت إضافة: ' + ex.ar);
    });
  };
  render('');
  $('pickerSearch').oninput = (e) => render(e.target.value.trim().toLowerCase());
}
function saveProgram(){
  const p = state.players.find(x => x.id === currentPlayerId);
  const inj = p.injuries.find(i => i.id === currentInjuryId);
  const items = draftItems.filter(i => i.included);
  if (!items.length){ toast('اختر تمرينًا واحدًا على الأقل', true); return; }
  const phase = builderPhase, sessions = builderSessions;
  if (currentProgramId){
    const pr = inj.programs.find(x => x.id === currentProgramId);
    pr.items = items; pr.phase = phase; pr.sessionsPerWeek = sessions;
  } else {
    const pr = { id: uid(), created: todayISO(), phase, sessionsPerWeek: sessions, items };
    inj.programs.push(pr); currentProgramId = pr.id;
  }
  save();
  toast('تم حفظ البرنامج ✅');
  openProgram(currentPlayerId, currentInjuryId, currentProgramId);
}

/* ================= عرض: البرنامج النهائي (قابل للطباعة) ================= */
function openProgram(pid, injId, progId){
  currentPlayerId = pid; currentInjuryId = injId; currentProgramId = progId;
  const p = state.players.find(x => x.id === pid);
  const inj = p && p.injuries.find(i => i.id === injId);
  const pr = inj && inj.programs.find(x => x.id === progId);
  if (!pr){ show('players'); return; }
  const ph = PHASES[pr.phase] || {};
  const type = INJURY_TYPES[inj.type] || {};
  const advice = type.advice?.[pr.phase];
  const gradeTxt = (inj.grade !== null && inj.grade !== undefined && inj.grade !== '') ? ' · ' + (type.grades?.[inj.grade] || '') : '';
  const review = new Date(pr.created); review.setDate(review.getDate() + 14);
  const shareUrl = programShareURL({ n: p.name, m: regionsLabel(inj.regions) + ' — ' + (type.ar || '') + gradeTxt, p: pr.phase }, pr.items);
  const sec = $('view-program');
  const sections = ['warmup', 'main', 'cooldown'];
  sec.innerHTML = `
    <div class="prog-toolbar no-print">
      <button class="btn btn-primary" type="button" id="printBtn">🖨 طباعة / حفظ PDF</button>
      <button class="btn btn-secondary" type="button" id="progSheetBtn">📄 شيت الجلسة + QR</button>
      <button class="btn btn-plain" type="button" id="progWaBtn">💬 واتساب</button>
      <button class="btn btn-plain" type="button" id="progCopyBtn">🔗 نسخ رابط المشاركة</button>
      <button class="btn btn-plain" type="button" id="progBackBtn">← رجوع للملف</button>
      <button class="btn btn-plain" type="button" id="progEditBtn">تعديل البرنامج</button>
    </div>
    <div class="print-sheet" id="printSheet">
      <div class="prog-header">
        <div>
          <div class="section-overline">REHAB PROGRAM — RETURNPLAY</div>
          <h2>برنامج تأهيلي تدريبي</h2>
          <div class="who"><b>${esc(p.name)}</b>${p.age ? ' · ' + esc(p.age) + ' سنة' : ''}${p.position ? ' · ' + esc(p.position) : ''}</div>
          <div class="who">${esc(regionsLabel(inj.regions))} — ${esc(type.ar)}${esc(gradeTxt)} · ${({ right: 'يمين', left: 'شمال', both: 'الجهتين', na: '' })[inj.side] || ''}</div>
        </div>
        <div style="text-align:left;font-size:.85rem;color:var(--ink-soft)">
          <div>تاريخ الإصدار: <b>${fmtDate(pr.created)}</b></div>
          <div>مراجعة مقترحة: <b>${fmtDate(review.toISOString().slice(0, 10))}</b></div>
          <div>${esc(pr.sessionsPerWeek)} جلسات أسبوعيًا</div>
        </div>
      </div>
      <div class="prog-meta">
        <span class="tag green">${esc(ph.ar || pr.phase)}</span>
        <span class="tag subtle">${esc(ph.span || '')}</span>
        <span class="tag ${inj.clearance === 'allowed' ? 'green' : 'red'}">${inj.clearance === 'allowed' ? 'تصريح طبي: تمارين محددة' : '⚠️ يحتاج تصريح طبي'}</span>
      </div>
      ${advice ? `<div class="prog-advice"><strong>توجيهات هذه المرحلة (${esc(type.ar)}):</strong> ${esc(advice)}</div>` : ''}
      ${inj.restrictions ? `<div class="prog-restrict"><strong>محظورات طبية:</strong> ${esc(inj.restrictions)}</div>` : ''}
      ${inj.report ? `<div class="prog-advice" style="background:var(--bg);border-right-color:var(--pine)"><strong style="color:var(--ink)">ملخص التقرير الطبي:</strong> ${esc(inj.report)}</div>` : ''}
      ${sections.map(s => {
        const items = pr.items.filter(i => i.section === s);
        if (!items.length) return '';
        const info = SECTIONS[s];
        return `<div class="prog-section-title"><span class="bar" style="background:${info.color}"></span><h3>${esc(info.ar)}</h3></div>
        <div class="prog-ex-grid">
          ${items.map(item => {
            const ex = findEx(item.exId); if (!ex) return '';
            const vi = videoInfo(ex);
            return `<div class="prog-ex">
              <div class="row">
                <div class="thumb">${exerciseThumb(ex)}</div>
                <div><h4>${esc(ex.ar)}</h4><div class="ex-en">${esc(ex.en)}</div><div class="dose">${esc(item.dose)}</div></div>
              </div>
              <p>${esc(ex.desc)}</p>
              ${ex.cues.length ? `<p><b>تصحيحات:</b> ${esc(ex.cues.join(' — '))}</p>` : ''}
              <div class="video-hint">▶ شرح بالفيديو: ${vi.kind === 'search' ? 'youtube.com/results?search_query=' + encodeURIComponent(vi.query) : esc(vi.url || '')}</div>
            </div>`;
          }).join('')}
        </div>`;
      }).join('')}
      <div class="prog-criteria">
        <h4>معايير الانتقال من ${esc(ph.ar || '')}</h4>
        <ul>${(ph.criteria || []).map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      </div>
      <div class="prog-footer-note">أوقف أي تمرين يسبب ألمًا حادًا أو تورمًا وارجع للطبيب. هذا البرنامج مسودة إرشادية مولّدة آليًا ولا يغني عن تقييم الطبيب أو أخصائي العلاج الطبيعي — الجرعات النهائية يعتمدها المختص.</div>
    </div>`;
  $('printBtn').onclick = () => window.print();
  $('progBackBtn').onclick = () => renderPlayerView(currentPlayerId);
  $('progEditBtn').onclick = () => openBuilder(currentPlayerId, currentInjuryId, currentProgramId);
  $('progSheetBtn').onclick = () => openSheet(currentPlayerId, currentInjuryId, currentProgramId);
  $('progCopyBtn').onclick = async () => { (await copyText(shareUrl)) ? toast('تم نسخ الرابط — يفتح نسخة قراءة فقط من أي موبايل') : toast('تعذر النسخ', true); };
  $('progWaBtn').onclick = () => shareWhatsApp('برنامج تأهيل ' + p.name + ' (' + (ph.ar || '') + ')', shareUrl);
  show('program');
}

/* ================= عرض: مكتبة التمارين ================= */
let libRegion = 'all', libQuery = '', libPhase = 'all';
function renderLibrary(){
  $('navExCount').textContent = allExercises().length;
  $('regionFilters').innerHTML = `<button type="button" class="filter-btn${libRegion === 'all' ? ' active' : ''}" data-region="all">الكل</button>`
    + Object.entries(REGIONS).map(([k, v]) => `<button type="button" class="filter-btn${libRegion === k ? ' active' : ''}" data-region="${k}">${esc(v.ar)}</button>`).join('');
  const list = allExercises().filter(e =>
    (libRegion === 'all' || e.regions.includes(libRegion))
    && (libPhase === 'all' || e.phases.includes(libPhase))
    && (!libQuery || (e.ar + ' ' + e.en + ' ' + e.desc + ' ' + (e.video || '')).toLowerCase().includes(libQuery)));
  $('exerciseGrid').innerHTML = list.map(e => {
    const minPhase = Math.min(...e.phases.map(p => PHASES[p].n));
    return `<article class="exercise-card">
      <div class="exercise-illustration">${exerciseThumb(e)}<span class="exercise-phase">من المرحلة ${minPhase}</span></div>
      <div class="exercise-content">
        <span class="exercise-region">${esc(e.regions.map(regionLabel).join(' · '))}</span>
        <h3>${esc(e.ar)}</h3>
        <p>${esc(e.desc)}</p>
        <div class="exercise-actions">
          <button class="mini-btn play" type="button" data-ex-video="${e.id}">▶ فيديو</button>
          <button class="mini-btn" type="button" data-ex-details="${e.id}">التفاصيل</button>
        </div>
      </div>
    </article>`;
  }).join('') || '<div class="no-results">لا توجد تمارين مطابقة — جرّب تعديل الفلاتر أو أضف تمرينك الخاص.</div>';
  $('exerciseGrid').querySelectorAll('[data-ex-details]').forEach(b => b.onclick = () => exerciseModal(b.dataset.exDetails));
  $('exerciseGrid').querySelectorAll('[data-ex-video]').forEach(b => b.onclick = () => exerciseModal(b.dataset.exVideo, null, true));
}
function exerciseModal(exId, phase, jumpToVideo){
  const ex = findEx(exId); if (!ex) return;
  const vi = videoInfo(ex);
  const phasesHTML = Object.values(PHASES).filter(p => ex.phases.includes(p.key))
    .map(p => `<tr><td>${esc(p.ar)}</td><td>${esc((ex.dose && ex.dose[p.key]) || defaultDose(ex, p.key))}</td></tr>`).join('');
  let videoHTML = '';
  if (vi.kind === 'embed'){
    videoHTML = `<div class="video-frame"><iframe src="${vi.embed}" title="فيديو الشرح" allowfullscreen loading="lazy"></iframe></div>`;
  } else if (vi.kind === 'link'){
    videoHTML = `<p><a href="${esc(vi.url)}" target="_blank" rel="noopener noreferrer">افتح رابط الفيديو المحفوظ ↗</a></p>`;
  } else {
    videoHTML = `<p class="player-meta">لا يوجد رابط محفوظ — ابحث على يوتيوب أو احفظ رابطًا تفضله:</p>
      <a class="btn btn-secondary" href="${vi.search}" target="_blank" rel="noopener noreferrer">▶ بحث يوتيوب: ${esc(vi.query)}</a>`;
  }
  openModal(`
    <h2>${esc(ex.ar)}</h2><div class="en">${esc(ex.en)}</div>
    <div class="modal-chips">
      ${ex.regions.map(r => `<span class="tag subtle">${esc(regionLabel(r))}</span>`).join('')}
      ${ex.custom ? '<span class="tag amber">تمرين خاص</span>' : ''}
    </div>
    <div class="modal-figure">${exerciseThumb(ex)}</div>
    <p>${esc(ex.desc)}</p>
    <h3 style="font-size:.95rem;margin-top:14px">تصحيحات الأداء</h3>
    <ul class="cues">${ex.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    <h3 style="font-size:.95rem;margin-top:14px">الجرعات حسب المرحلة</h3>
    <table class="dose-table">${phasesHTML}</table>
    ${ex.prog ? `<p style="font-size:.85rem"><b>التصعيد:</b> ${esc(ex.prog)}</p>` : ''}
    <div class="video-box">${videoHTML}
      <div class="video-save">
        <input id="videoLinkInput" placeholder="ألصق رابط يوتيوب هنا واحفظه لهذا التمرين" value="${esc(state.videoLinks[ex.id] || '')}">
        <button class="btn btn-secondary" type="button" id="saveVideoLink">حفظ</button>
      </div>
      <div class="local-video" id="localVideoSlot-${ex.id}"></div>
      <div class="upload-row">
        <button type="button" class="btn btn-secondary" id="uploadLocalVideoBtn">🎬 صوّر التمرين وارفع الفيديو من جهازك</button>
        <input type="file" id="localVideoFile" accept="video/*" hidden>
        <span class="player-meta">يُحفظ على جهازك ويعمل أوفلاين (حتى 120 ميجا)</span>
      </div>
    </div>
    <p class="note">⚠️ الفيديوهات والوصف لأغراض التعليم — قرر الجرعة والملاءمة مع أخصائي التأهيل.</p>`, true);
  $('saveVideoLink').onclick = () => {
    const v = $('videoLinkInput').value.trim();
    if (v) state.videoLinks[ex.id] = v; else delete state.videoLinks[ex.id];
    save(); toast('تم حفظ رابط الفيديو لهذا التمرين'); exerciseModal(exId, phase, jumpToVideo);
  };
  $('uploadLocalVideoBtn').onclick = () => $('localVideoFile').click();
  $('localVideoFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 120 * 1024 * 1024){ toast('الفيديو أكبر من 120 ميجا — قصّه أولًا أو احفظ رابط يوتيوب', true); return; }
    try {
      await mediaPut(ex.id, f);
      toast('تم حفظ الفيديو على جهازك ✅ هيشتغل حتى بدون إنترنت');
      closeModal(); exerciseModal(exId, phase, jumpToVideo);
    } catch(err){ toast('تعذر حفظ الفيديو — مساحة التخزين ممتلئة أو غير مدعومة', true); }
  };
  hydrateLocalVideo(ex.id);
  if (jumpToVideo) $('modalBox').scrollIntoView({ block: 'start' });
}
function addExerciseModal(){
  openModal(`
    <h2>إضافة تمرين خاص</h2>
    <p class="player-meta">سيظهر التمرين في المكتبة وفي الاقتراحات حسب المنطقة والمراحل التي تحددها.</p>
    <form id="customExForm">
      <div class="field-grid">
        <label class="field"><span>الاسم بالعربي *</span><input id="cxAr" required maxlength="60"></label>
        <label class="field"><span>الاسم بالإنجليزي</span><input id="cxEn" maxlength="60" style="direction:ltr"></label>
      </div>
      <div class="field-grid">
        <label class="field"><span>المنطقة *</span><select id="cxRegion">${Object.entries(REGIONS).map(([k, v]) => `<option value="${k}">${esc(v.ar)}</option>`).join('')}</select></label>
        <label class="field"><span>النمط (الرسم)</span><select id="cxPattern">${Object.entries(PATTERNS).map(([k, v]) => `<option value="${k}">${esc(v.ar)}</option>`).join('')}</select></label>
        <label class="field"><span>القسم</span><select id="cxSection"><option value="main">الجزء الأساسي</option><option value="warmup">الإحماء</option><option value="cooldown">الإطالات</option></select></label>
      </div>
      <div class="field"><span>المراحل المناسبة *</span>
        <div class="btn-row">${Object.values(PHASES).map(p => `<label class="tag subtle" style="cursor:pointer"><input type="checkbox" class="cxPhase" value="${p.key}" ${p.key === 'subacute' ? 'checked' : ''}> ${esc(p.ar.split('—')[1] || p.ar)}</label>`).join('')}</div>
      </div>
      <label class="field"><span>الوصف</span><textarea id="cxDesc" rows="2" maxlength="300"></textarea></label>
      <label class="field"><span>تصحيحات الأداء (كل سطر نصيحة)</span><textarea id="cxCues" rows="2" maxlength="300"></textarea></label>
      <label class="field"><span>الجرعة الافتراضية</span><input id="cxDose" maxlength="60" placeholder="مثال: 3×12"></label>
      <label class="field"><span>رابط فيديو (اختياري)</span><input id="cxVideo" style="direction:ltr" placeholder="https://youtube.com/..."></label>
      <div class="btn-row"><button class="btn btn-primary" type="submit">حفظ التمرين</button>
      <button class="btn btn-plain" type="button" id="cxCancel">إلغاء</button></div>
    </form>`, true);
  $('cxCancel').onclick = closeModal;
  $('customExForm').onsubmit = (ev) => {
    ev.preventDefault();
    const ar = $('cxAr').value.trim(); if (!ar) return;
    const phases = Array.from(document.querySelectorAll('.cxPhase:checked')).map(c => c.value);
    if (!phases.length){ toast('اختر مرحلة واحدة على الأقل', true); return; }
    const ex = {
      id: uid(), custom: true, ar, en: $('cxEn').value.trim() || 'Custom exercise',
      pattern: $('cxPattern').value, regions: [$('cxRegion').value], phases,
      section: $('cxSection').value, tag: 'strength',
      desc: $('cxDesc').value.trim() || 'تمرين خاص مضاف من المدرب.',
      cues: $('cxCues').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 4),
      dose: {}, prog: '', video: ''
    };
    if ($('cxVideo').value.trim()) state.videoLinks[ex.id] = $('cxVideo').value.trim();
    state.customEx.push(ex); save(); closeModal(); renderLibrary(); toast('تمت إضافة التمرين للمكتبة');
  };
}

/* ================= الإعدادات والذكاء الاصطناعي ================= */
function renderAiSettings(){
  $('aiKeyInput').value = state.aiKey || '';
  $('clearAiKey').hidden = !state.aiKey;
  $('aiKeyStatus').innerHTML = state.aiKey
    ? '✅ مفعّل حاليًا — التقارير والصور هتتحلل تلقائيًا في تسجيل الإصابة.'
    : 'الحالة: المحلل المحلي بس (يفهم الوصف المكتوب و PDF النصي، بدون إنترنت).';
}
function exportData(){
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'returnplay-backup-' + todayISO() + '.json';
  a.click(); URL.revokeObjectURL(a.href);
  state.lastBackupAt = todayISO(); save();
  renderBackupBanner();
  toast('تم تنزيل ملف النسخة الاحتياطية ✅');
}
function importData(file){
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.players)) throw new Error('bad');
      state = Object.assign({ v: 1, players: [], customEx: [], videoLinks: {}, demoPlayerId: null, aiKey: null }, data);
      save(); renderAll(); renderAiSettings(); show('players'); toast('تم استيراد البيانات بنجاح');
    } catch(e){ toast('الملف غير صالح — تأكد أنه ملف نسخة احتياطية من الأداة', true); }
  };
  reader.readAsText(file);
}
function seedDemo(){
  if (state.players.some(p => p.id === state.demoPlayerId)) return;
  const p = { id: uid(), name: 'يوسف محمد', age: '17', position: 'لاعب وسط', notes: 'بيانات تجريبية — احذفها من صفحة النسخ الاحتياطي.', created: todayISO(), injuries: [] };
  const inj = {
    id: uid(), regions: ['hamstring'], region: 'hamstring', type: 'strain', grade: 0, side: 'right',
    date: todayISO(), clearance: 'allowed', pain: 2,
    describe: 'من أسبوعين عملت شد في خلفية الفخذ اليمين أثناء سبرنت — بيوجع لما أجري بس ماشي عادي.',
    report: 'شد في العضلة المأبضية (خلفية الفخذ) درجة أولى — أشعة سليمة. توصية الطبيب: تأهيل تدريجي وتجنب السرعات القصوى أسبوعين.',
    restrictions: 'ممنوع سبرنت أو تسديدات قوية حتى مراجعة نهاية الأسبوع.',
    phaseHint: null, created: todayISO(), programs: [], logs: []
  };
  p.injuries.push(inj);
  const phase = 'subacute';
  const sug = suggestForInjury(inj, phase);
  const items = [];
  ['warmup', 'main', 'cooldown'].forEach(s => sug[s].forEach(e => items.push({ exId: e.id, section: s, dose: defaultDose(e, phase), included: true })));
  inj.programs.push({ id: uid(), created: todayISO(), phase, sessionsPerWeek: '3', items });
  inj.logs.push({ date: todayISO(), pain: 2, rpe: 3, notes: 'أول جلسة تأهيل — بدون أعراض بعدها' });
  state.players.push(p);
  state.demoPlayerId = p.id;
  save();
}
function wipeAll(){
  if (!confirm('سيتم حذف كل اللاعبين والإصابات والبرامج نهائيًا من هذا المتصفح. متأكد؟')) return;
  state = { v: 1, players: [], customEx: [], videoLinks: {}, demoPlayerId: null, aiKey: state.aiKey };
  save(); renderAll(); show('players'); toast('تم حذف كل البيانات');
}
function removeDemo(){
  state.players = state.players.filter(p => p.id !== state.demoPlayerId);
  state.demoPlayerId = null; save(); renderAll(); toast('تمت إزالة بيانات التجربة');
}

/* ================= التهيئة ================= */
function renderAll(){ renderPlayers(); renderLibrary(); $('navExCount').textContent = allExercises().length; renderBackupBanner(); }
function setup(){
  // عرض برنامج مشترك عبر الرابط (#share=...) — وضع قراءة فقط
  const shareData = parseShareHash();
  const hadData = load();
  if (!hadData && !shareData){ seedDemo(); state.seeded = true; save(); }
  injDraft = injDraft || freshDraft();
  $('todayLabel').textContent = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'full' }).format(new Date());

  document.querySelectorAll('.nav-link').forEach(el => el.addEventListener('click', () => {
    const v = el.dataset.view;
    if (v === 'players') renderPlayers();
    if (v === 'library') renderLibrary();
    if (v === 'prevention') renderPrevention();
    show(v);
  }));
  $('addPlayerBtn').onclick = () => playerFormModal(null);
  $('addPlayerBtn2').onclick = () => playerFormModal(null);
  $('quickStartBtn').onclick = quickStartModal;
  $('addExerciseBtn').onclick = addExerciseModal;
  $('mobileMenu').onclick = () => { $('sidebar').classList.add('open'); $('sidebarBackdrop').classList.add('show'); };
  $('sidebarBackdrop').onclick = () => { $('sidebar').classList.remove('open'); $('sidebarBackdrop').classList.remove('show'); };

  document.addEventListener('click', (e) => {
    const op = e.target.closest('[data-open-player]');
    if (op){ currentPlayerId = op.dataset.openPlayer; renderPlayerView(currentPlayerId); return; }
    const ep = e.target.closest('[data-edit-player]');
    if (ep){ playerFormModal(ep.dataset.editPlayer); }
  });
  $('modalRoot').addEventListener('click', (e) => { if (e.target === $('modalRoot')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  $('exSearch').oninput = (e) => { libQuery = e.target.value.trim().toLowerCase(); renderLibrary(); };
  $('regionFilters').addEventListener('click', (e) => { const b = e.target.closest('[data-region]'); if (b){ libRegion = b.dataset.region; renderLibrary(); } });
  $('phaseFilter').onchange = (e) => { libPhase = e.target.value; renderLibrary(); };

  $('exportBtn').onclick = exportData;
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = (e) => { if (e.target.files[0]) importData(e.target.files[0]); };
  $('wipeBtn').onclick = wipeAll;
  $('removeDemoBtn').onclick = removeDemo;

  // بنر النسخ الاحتياطي
  $('backupNowBtn').onclick = exportData;
  $('backupDismissBtn').onclick = () => { $('backupBanner').hidden = true; };

  // برامج الوقاية: أزرار الشيت الثابتة
  $('prevPrintBtn').onclick = () => window.print();
  $('prevBackBtn').onclick = () => { $('preventionSheetWrap').hidden = true; $('preventionGrid').hidden = false; window.scrollTo({ top: 0 }); };
  $('prevCopyBtn').onclick = async () => {
    const pr = PREVENTION_PROGRAMS.find(x => x.id === currentPreventionId); if (!pr) return;
    (await copyText(programShareURL({ n: state.preventionTeam || 'الفريق', m: pr.ar, tm: 1 }, pr.items))) ? toast('تم نسخ رابط المشاركة') : toast('تعذر النسخ', true);
  };
  $('prevShareBtn').onclick = () => {
    const pr = PREVENTION_PROGRAMS.find(x => x.id === currentPreventionId); if (!pr) return;
    shareWhatsApp('برنامج وقاية: ' + pr.ar + ' — من أداة ReturnPlay', programShareURL({ n: state.preventionTeam || 'الفريق', m: pr.ar, tm: 1 }, pr.items));
  };

  // الفيديوهات المحلية
  renderMediaStats();
  $('clearMediaBtn').onclick = async () => {
    if (!confirm('حذف كل الفيديوهات المحلية من هذا الجهاز؟ (روابط اليوتيوب مش هتتأثر)')) return;
    try {
      const keys = await mediaTxC('readonly', s => s.getAllKeys());
      await Promise.all(keys.map(k => mediaDel(k)));
      toast('تم حذف الفيديوهات المحلية'); renderMediaStats();
    } catch(e){ toast('تعذر الحذف', true); }
  };

  // الذكاء الاصطناعي
  renderAiSettings();
  $('saveAiKey').onclick = () => {
    const k = $('aiKeyInput').value.trim();
    state.aiKey = k || null; save(); renderAiSettings(); renderAiStatus();
    toast(k ? 'تم تفعيل الذكاء الاصطناعي ✅' : 'تم إزالة المفتاح');
  };
  $('clearAiKey').onclick = () => { state.aiKey = null; save(); renderAiSettings(); renderAiStatus(); toast('تم إزالة المفتاح'); };
  $('testAiKey').onclick = async () => {
    if (!state.aiKey){ toast('الصق المفتاح الأول', true); return; }
    $('testAiKey').textContent = 'جاري الاختبار…';
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(state.aiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'رد بكلمة واحدة: تمام' }] }] })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      toast('المفتاح شغال ✅ الذكاء الاصطناعي مفعّل');
    } catch(e){ toast('المفتاح مش شغال (' + e.message + ') — تأكد منه وحاول تاني', true); }
    $('testAiKey').textContent = 'اختبر';
  };

  setupInjuryForm();
  setupPWA();
  renderAll();
  if (shareData){
    renderShareView(shareData);
  } else {
    show('players');
  }
  // لو الرابط اتغير لرابط مشاركة وهو مفتوح أصلًا (بدون تحميل جديد) — اعرض النسخة المشتركة
  window.addEventListener('hashchange', () => {
    const sd = parseShareHash();
    if (sd && document.getElementById('view-share').hidden) renderShareView(sd);
  });
}
document.addEventListener('DOMContentLoaded', setup);
