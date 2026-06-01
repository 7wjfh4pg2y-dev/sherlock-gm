const SUPABASE_URL = 'https://aczebumbhhqhagtshtpm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjemVidW1iaGhxaGFndHNodHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzA0MTYsImV4cCI6MjA5NTcwNjQxNn0.3EAwEphZBq4x6b6IjGbRTa5NHdJGymiz0Lnu3875tIA';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const GM_PASSWORD_KEY = 'sherlockgm_password';
const GM_SESSION_KEY = 'sherlockgm_session';

// localStorage may be blocked on file:// — fall back to in-memory store
const _memStore = {};
const store = {
  get: k => { try { return localStorage.getItem(k); } catch(e) { return _memStore[k] ?? null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch(e) { _memStore[k] = v; } },
  remove: k => { try { localStorage.removeItem(k); } catch(e) { delete _memStore[k]; } }
};

let currentCaseId = null;
let currentCaseName = null;
let currentCaseDescription = '';
let currentMapUrl = '';
let currentMapId = null;
let mapsLibrary = [];
let allClues = [];
let allPlayers = [];
let allNotes = [];
let playerSubscription = null;
let gmSubscription = null;
let gmPresenceChannel = null;
let playerPresenceChannel = null;
let presenceOnline = new Set(); // "name|color" keys of currently-online players
let isGM = false;

// ── UTILS ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ── GM AUTH ──
function showGMLogin() { openModal('modal-gm-login'); }

function resetGMPassword() {
  if (!confirm('Reset GM password? You will need to set a new one on next login.')) return;
  store.remove(GM_PASSWORD_KEY);
  store.remove(GM_SESSION_KEY);
  document.getElementById('gm-login-error').textContent = 'Password reset. Enter a new password to set it.';
}

function setGMPassword() {
  const pw = document.getElementById('gm-new-password').value.trim();
  if (!pw) return;
  store.set(GM_PASSWORD_KEY, pw);
  toast('Password set!');
  document.getElementById('gm-new-password').value = '';
}

function doGMLogin() {
  const pw = document.getElementById('gm-password-input').value.trim();
  if (!pw) { document.getElementById('gm-login-error').textContent = 'Enter a password.'; return; }
  const stored = store.get(GM_PASSWORD_KEY);
  if (!stored) {
    store.set(GM_PASSWORD_KEY, pw);
    store.set(GM_SESSION_KEY, '1');
    closeModal('modal-gm-login');
    enterGM();
    toast('Password set. Welcome, Game Master.');
    return;
  }
  if (pw !== stored) { document.getElementById('gm-login-error').textContent = 'Incorrect password.'; return; }
  store.set(GM_SESSION_KEY, '1');
  closeModal('modal-gm-login');
  enterGM();
}

function gmLogout() {
  if (gmSubscription) sb.removeChannel(gmSubscription);
  if (gmPresenceChannel) sb.removeChannel(gmPresenceChannel);
  store.remove(GM_SESSION_KEY);
  location.reload();
}

async function enterGM() {
  isGM = true;
  document.getElementById('mode-indicator').innerHTML = '<span class="mode-badge gm">Game Master</span>';
  showScreen('gm-screen');
  await loadMapsLibrary();
  await loadCases();
}

// ── CASES ──
async function loadCases() {
  const { data } = await sb.from('cases').select('*').order('created_at');
  const sel = document.getElementById('case-select');
  sel.innerHTML = '<option value="">— Select a Case —</option>';
  (data || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function showNewCase() { openModal('modal-new-case'); }

async function createCase() {
  const name = document.getElementById('new-case-name').value.trim();
  if (!name) { document.getElementById('new-case-error').textContent = 'Enter a case name.'; return; }
  const description = document.getElementById('new-case-description').value.trim();
  const { data, error } = await sb.from('cases').insert({ name, description }).select().single();
  if (error) { document.getElementById('new-case-error').textContent = error.message; return; }
  closeModal('modal-new-case');
  document.getElementById('new-case-name').value = '';
  document.getElementById('new-case-description').value = '';
  await loadCases();
  document.getElementById('case-select').value = data.id;
  onCaseChange();
}

async function onCaseChange() {
  const sel = document.getElementById('case-select');
  currentCaseId = sel.value;
  currentCaseName = sel.options[sel.selectedIndex]?.text;
  document.getElementById('delete-case-btn').style.display = currentCaseId ? '' : 'none';
  if (!currentCaseId) {
    document.getElementById('share-box').style.display = 'none';
    document.getElementById('gm-content').innerHTML = '<div class="empty-state">Select or create a case to begin.</div>';
    const rp = document.getElementById('gm-right-panel');
    if (rp) rp.style.display = 'none';
    return;
  }
  const { data: caseData } = await sb.from('cases').select('*').eq('id', currentCaseId).single();
  currentCaseDescription = caseData?.description || '';
  currentMapId = caseData?.map_id || null;
  currentMapUrl = currentMapId ? (mapsLibrary.find(m => m.id === currentMapId)?.url || '') : '';
  // Update GM sidebar map button
  const gmWrap = document.getElementById('gm-map-btn-wrap');
  if (gmWrap) gmWrap.style.display = currentMapUrl ? '' : 'none';
  // Share link
  const shareUrl = `${location.href.split('?')[0]}?case=${currentCaseId}`;
  document.getElementById('share-url').textContent = shareUrl;
  document.getElementById('share-box').style.display = 'inline-flex';
  await loadGMClues();
  subscribeGMUpdates(currentCaseId);
}

function gmBriefingHTML() {
  const desc = currentCaseDescription;
  return `<div class="case-briefing-panel" id="gm-briefing-panel">
    <div class="briefing-header" onclick="toggleBriefing('gm-briefing-body')">
      <span>Case Briefing</span><span id="gm-briefing-toggle" class="briefing-toggle">▸</span>
    </div>
    <div id="gm-briefing-body" class="briefing-body" style="display:none">
      <div id="gm-briefing-display" style="${desc ? '' : 'display:none'}">
        <p class="briefing-text" id="gm-briefing-text">${desc ? escapeHtml(desc) : ''}</p>
        <button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="showGMBriefingEdit()">✏️ Edit Briefing</button>
      </div>
      <div id="gm-briefing-edit" style="${desc ? 'display:none' : ''}">
        <textarea id="gm-briefing-input" rows="12" placeholder="Set the scene — the crime, the setting, what the investigators know at the outset…" style="width:100%;resize:vertical;min-height:200px;font-family:'IM Fell English',Georgia,serif;font-size:0.95rem;line-height:1.7;background:var(--paper);color:var(--ink);border:1px solid var(--parchment-darker);padding:12px 14px;border-radius:2px;box-sizing:border-box;">${desc ? escapeHtml(desc) : ''}</textarea>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-primary btn-sm" onclick="saveGMBriefing()">Save</button>
          ${desc ? '<button class="btn btn-secondary btn-sm" onclick="cancelGMBriefingEdit()">Cancel</button>' : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function gmMapHTML() {
  const selected = mapsLibrary.find(m => m.id === currentMapId);
  const options = mapsLibrary.map(m =>
    `<option value="${m.id}" ${m.id === currentMapId ? 'selected' : ''}>${escapeHtml(m.name)}</option>`
  ).join('');
  return `<div class="case-briefing-panel" style="margin-bottom:24px;">
    <div class="briefing-header" onclick="toggleBriefing('gm-map-body')">
      <span>Case Map</span><span id="gm-map-toggle" class="briefing-toggle">▾</span>
    </div>
    <div id="gm-map-body" class="briefing-body">
      ${selected ? `<img src="${selected.url}" alt="${escapeHtml(selected.name)}" style="max-width:100%;border:1px solid var(--parchment-darker);cursor:pointer;margin-bottom:12px;display:block;" onclick="openMapFullscreen()">` : '<p style="font-family:\'Courier New\',Courier,monospace;font-size:0.85rem;color:var(--fog);margin:0 0 12px;">No map attached to this case.</p>'}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <select id="case-map-select" style="font-family:\'Courier New\',Courier,monospace;font-size:0.85rem;background:var(--ink);color:var(--parchment);border:1px solid var(--parchment-darker);padding:6px 8px;border-radius:2px;" onchange="attachMapToCase(this.value)">
          <option value="">— No map —</option>
          ${options}
        </select>
        ${selected ? `<button class="btn btn-secondary btn-sm" onclick="openMapFullscreen()">⤢ Fullscreen</button>` : ''}
      </div>
    </div>
  </div>`;
}

function gmPlayersHTML() {
  const active = allPlayers.filter(p => !p.is_kicked);
  const kicked = allPlayers.filter(p => p.is_kicked);
  const rowStyle = 'display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(201,169,110,0.12);';
  const nameStyle = `font-family:'Courier New',Courier,monospace;font-size:0.82rem;color:var(--parchment);flex:1;`;

  const playerRow = (p, isKicked) => `
    <div style="${rowStyle}">
      <div style="width:10px;height:10px;border-radius:50%;background:${p.player_color};flex-shrink:0;border:1px solid rgba(255,255,255,0.2);"></div>
      <span style="${nameStyle}${isKicked ? 'opacity:0.45;text-decoration:line-through;' : ''}">${escapeHtml(p.player_name)}</span>
      ${isKicked
        ? `<button class="btn btn-secondary btn-sm" onclick="unkickPlayer('${p.id}')">Reinstate</button>
           <button class="btn btn-danger btn-sm" onclick="deletePlayerData('${p.id}','${escapeHtml(p.player_name)}','${p.player_color}')">Delete</button>`
        : `<button class="btn btn-danger btn-sm" onclick="kickPlayer('${p.id}')">Kick</button>`}
    </div>`;

  const body = !allPlayers.length
    ? `<p style="font-family:'Courier New',Courier,monospace;font-size:0.8rem;color:var(--fog);margin:0;">No players have joined yet.</p>`
    : `${active.map(p => playerRow(p, false)).join('')}
       ${kicked.length ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(201,169,110,0.2);">
         <div style="font-family:'Courier New',Courier,monospace;font-size:0.65rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--fog);margin-bottom:6px;">Removed</div>
         ${kicked.map(p => playerRow(p, true)).join('')}
       </div>` : ''}`;

  return `<div class="case-briefing-panel" style="margin-bottom:24px;">
    <div class="briefing-header" onclick="toggleBriefing('gm-players-body')">
      <span>Players <span class="counter-badge">${active.length}</span></span>
      <span id="gm-players-toggle" class="briefing-toggle">▾</span>
    </div>
    <div id="gm-players-body" class="briefing-body" style="padding:10px 16px;">
      ${body}
    </div>
  </div>`;
}

async function kickPlayer(id) {
  await sb.from('players').update({ is_kicked: true }).eq('id', id);
  await loadGMClues();
  toast('Player removed.');
}

async function unkickPlayer(id) {
  await sb.from('players').update({ is_kicked: false }).eq('id', id);
  await loadGMClues();
  toast('Player reinstated.');
}

async function deletePlayerData(id, name, color) {
  if (!confirm(`Delete all data for "${name}"? This removes their notes and cannot be undone.`)) return;
  await sb.from('notes').delete().eq('case_id', currentCaseId).eq('player_name', name).eq('player_color', color);
  await sb.from('players').delete().eq('id', id);
  await loadGMClues();
  toast('Player data deleted.');
}

function gmNotesHTML() {
  const noNotes = `<p style="font-family:'Courier Prime','Courier New',monospace;font-size:0.8rem;color:var(--fog);margin:0;font-style:italic;">No notes have been written yet.</p>`;
  const rows = allNotes.length ? allNotes.map(n => {
    const time = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div class="notebook-note" style="color:${n.player_color}">
      <div class="notebook-note-meta">
        <span class="notebook-note-name">${escapeHtml(n.player_name)}</span>
        <span class="notebook-note-time">${time}</span>
        <button onclick="gmDeleteNote('${n.id}')" style="background:none;border:none;cursor:pointer;color:var(--red);opacity:0.5;font-size:0.75rem;padding:0 2px;line-height:1;" title="Delete note">✕</button>
      </div>
      <div class="notebook-note-text">${escapeHtml(n.content)}</div>
    </div>`;
  }).join('') : noNotes;

  return `<div class="case-briefing-panel" style="margin-bottom:24px;">
    <div class="briefing-header" onclick="toggleBriefing('gm-notes-body')">
      <span>Investigators' Notes <span class="counter-badge">${allNotes.length}</span></span>
      <span id="gm-notes-toggle" class="briefing-toggle">▾</span>
    </div>
    <div id="gm-notes-body" class="briefing-body" style="padding:12px 16px;">
      ${rows}
    </div>
  </div>`;
}

function gmDeleteNote(id) {
  showConfirmDelete('Delete this note from the Irregulars\' Notebook?', async () => {
    await sb.from('notes').delete().eq('id', id);
    await loadGMClues();
  });
}

function subscribeGMUpdates(caseId) {
  if (gmSubscription) sb.removeChannel(gmSubscription);
  gmSubscription = sb.channel('gm-live-' + caseId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `case_id=eq.${caseId}` },
      () => loadGMClues())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `case_id=eq.${caseId}` },
      () => loadGMClues())
    .subscribe();

  if (gmPresenceChannel) sb.removeChannel(gmPresenceChannel);
  gmPresenceChannel = sb.channel('presence-' + caseId);
  gmPresenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = gmPresenceChannel.presenceState();
      presenceOnline = new Set(
        Object.values(state).flat().map(p => p.player_name + '|' + p.player_color)
      );
      renderGMRightPanel();
    })
    .subscribe();
}

async function attachMapToCase(mapId) {
  const { error } = await sb.from('cases').update({ map_id: mapId || null }).eq('id', currentCaseId);
  if (error) { toast('Error saving map selection.'); return; }
  currentMapId = mapId || null;
  currentMapUrl = mapsLibrary.find(m => m.id === mapId)?.url || '';
  toast('Map updated.');
  renderGMClues();
}

async function loadMapsLibrary() {
  const { data } = await sb.from('maps').select('*').order('created_at');
  mapsLibrary = data || [];
}

async function showMapsLibrary() {
  await loadMapsLibrary();
  renderMapsLibraryModal();
  openModal('modal-maps-library');
}

function renderMapsLibraryModal() {
  const grid = document.getElementById('maps-library-grid');
  if (!mapsLibrary.length) {
    grid.innerHTML = '<p style="font-family:\'Courier New\',Courier,monospace;font-size:0.85rem;color:var(--fog);">No maps uploaded yet.</p>';
    return;
  }
  grid.innerHTML = mapsLibrary.map(m => `
    <div style="border:1px solid var(--parchment-darker);overflow:hidden;border-radius:2px;">
      <img src="${m.url}" alt="${escapeHtml(m.name)}" style="width:100%;height:140px;object-fit:cover;display:block;cursor:pointer;" onclick="openMapPreview('${m.url}')">
      <div style="padding:8px;display:flex;flex-direction:column;gap:6px;">
        <input id="map-name-${m.id}" type="text" value="${escapeHtml(m.name)}" style="width:100%;font-family:'Courier New',Courier,monospace;font-size:0.78rem;background:rgba(244,232,206,0.08);border:1px solid rgba(139,105,20,0.3);color:var(--parchment);padding:4px 6px;box-sizing:border-box;border-radius:2px;">
        <div style="display:flex;gap:4px;align-items:center;">
          <label style="font-family:'Courier New',Courier,monospace;font-size:0.68rem;color:var(--fog);cursor:pointer;flex:1;border:1px solid rgba(139,105,20,0.3);padding:3px 6px;text-align:center;border-radius:2px;" title="Replace image file">
            ↑ Replace img
            <input type="file" accept="image/*" style="display:none;" onchange="replaceMapImage('${m.id}', this)">
          </label>
          <button class="btn btn-secondary btn-sm" style="font-size:0.65rem;padding:3px 7px;" onclick="renameMap('${m.id}')">Rename</button>
          <button class="btn btn-danger btn-sm" style="font-size:0.65rem;padding:3px 7px;" onclick="deleteMap('${m.id}')">🗑</button>
        </div>
      </div>
    </div>`).join('');
}

async function uploadLibraryMap() {
  const nameEl = document.getElementById('new-map-name');
  const fileEl = document.getElementById('new-map-file');
  const errEl = document.getElementById('maps-library-error');
  const name = nameEl.value.trim();
  const file = fileEl.files[0];
  if (!name) { errEl.textContent = 'Enter a map name.'; return; }
  if (!file) { errEl.textContent = 'Select an image.'; return; }
  errEl.textContent = 'Uploading…';
  const ext = file.name.split('.').pop();
  const path = `maps/${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage.from('clues').upload(path, file);
  if (upErr) { errEl.textContent = upErr.message; return; }
  const { data: urlData } = sb.storage.from('clues').getPublicUrl(path);
  const { error: dbErr } = await sb.from('maps').insert({ name, url: urlData.publicUrl });
  if (dbErr) { errEl.textContent = dbErr.message; return; }
  nameEl.value = '';
  fileEl.value = '';
  errEl.textContent = '';
  await loadMapsLibrary();
  renderMapsLibraryModal();
  toast('Map added to library!');
}

async function deleteMap(id) {
  if (!confirm('Remove this map from the library?')) return;
  await sb.from('maps').delete().eq('id', id);
  await loadMapsLibrary();
  renderMapsLibraryModal();
  toast('Map removed.');
}

async function renameMap(id) {
  const input = document.getElementById('map-name-' + id);
  const name = input?.value.trim();
  if (!name) { toast('Enter a name first.'); return; }
  const { error } = await sb.from('maps').update({ name }).eq('id', id);
  if (error) { toast('Error renaming map.'); return; }
  await loadMapsLibrary();
  renderMapsLibraryModal();
  toast('Map renamed.');
}

async function replaceMapImage(id, fileInput) {
  const file = fileInput.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop();
  const path = `maps/${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage.from('clues').upload(path, file);
  if (upErr) { toast('Upload failed: ' + upErr.message); return; }
  const { data: urlData } = sb.storage.from('clues').getPublicUrl(path);
  const { error: dbErr } = await sb.from('maps').update({ url: urlData.publicUrl }).eq('id', id);
  if (dbErr) { toast('Error updating map.'); return; }
  await loadMapsLibrary();
  renderMapsLibraryModal();
  toast('Map image replaced.');
}

function openMapPreview(url) {
  sizeMapCanvas();
  openModal('modal-map');
  mapImg = new Image();
  mapImg.onload = () => {
    mapFitScale = calcMapFitScale(mapImg);
    mapScale = mapFitScale; mapX = 0; mapY = 0;
    drawMapCanvas();
  };
  mapImg.src = url;
}

// ── MAP CANVAS RENDERER ──
// Uses canvas + ctx.drawImage with source clipping instead of CSS transform.
// This avoids GPU texture size limits that cause black tiles on high zoom.
let mapScale = 1, mapFitScale = 1, mapX = 0, mapY = 0;
let mapDragging = false, mapDragStart = null, mapDidMove = false;
let mapImg = null;

function drawMapCanvas() {
  const canvas = document.getElementById('map-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!mapImg || !mapImg.complete || !mapImg.naturalWidth) return;

  const iw = mapImg.naturalWidth, ih = mapImg.naturalHeight;
  const drawW = iw * mapScale, drawH = ih * mapScale;
  // Top-left corner of the image in canvas coordinates
  const drawX = (canvas.width  - drawW) / 2 + mapX;
  const drawY = (canvas.height - drawH) / 2 + mapY;

  // Clamp source rect to only the visible portion — never rasterises off-screen pixels
  const srcX = Math.max(0, -drawX / mapScale);
  const srcY = Math.max(0, -drawY / mapScale);
  const srcW = Math.min(iw - srcX, canvas.width  / mapScale);
  const srcH = Math.min(ih - srcY, canvas.height / mapScale);
  if (srcW <= 0 || srcH <= 0) return;

  const dstX = Math.max(0, drawX);
  const dstY = Math.max(0, drawY);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mapImg, srcX, srcY, srcW, srcH, dstX, dstY, srcW * mapScale, srcH * mapScale);
}

function sizeMapCanvas() {
  const canvas = document.getElementById('map-canvas');
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function mapZoom(factor, pivotX = 0, pivotY = 0) {
  const newScale = Math.min(mapFitScale * 20, Math.max(mapFitScale * 0.9, mapScale * factor));
  const ratio = newScale / mapScale;
  mapX = pivotX + (mapX - pivotX) * ratio;
  mapY = pivotY + (mapY - pivotY) * ratio;
  mapScale = newScale;
  drawMapCanvas();
}

function mapZoomReset() {
  mapScale = mapFitScale; mapX = 0; mapY = 0;
  drawMapCanvas();
}

function calcMapFitScale(img) {
  return Math.min(window.innerWidth / img.naturalWidth, window.innerHeight / img.naturalHeight, 1);
}

(function initMapInteraction() {
  document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('modal-map');

    window.addEventListener('resize', () => {
      if (overlay.classList.contains('open')) { sizeMapCanvas(); drawMapCanvas(); }
    });

    overlay.addEventListener('wheel', e => {
      if (!overlay.classList.contains('open')) return;
      e.preventDefault();
      const canvas = document.getElementById('map-canvas');
      const rect = canvas.getBoundingClientRect();
      // Zoom towards cursor position
      const px = e.clientX - rect.left - canvas.width  / 2;
      const py = e.clientY - rect.top  - canvas.height / 2;
      mapZoom(e.deltaY < 0 ? 1.15 : 0.87, px, py);
    }, { passive: false });

    overlay.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      mapDragging = true; mapDidMove = false;
      mapDragStart = { x: e.clientX - mapX, y: e.clientY - mapY };
      overlay.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
      if (!mapDragging) return;
      mapDidMove = true;
      mapX = e.clientX - mapDragStart.x;
      mapY = e.clientY - mapDragStart.y;
      drawMapCanvas();
    });

    window.addEventListener('mouseup', e => {
      if (mapDragging && !mapDidMove && !e.target.closest('button')) closeModal('modal-map');
      mapDragging = false;
      overlay.style.cursor = 'grab';
    });

    // Touch pinch-to-zoom
    let lastTouchDist = null, lastTouchMid = null;
    overlay.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        lastTouchMid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
      } else if (e.touches.length === 1) {
        mapDragging = true;
        mapDragStart = { x: e.touches[0].clientX - mapX, y: e.touches[0].clientY - mapY };
      }
    }, { passive: true });

    overlay.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && lastTouchDist) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const mid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
        const canvas = document.getElementById('map-canvas');
        const px = mid.x - canvas.width / 2, py = mid.y - canvas.height / 2;
        mapZoom(dist / lastTouchDist, px, py);
        lastTouchDist = dist; lastTouchMid = mid;
      } else if (e.touches.length === 1 && mapDragging) {
        mapX = e.touches[0].clientX - mapDragStart.x;
        mapY = e.touches[0].clientY - mapDragStart.y;
        drawMapCanvas();
      }
    }, { passive: true });

    overlay.addEventListener('touchend', () => { mapDragging = false; lastTouchDist = null; });
  });
})();

let sidebarOpen = false;
let gmSidebarOpen = false;
const gmMinimizedNotes = new Set();
function toggleGMSidebarNote(id) {
  if (gmMinimizedNotes.has(id)) gmMinimizedNotes.delete(id);
  else gmMinimizedNotes.add(id);
  renderGMRightPanel();
}
function gmNotebookBtnClick() {
  if (gmSidebarOpen) {
    // Sidebar is open — toggle all notes expand/collapse
    const anyExpanded = allNotes.some(n => !gmMinimizedNotes.has(n.id));
    if (anyExpanded) allNotes.forEach(n => gmMinimizedNotes.add(n.id));
    else allNotes.forEach(n => gmMinimizedNotes.delete(n.id));
    renderGMRightPanel();
  } else {
    toggleGMSidebar();
  }
}

function togglePlayerSidebar() {
  sidebarOpen = !sidebarOpen;
  const sidebar = document.getElementById('player-sidebar');
  if (sidebarOpen) {
    sidebar.classList.add('sidebar-open');
  } else {
    sidebar.classList.remove('sidebar-open');
  }
}

function toggleGMSidebar() {
  gmSidebarOpen = !gmSidebarOpen;
  const sidebar = document.getElementById('gm-sidebar');
  sidebar.classList.toggle('sidebar-open', gmSidebarOpen);
  // Re-render notes so they show/hide with sidebar width
  renderGMRightPanel();
}

function toggleGMBriefing() {
  const panel = document.getElementById('gm-briefing-panel');
  if (!panel) return;
  const body = document.getElementById('gm-briefing-body');
  const toggle = document.getElementById('gm-briefing-toggle');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (toggle) toggle.textContent = open ? '▸' : '▾';
  // If opening and no briefing text yet, go straight to edit mode
  if (!open && !currentCaseDescription) {
    document.getElementById('gm-briefing-display').style.display = 'none';
    document.getElementById('gm-briefing-edit').style.display = '';
  }
  // Scroll into view
  if (!open) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openMapFullscreen() {
  if (!currentMapUrl) return;
  sizeMapCanvas();
  openModal('modal-map');
  const ready = () => {
    mapFitScale = calcMapFitScale(mapImg);
    mapScale = mapFitScale; mapX = 0; mapY = 0;
    drawMapCanvas();
  };
  if (mapImg && mapImg.src === currentMapUrl && mapImg.complete && mapImg.naturalWidth) {
    ready();
  } else {
    mapImg = new Image();
    mapImg.onload = ready;
    mapImg.src = currentMapUrl;
  }
}

function renderPlayerMap() {
  const wrap = document.getElementById('player-map-btn-wrap');
  if (wrap) wrap.style.display = currentMapUrl ? '' : 'none';
  const gmWrap = document.getElementById('gm-map-btn-wrap');
  if (gmWrap) gmWrap.style.display = currentMapUrl ? '' : 'none';
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toggleBriefing(bodyId) {
  const body = document.getElementById(bodyId);
  const toggleId = bodyId === 'gm-briefing-body' ? 'gm-briefing-toggle'
    : bodyId === 'gm-map-body' ? 'gm-map-toggle'
    : bodyId === 'gm-players-body' ? 'gm-players-toggle'
    : bodyId === 'gm-notes-body' ? 'gm-notes-toggle'
    : 'player-briefing-toggle';
  const toggle = document.getElementById(toggleId);
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (toggle) toggle.textContent = open ? '▸' : '▾';
}

function showGMBriefingEdit() {
  document.getElementById('gm-briefing-display').style.display = 'none';
  document.getElementById('gm-briefing-edit').style.display = '';
  document.getElementById('gm-briefing-input').value = currentCaseDescription;
}

function cancelGMBriefingEdit() {
  document.getElementById('gm-briefing-edit').style.display = 'none';
  document.getElementById('gm-briefing-display').style.display = '';
}

async function saveGMBriefing() {
  const text = document.getElementById('gm-briefing-input').value.trim();
  const { error } = await sb.from('cases').update({ description: text }).eq('id', currentCaseId);
  if (error) { toast('Error saving briefing.'); return; }
  currentCaseDescription = text;
  document.getElementById('gm-briefing-text').textContent = text;
  if (text) {
    document.getElementById('gm-briefing-display').style.display = '';
    document.getElementById('gm-briefing-edit').style.display = 'none';
  }
  toast('Briefing saved.');
}

function copyShareLink() {
  const url = document.getElementById('share-url').textContent;
  navigator.clipboard.writeText(url).then(() => toast('Link copied!'));
}

// ── GM CLUES ──
async function loadGMClues() {
  const [cluesRes, playersRes, notesRes] = await Promise.all([
    sb.from('clues').select('*').eq('case_id', currentCaseId).order('position'),
    sb.from('players').select('*').eq('case_id', currentCaseId).order('joined_at'),
    sb.from('notes').select('*').eq('case_id', currentCaseId).order('created_at'),
  ]);
  allClues = cluesRes.data || [];
  allPlayers = playersRes.data || [];
  allNotes = notesRes.data || [];
  renderGMClues();
}

function renderGMClues() {
  const revealed = allClues.filter(c => c.revealed);
  const unrevealed = allClues.filter(c => !c.revealed);

  // Briefing panel + clue grids go into #gm-content
  let html = gmBriefingHTML();

  // Unrevealed
  html += `<div class="clues-section-title" style="color:var(--parchment)">Unrevealed <span class="counter-badge">${unrevealed.length}</span></div>`;
  html += '<div class="clues-grid">';
  unrevealed.forEach(c => {
    const thumb = c.clue_text
      ? `<div class="clue-thumb-text">${c.clue_text}</div>`
      : `<img class="clue-thumb" src="${c.image_url}" alt="${c.location_name}">`;
    html += `<div class="clue-card" onclick="openGMCluePreview(${JSON.stringify(c).replace(/"/g, '&quot;')})">
      ${thumb}
      <div class="clue-label">${c.location_name}</div>
      <div class="clue-actions">
        <button class="clue-action-btn reveal" onclick="event.stopPropagation();revealClue('${c.id}')">👁 Reveal</button>
        <button class="clue-action-btn edit" onclick="event.stopPropagation();showEditClue('${c.id}')">✏️ Edit</button>
        <button class="clue-action-btn del" onclick="event.stopPropagation();deleteClue('${c.id}')">🗑 Delete</button>
      </div>
    </div>`;
  });
  html += `<div class="clue-add-card" onclick="showAddClue()">
    <span class="clue-add-icon">+</span>
    <span>Add Clue</span>
  </div>`;
  html += '</div>';

  // Revealed
  if (revealed.length) {
    html += `<div class="clues-section-title" style="color:var(--parchment);margin-top:8px">Revealed <span class="counter-badge">${revealed.length}</span></div>`;
    html += '<div class="clues-grid">';
    revealed.forEach(c => {
      const thumb = c.clue_text
        ? `<div class="clue-thumb-text">${c.clue_text}</div>`
        : `<img class="clue-thumb" src="${c.image_url}" alt="${c.location_name}">`;
      html += `<div class="clue-card revealed" onclick="openGMCluePreview(${JSON.stringify(c).replace(/"/g, '&quot;')})">
        ${thumb}
        <div class="clue-label">${c.location_name}</div>
        <div class="clue-actions">
          <button class="clue-action-btn hide" onclick="event.stopPropagation();unrevealClue('${c.id}')">🚫 Hide</button>
          <button class="clue-action-btn edit" onclick="event.stopPropagation();showEditClue('${c.id}')">✏️ Edit</button>
          <button class="clue-action-btn del" onclick="event.stopPropagation();deleteClue('${c.id}')">🗑 Delete</button>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  document.getElementById('gm-content').innerHTML = html;

  // Update GM sidebar map button visibility
  const gmWrap = document.getElementById('gm-map-btn-wrap');
  if (gmWrap) gmWrap.style.display = currentMapUrl ? '' : 'none';

  // Show right panel and render players + notes there
  const rightPanel = document.getElementById('gm-right-panel');
  if (rightPanel) rightPanel.style.display = '';
  renderGMRightPanel();
}

let gmPlayersPanelOpen = true;
function toggleGMPlayersPanel() {
  gmPlayersPanelOpen = !gmPlayersPanelOpen;
  const el = document.getElementById('gm-right-players');
  const btn = document.getElementById('gm-players-minimize-btn');
  if (el) el.style.display = gmPlayersPanelOpen ? '' : 'none';
  if (btn) btn.textContent = gmPlayersPanelOpen ? '▾' : '▸';
}

function renderGMRightPanel() {
  // Players section — with online presence dot
  const active = allPlayers.filter(p => !p.is_kicked);
  const kicked = allPlayers.filter(p => p.is_kicked);
  const rowStyle = 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(201,169,110,0.12);';
  const nameStyle = `font-family:'Courier New',Courier,monospace;font-size:0.78rem;color:var(--parchment);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;

  const onlineDot = (p) => {
    const online = presenceOnline.has(p.player_name + '|' + p.player_color);
    return `<div style="width:6px;height:6px;border-radius:50%;background:${online ? '#4caf50' : 'rgba(255,255,255,0.15)'};flex-shrink:0;box-shadow:${online ? '0 0 4px #4caf50' : 'none'};" title="${online ? 'Online' : 'Offline'}"></div>`;
  };

  const playerRow = (p, isKicked) => `
    <div style="${rowStyle}">
      ${isKicked ? '' : onlineDot(p)}
      <div style="width:8px;height:8px;border-radius:50%;background:${p.player_color};flex-shrink:0;border:1px solid rgba(255,255,255,0.2);"></div>
      <span style="${nameStyle}${isKicked ? 'opacity:0.45;text-decoration:line-through;' : ''}">${escapeHtml(p.player_name)}</span>
      ${isKicked
        ? `<button class="btn btn-secondary btn-sm" onclick="unkickPlayer('${p.id}')" style="font-size:0.6rem;padding:3px 6px;">Reinstate</button>
           <button class="btn btn-danger btn-sm" onclick="deletePlayerData('${p.id}','${escapeHtml(p.player_name)}','${p.player_color}')" style="font-size:0.6rem;padding:3px 6px;">Del</button>`
        : `<button class="btn btn-danger btn-sm" onclick="kickPlayer('${p.id}')" style="font-size:0.6rem;padding:3px 6px;">Kick</button>`}
    </div>`;

  const playersBody = !allPlayers.length
    ? `<p style="font-family:'Courier New',Courier,monospace;font-size:0.75rem;color:var(--fog);margin:0;font-style:italic;">No players yet.</p>`
    : `${active.map(p => playerRow(p, false)).join('')}
       ${kicked.length ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(201,169,110,0.2);">
         <div style="font-family:'Courier New',Courier,monospace;font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--fog);margin-bottom:4px;">Removed</div>
         ${kicked.map(p => playerRow(p, true)).join('')}
       </div>` : ''}`;

  const playersBadge = document.getElementById('gm-players-badge');
  if (playersBadge) playersBadge.textContent = active.length;
  const playersEl = document.getElementById('gm-right-players');
  if (playersEl) {
    playersEl.innerHTML = playersBody;
    playersEl.style.display = gmPlayersPanelOpen ? '' : 'none';
  }

  // Notes — rendered compactly into the GM sidebar
  const notesBadgeEl = document.getElementById('gm-sidebar-notes-badge');
  const notesListEl = document.getElementById('gm-sidebar-notes-list');
  if (notesBadgeEl) {
    notesBadgeEl.style.display = gmSidebarOpen ? '' : 'none';
    notesBadgeEl.textContent = allNotes.length + (allNotes.length === 1 ? ' note' : ' notes');
  }
  if (notesListEl) {
    if (!gmSidebarOpen) { notesListEl.innerHTML = ''; return; }
    if (!allNotes.length) {
      notesListEl.innerHTML = `<p style="font-family:'Courier New',Courier,monospace;font-size:0.72rem;color:var(--fog);margin:4px 8px;font-style:italic;">No notes yet.</p>`;
    } else {
      notesListEl.innerHTML = allNotes.map(n => {
        const time = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isMin = gmMinimizedNotes.has(n.id);
        return `<div class="notebook-note" style="color:${n.player_color}">
          <div class="notebook-note-meta">
            <span class="notebook-note-name">${escapeHtml(n.player_name)}</span>
            <span class="notebook-note-time">${time}</span>
            <button onclick="toggleGMSidebarNote('${n.id}')" class="note-action-btn" title="${isMin ? 'Expand' : 'Minimise'}">${isMin ? '▸' : '▾'}</button>
            <button onclick="gmDeleteNote('${n.id}')" class="note-action-btn" title="Delete" style="color:var(--red)">✕</button>
          </div>
          ${isMin ? '' : `<div class="notebook-note-text">${escapeHtml(n.content)}</div>`}
        </div>`;
      }).join('');
    }
  }
}

async function revealClue(id) {
  await sb.from('clues').update({ revealed: true }).eq('id', id);
  await loadGMClues();
  toast('Clue revealed to players!');
}

async function unrevealClue(id) {
  await sb.from('clues').update({ revealed: false }).eq('id', id);
  await loadGMClues();
  toast('Clue hidden from players.');
}

// ── ADD CLUE ──
let currentClueType = 'image';

function showAddClue() {
  currentClueType = 'image';
  document.getElementById('clue-image-field').style.display = 'block';
  document.getElementById('clue-text-field').style.display = 'none';
  document.getElementById('type-btn-image').className = 'btn btn-primary btn-sm';
  document.getElementById('type-btn-text').className = 'btn btn-secondary btn-sm';
  openModal('modal-add-clue');
}

function setClueType(type) {
  currentClueType = type;
  document.getElementById('clue-image-field').style.display = type === 'image' ? 'block' : 'none';
  document.getElementById('clue-text-field').style.display = type === 'text' ? 'block' : 'none';
  document.getElementById('type-btn-image').className = type === 'image' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  document.getElementById('type-btn-text').className = type === 'text' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
}

function previewFile(input) {
  const label = document.getElementById('file-drop-label');
  if (input.files[0]) label.textContent = '📄 ' + input.files[0].name;
}

async function uploadClue() {
  const location_name = document.getElementById('clue-location').value.trim();
  const errEl = document.getElementById('add-clue-error');
  const btn = document.getElementById('add-clue-btn');
  if (!location_name) { errEl.textContent = 'Enter a location name.'; return; }

  const position = allClues.length + 1;

  if (currentClueType === 'text') {
    const clue_text = document.getElementById('clue-text-input').value.trim();
    if (!clue_text) { errEl.textContent = 'Enter the clue text.'; return; }
    btn.innerHTML = '<span class="spinner"></span> Saving…';
    btn.disabled = true;
    const { error } = await sb.from('clues').insert({ case_id: currentCaseId, location_name, clue_text, image_url: '', position });
    if (error) { errEl.textContent = error.message; btn.textContent = 'Add to Case File'; btn.disabled = false; return; }
  } else {
    const file = document.getElementById('clue-file').files[0];
    if (!file) { errEl.textContent = 'Select an image.'; return; }
    btn.innerHTML = '<span class="spinner"></span> Uploading…';
    btn.disabled = true;
    const ext = file.name.split('.').pop();
    const path = `${currentCaseId}/${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('clues').upload(path, file);
    if (upErr) { errEl.textContent = upErr.message; btn.textContent = 'Add to Case File'; btn.disabled = false; return; }
    const { data: urlData } = sb.storage.from('clues').getPublicUrl(path);
    const { error: dbErr } = await sb.from('clues').insert({ case_id: currentCaseId, location_name, image_url: urlData.publicUrl, clue_text: '', position });
    if (dbErr) { errEl.textContent = dbErr.message; btn.textContent = 'Add to Case File'; btn.disabled = false; return; }
  }

  btn.textContent = 'Add to Case File'; btn.disabled = false;
  document.getElementById('clue-location').value = '';
  document.getElementById('clue-file').value = '';
  document.getElementById('clue-text-input').value = '';
  document.getElementById('file-drop-label').textContent = 'Click to select image';
  errEl.textContent = '';
  closeModal('modal-add-clue');
  await loadGMClues();
  toast('Clue added!');
}

// ── PLAYER ──
function showPlayerJoin() {
  openModal('modal-player-join');
}

async function doPlayerJoin() {
  const code = document.getElementById('player-case-code').value.trim();
  const name = document.getElementById('player-name-input').value.trim();
  const errEl = document.getElementById('player-join-error');
  if (!code) { errEl.textContent = 'Enter a case code.'; return; }
  if (!name) { errEl.textContent = 'Enter your name.'; return; }
  playerName = name;
  playerColor = nameToColor(name);
  await enterPlayer(code);
}

let kickSubscription = null;

async function enterPlayer(caseId) {
  const { data: caseData, error } = await sb.from('cases').select('*').eq('id', caseId).single();
  if (error || !caseData) {
    document.getElementById('player-join-error') && (document.getElementById('player-join-error').textContent = 'Case not found.');
    return;
  }

  // Check if already kicked
  const { data: existing } = await sb.from('players')
    .select('is_kicked').eq('case_id', caseId).eq('player_name', playerName).single();
  if (existing?.is_kicked) {
    const errEl = document.getElementById('player-join-error') || document.getElementById('identity-error');
    if (errEl) errEl.textContent = 'You have been removed from this case by the Game Master.';
    return;
  }

  // Register player
  await sb.from('players').upsert(
    { case_id: caseId, player_name: playerName, player_color: playerColor, is_kicked: false },
    { onConflict: 'case_id,player_name' }
  );

  closeModal('modal-player-join');
  currentCaseId = caseId;
  currentCaseName = caseData.name;
  currentCaseDescription = caseData.description || '';
  currentMapId = caseData.map_id || null;
  currentMapUrl = '';
  if (currentMapId) {
    const { data: mapData } = await sb.from('maps').select('url').eq('id', currentMapId).single();
    currentMapUrl = mapData?.url || '';
  }
  document.getElementById('mode-indicator').innerHTML = '<span class="mode-badge player">Investigator</span>';
  document.getElementById('player-case-title').textContent = caseData.name;
  renderPlayerBriefing();
  renderPlayerMap();
  showScreen('player-screen');
  document.getElementById('player-notebook-section').style.display = '';
  await loadPlayerClues();
  await loadNotes();
  subscribePlayer();
  subscribeNotes();
  subscribeKick(caseId);
  trackPlayerPresence(caseId);
}

function trackPlayerPresence(caseId) {
  if (playerPresenceChannel) sb.removeChannel(playerPresenceChannel);
  playerPresenceChannel = sb.channel('presence-' + caseId);
  playerPresenceChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await playerPresenceChannel.track({ player_name: playerName, player_color: playerColor });
    }
  });
}

function subscribeKick(caseId) {
  if (kickSubscription) sb.removeChannel(kickSubscription);
  kickSubscription = sb.channel('kick-' + caseId)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `case_id=eq.${caseId}` },
      payload => {
        if (payload.new.player_name === playerName && payload.new.is_kicked) showKickedScreen();
      })
    .subscribe();
}

function showKickedScreen() {
  if (playerSubscription) sb.removeChannel(playerSubscription);
  if (notesSubscription) sb.removeChannel(notesSubscription);
  if (kickSubscription) sb.removeChannel(kickSubscription);
  if (playerPresenceChannel) sb.removeChannel(playerPresenceChannel);
  const el = document.getElementById('kicked-overlay');
  el.style.display = 'flex';
}

async function loadPlayerClues() {
  const { data } = await sb.from('clues').select('*').eq('case_id', currentCaseId).eq('revealed', true).order('position');
  renderPlayerClues(data || []);
}

function renderPlayerClues(clues) {
  const meta = document.getElementById('player-meta');
  meta.textContent = clues.length ? `${clues.length} clue${clues.length !== 1 ? 's' : ''} gathered thus far` : '';

  if (!clues.length) {
    document.getElementById('player-content').innerHTML = '<div class="empty-state" style="color:var(--fog)">Awaiting the Game Master to reveal clues…</div>';
    return;
  }
  let html = '<div class="revealed-grid">';
  clues.forEach(c => {
    const body = c.clue_text
      ? `<div class="revealed-card-text">${c.clue_text}</div>`
      : `<img src="${c.image_url}" alt="${c.location_name}">`;
    html += `<div class="revealed-card" onclick="openClueExpand(${JSON.stringify(c).replace(/"/g, '&quot;')})">
      ${body}
      <div class="revealed-card-label">${c.location_name} <span style="float:right;opacity:0.4;font-size:0.8em">⤢</span></div>
    </div>`;
  });
  html += '</div>';
  document.getElementById('player-content').innerHTML = html;
}

function renderPlayerBriefing() {
  const desc = currentCaseDescription;
  const el = document.getElementById('player-briefing');
  if (!desc) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = `<div class="case-briefing-panel">
    <div class="briefing-header" onclick="toggleBriefing('player-briefing-body')">
      <span>Case Briefing</span><span id="player-briefing-toggle" class="briefing-toggle">▾</span>
    </div>
    <div id="player-briefing-body" class="briefing-body">
      <p class="briefing-text">${escapeHtml(desc)}</p>
    </div>
  </div>`;
}

function subscribePlayer() {
  if (playerSubscription) sb.removeChannel(playerSubscription);
  playerSubscription = sb.channel('clues-' + currentCaseId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clues', filter: `case_id=eq.${currentCaseId}` },
      () => loadPlayerClues())
    .subscribe();
}

// ── GM CLUE PREVIEW ──
function openGMCluePreview(clue) {
  openClueExpand(clue);
}

// ── LIGHTBOX ──
function openLightbox(url) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }

// ── CLUE EXPAND (PLAYER) ──
function openClueExpand(clue) {
  document.getElementById('clue-expand-title').textContent = clue.location_name;
  const body = document.getElementById('clue-expand-body');
  if (clue.clue_text) {
    body.innerHTML = `<div style="padding:24px 28px;font-family:Georgia,'Palatino Linotype',Palatino,serif;font-size:1.1rem;line-height:1.9;color:var(--ink);background:var(--paper);background-image:repeating-linear-gradient(transparent,transparent 30px,rgba(139,105,20,0.12) 30px,rgba(139,105,20,0.12) 31px);min-height:200px;">${clue.clue_text}</div>`;
  } else {
    body.innerHTML = `<img src="${clue.image_url}" style="width:100%;display:block;max-height:70vh;object-fit:contain;background:#1a1208;" alt="${clue.location_name}">`;
  }
  openModal('modal-clue-expand');
}

// ── EDIT CLUE ──
function showEditClue(id) {
  const c = allClues.find(x => x.id === id);
  if (!c) return;
  document.getElementById('edit-clue-id').value = c.id;
  document.getElementById('edit-clue-location').value = c.location_name;
  const isText = !!c.clue_text;
  document.getElementById('edit-clue-type').value = isText ? 'text' : 'image';
  document.getElementById('edit-image-field').style.display = isText ? 'none' : 'block';
  document.getElementById('edit-text-field').style.display = isText ? 'block' : 'none';
  if (isText) document.getElementById('edit-clue-text').value = c.clue_text;
  document.getElementById('edit-file-drop-label').textContent = 'Click to replace image (leave empty to keep current)';
  document.getElementById('edit-clue-file').value = '';
  document.getElementById('edit-clue-error').textContent = '';
  openModal('modal-edit-clue');
}

function previewEditFile(input) {
  if (input.files[0]) document.getElementById('edit-file-drop-label').textContent = '📄 ' + input.files[0].name;
}

async function saveEditClue() {
  const id = document.getElementById('edit-clue-id').value;
  const location_name = document.getElementById('edit-clue-location').value.trim();
  const type = document.getElementById('edit-clue-type').value;
  const btn = document.getElementById('edit-clue-btn');
  const errEl = document.getElementById('edit-clue-error');
  if (!location_name) { errEl.textContent = 'Enter a location name.'; return; }

  btn.innerHTML = '<span class="spinner"></span> Saving…';
  btn.disabled = true;

  let updates = { location_name };

  if (type === 'text') {
    const clue_text = document.getElementById('edit-clue-text').value.trim();
    if (!clue_text) { errEl.textContent = 'Enter clue text.'; btn.textContent = 'Save Changes'; btn.disabled = false; return; }
    updates.clue_text = clue_text;
  } else {
    const file = document.getElementById('edit-clue-file').files[0];
    if (file) {
      const ext = file.name.split('.').pop();
      const path = `${currentCaseId}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from('clues').upload(path, file);
      if (upErr) { errEl.textContent = upErr.message; btn.textContent = 'Save Changes'; btn.disabled = false; return; }
      const { data: urlData } = sb.storage.from('clues').getPublicUrl(path);
      updates.image_url = urlData.publicUrl;
    }
  }

  const { error } = await sb.from('clues').update(updates).eq('id', id);
  btn.textContent = 'Save Changes'; btn.disabled = false;
  if (error) { errEl.textContent = error.message; return; }
  closeModal('modal-edit-clue');
  await loadGMClues();
  toast('Clue updated!');
}

// ── DELETE CASE ──
async function deleteCase() {
  if (!currentCaseId) return;
  if (!confirm(`Delete case "${currentCaseName}" and all its clues? This cannot be undone.`)) return;
  await sb.from('clues').delete().eq('case_id', currentCaseId);
  await sb.from('cases').delete().eq('id', currentCaseId);
  currentCaseId = null;
  currentCaseName = null;
  document.getElementById('delete-case-btn').style.display = 'none';
  document.getElementById('share-box').style.display = 'none';
  document.getElementById('gm-content').innerHTML = '<div class="empty-state">Select or create a case to begin.</div>';
  const rp = document.getElementById('gm-right-panel');
  if (rp) rp.style.display = 'none';
  await loadCases();
  toast('Case deleted.');
}

// ── DELETE CLUE ──
async function deleteClue(id) {
  if (!confirm('Delete this clue? This cannot be undone.')) return;
  await sb.from('clues').delete().eq('id', id);
  await loadGMClues();
  toast('Clue deleted.');
}

// ── PLAYER IDENTITY ──
const PLAYER_COLORS = [
  { label: 'Crimson',  value: '#e05555' },
  { label: 'Navy',     value: '#5588dd' },
  { label: 'Forest',   value: '#55bb55' },
  { label: 'Plum',     value: '#cc66cc' },
  { label: 'Teal',     value: '#44cccc' },
  { label: 'Amber',    value: '#e8a030' },
  { label: 'Sky',      value: '#55aaee' },
  { label: 'Coral',    value: '#ee7755' },
];

function nameToColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[hash % PLAYER_COLORS.length].value;
}

let playerName = '';
let playerColor = PLAYER_COLORS[0].value;
let pendingCaseId = null;

// ── NOTES ──
let notesSubscription = null;
let currentNotes = [];
const minimizedNotes = new Set();

async function loadNotes() {
  const { data } = await sb.from('notes').select('*').eq('case_id', currentCaseId).order('created_at');
  currentNotes = data || [];
  renderNotes(currentNotes);
}

function renderNotes(notes) {
  const container = document.getElementById('notebook-notes');
  if (!notes.length) {
    container.innerHTML = '<div style="font-family:\'Courier New\',Courier,monospace;font-size:0.8rem;color:var(--fog);font-style:italic;">No notes yet. Be the first to record a deduction.</div>';
    return;
  }
  container.innerHTML = notes.map(n => {
    const date = new Date(n.created_at);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isOwn = n.player_name === playerName && n.player_color === playerColor;
    const isMinimized = minimizedNotes.has(n.id);
    const minimizeBtn = `<button class="note-action-btn" title="${isMinimized ? 'Expand' : 'Minimise'}" onclick="toggleMinimizeNote('${n.id}')">${isMinimized ? '▸' : '▾'}</button>`;
    const actionBtn = isOwn
      ? `<button class="note-action-btn" title="Delete note" onclick="deleteNote('${n.id}')" style="color:var(--red)">✕</button>${minimizeBtn}`
      : minimizeBtn;
    return `<div class="notebook-note" style="color:${n.player_color}">
      <div class="notebook-note-meta">
        <span class="notebook-note-name">${escapeHtml(n.player_name)}</span>
        <span class="notebook-note-time">${time}</span>
        ${actionBtn}
      </div>
      ${isMinimized ? '' : `<div class="notebook-note-text">${escapeHtml(n.content)}</div>`}
    </div>`;
  }).join('');
}

function showConfirmDelete(message, onConfirm) {
  document.getElementById('confirm-delete-msg').textContent = message;
  const btn = document.getElementById('confirm-delete-ok');
  btn.onclick = () => { closeConfirmDelete(); onConfirm(); };
  const modal = document.getElementById('modal-confirm-delete');
  modal.style.display = 'flex';
}
function closeConfirmDelete() {
  document.getElementById('modal-confirm-delete').style.display = 'none';
}

async function deleteNote(id) {
  showConfirmDelete('Delete this note from the Irregulars\' Notebook?', async () => {
    const { error } = await sb.from('notes').delete().eq('id', id);
    if (error) { toast('Error deleting note.'); return; }
    await loadNotes();
  });
}

function toggleMinimizeNote(id) {
  if (minimizedNotes.has(id)) minimizedNotes.delete(id);
  else minimizedNotes.add(id);
  renderNotes(currentNotes);
}

async function addNote() {
  const input = document.getElementById('notebook-input');
  const content = input.value.trim();
  if (!content) return;
  const { error } = await sb.from('notes').insert({
    case_id: currentCaseId,
    player_name: playerName,
    player_color: playerColor,
    content,
  });
  if (error) { toast('Error saving note.'); return; }
  input.value = '';
  await loadNotes();
}

function subscribeNotes() {
  if (notesSubscription) sb.removeChannel(notesSubscription);
  notesSubscription = sb.channel('notes-' + currentCaseId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `case_id=eq.${currentCaseId}` },
      () => loadNotes())
    .subscribe();
}

// ── IDENTITY MODAL (URL join) ──
let _identityResolveFn = null;

function promptIdentity() {
  return new Promise(resolve => {
    _identityResolveFn = resolve;
    document.getElementById('identity-name-input').value = playerName;
    document.getElementById('identity-error').textContent = '';
    openModal('modal-player-identity');
  });
}

function confirmIdentity() {
  const name = document.getElementById('identity-name-input').value.trim();
  if (!name) { document.getElementById('identity-error').textContent = 'Enter your name.'; return; }
  playerName = name;
  playerColor = nameToColor(name);
  closeModal('modal-player-identity');
  if (_identityResolveFn) { _identityResolveFn(); _identityResolveFn = null; }
}

// ── INIT ──
window.addEventListener('DOMContentLoaded', async () => {
  // Check for player link
  const params = new URLSearchParams(location.search);
  const caseParam = params.get('case');
  if (caseParam) {
    await promptIdentity();
    await enterPlayer(caseParam);
    return;
  }
  // Check for GM session
  if (store.get(GM_SESSION_KEY)) {
    enterGM();
    return;
  }
  showScreen('landing');
});
