const usernameInput = document.getElementById('username');
const versionSelect = document.getElementById('mc-version');
const versionFilter = document.getElementById('version-filter');
const showSnapshotsCheck = document.getElementById('show-snapshots');
const loaderSelect = document.getElementById('mc-loader');
const ramSlider = document.getElementById('ram-slider');
const ramLabel = document.getElementById('ram-label');
const playBtn = document.getElementById('play-btn');
const statusText = document.getElementById('status-text');
const progressFill = document.getElementById('progress-fill');

let allVersions = [];

usernameInput.value = localStorage.getItem('mc_user') || 'MasterPlayer';
loaderSelect.value = localStorage.getItem('mc_loader') || 'fabric';
ramSlider.value = localStorage.getItem('mc_ram') || '4';
ramLabel.textContent = `${ramSlider.value} GB`;

usernameInput.oninput = () => localStorage.setItem('mc_user', usernameInput.value);
versionSelect.onchange = () => { localStorage.setItem('mc_ver', versionSelect.value); refreshMods(); refreshPacks(); };
loaderSelect.onchange = () => { localStorage.setItem('mc_loader', loaderSelect.value); refreshMods(); refreshPacks(); };
ramSlider.oninput = () => { ramLabel.textContent = `${ramSlider.value} GB`; localStorage.setItem('mc_ram', ramSlider.value); };

document.getElementById('min-btn').onclick = () => window.masterAPI.minimize();
document.getElementById('max-btn').onclick = () => window.masterAPI.maximize();
document.getElementById('close-btn').onclick = () => window.masterAPI.close();

// Render filtered Minecraft versions (1.8 to Latest)
function renderVersionDropdown() {
  const includeSnapshots = showSnapshotsCheck.checked;
  const query = versionFilter.value.trim().toLowerCase();
  const savedVer = localStorage.getItem('mc_ver');

  const filtered = allVersions.filter((v) => {
    if (!includeSnapshots && v.type !== 'release') return false;
    if (query && !v.id.toLowerCase().includes(query)) return false;
    return true;
  });

  if (!filtered.length) {
    versionSelect.innerHTML = `<option value="">No matching version found</option>`;
    return;
  }

  versionSelect.innerHTML = filtered
    .map((v) => {
      let tag = '';
      if (v.isLatest) tag = ' (Latest Release)';
      else if (v.id === '1.8.9') tag = ' (Classic PvP)';
      else if (v.type === 'snapshot') tag = ' [Snapshot]';
      return `<option value="${v.id}">${v.id}${tag}</option>`;
    })
    .join('');

  if (savedVer && filtered.some((v) => v.id === savedVer)) {
    versionSelect.value = savedVer;
  } else {
    versionSelect.value = filtered[0].id;
    localStorage.setItem('mc_ver', versionSelect.value);
  }
}

async function initVersions() {
  const data = await window.masterAPI.getMcVersions();
  allVersions = data.versions || [];
  renderVersionDropdown();
}

showSnapshotsCheck.onchange = renderVersionDropdown;
versionFilter.oninput = renderVersionDropdown;
initVersions();

// Sidebar navigation
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'mods') refreshMods();
    if (btn.dataset.tab === 'packs') refreshPacks();
  };
});

// Feather Essentials 1-Click Presets
const FEATHER_PRESETS = [
  { slug: 'zoomify', name: 'OptiFine Zoom', desc: 'Smooth scroll zoom (C)' },
  { slug: 'freelook', name: '360° Freelook', desc: 'Look around while running' },
  { slug: 'ukus-armor-hud', name: 'Armor Durability HUD', desc: 'Live armor status bar' },
  { slug: 'appleskin', name: 'Saturation HUD', desc: 'Food & hunger overlay' },
  { slug: 'capes', name: 'Custom Capes', desc: 'Wear custom capes in-game' },
  { slug: 'iris', name: 'Iris Shaders', desc: 'High-FPS shader support' }
];

document.getElementById('preset-mods').innerHTML = FEATHER_PRESETS.map(
  (p) => `
  <div class="card" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
    <div><strong style="font-size:13px;">${p.name}</strong><br><small style="color:var(--muted); font-size:11px;">${p.desc}</small></div>
    <button class="btn-sec" onclick="installPreset('${p.slug}', this)">Add</button>
  </div>`
).join('');

window.installPreset = async (slug, btn) => {
  if (loaderSelect.value === 'vanilla') return alert('Select Fabric, Forge, NeoForge, or Quilt on Home tab first!');
  btn.disabled = true;
  btn.textContent = '...';
  const ok = await window.masterAPI.installModrinth({
    projectId: slug,
    version: versionSelect.value,
    loader: loaderSelect.value
  });
  btn.textContent = ok ? '✓' : 'N/A';
  refreshMods();
};

playBtn.onclick = async () => {
  if (!versionSelect.value) return alert('Please select a valid Minecraft version!');
  playBtn.disabled = true;
  progressFill.style.width = '5%';
  const res = await window.masterAPI.launchGame({
    username: usernameInput.value.trim(),
    version: versionSelect.value,
    loader: loaderSelect.value,
    ramGb: ramSlider.value,
    fpsBoost: document.getElementById('fps-boost').checked,
    proSettings: document.getElementById('pro-settings').checked,
    voiceChat: document.getElementById('voice-chat').checked
  });
  if (!res.ok) {
    statusText.textContent = `Error: ${res.error}`;
    progressFill.style.width = '0%';
    playBtn.disabled = false;
  }
};

window.masterAPI.onLaunchStatus(({ text, progress }) => {
  statusText.textContent = text;
  progressFill.style.width = `${progress}%`;
});
window.masterAPI.onLaunchClosed(() => {
  statusText.textContent = 'Ready to launch Master Client';
  progressFill.style.width = '0%';
  playBtn.disabled = false;
});

async function refreshMods() {
  if (!versionSelect.value) return;
  const list = document.getElementById('installed-mods');
  const mods = await window.masterAPI.getMods({ version: versionSelect.value, loader: loaderSelect.value });
  list.innerHTML = mods.length
    ? mods.map((m) => `
      <div class="mod-item">
        <div class="mod-meta"><strong>${m.displayName}</strong><small>${m.filename}</small></div>
        <div style="display:flex; align-items:center; gap:10px;">
          <label class="switch"><input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="toggleMod('${m.filename}')" /><span class="slider"></span></label>
          <button class="btn-sec" onclick="deleteMod('${m.filename}')">✕</button>
        </div>
      </div>`).join('')
    : '<div class="mod-item"><span style="color:var(--muted)">No mods installed for this version yet. Click Add above or Launch with 3x FPS enabled!</span></div>';
}

window.toggleMod = async (filename) => {
  await window.masterAPI.toggleMod({ version: versionSelect.value, loader: loaderSelect.value, filename });
  refreshMods();
};
window.deleteMod = async (filename) => {
  await window.masterAPI.deleteMod({ version: versionSelect.value, loader: loaderSelect.value, filename });
  refreshMods();
};

document.getElementById('import-mod-btn').onclick = async () => {
  await window.masterAPI.importFile({ version: versionSelect.value, loader: loaderSelect.value, folder: 'mods', ext: 'jar' });
  refreshMods();
};
document.getElementById('open-mods-btn').onclick = () => {
  window.masterAPI.openFolder({ version: versionSelect.value, loader: loaderSelect.value, folder: 'mods' });
};

document.getElementById('search-btn').onclick = async () => {
  const q = document.getElementById('mod-search').value.trim();
  const box = document.getElementById('search-results');
  if (!q) { box.style.display = 'none'; return; }
  box.style.display = 'flex';
  box.innerHTML = '<div class="mod-item">Searching Modrinth...</div>';
  const facets = JSON.stringify([['project_type:mod'], [`versions:${versionSelect.value}`], [`categories:${loaderSelect.value}`]]);
  const res = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(q)}&facets=${encodeURIComponent(facets)}&limit=8`);
  const data = await res.json();
  box.innerHTML = data.hits?.length
    ? data.hits.map((h) => `
      <div class="mod-item">
        <div class="mod-meta"><strong>${h.title}</strong><small>${h.description.slice(0, 80)}...</small></div>
        <button class="btn-sec" onclick="installPreset('${h.project_id}', this)">Install</button>
      </div>`).join('')
    : `<div class="mod-item">No matching mods found for ${versionSelect.value} (${loaderSelect.value}).</div>`;
};

// Packs & Shaders
async function refreshPacks() {
  if (!versionSelect.value) return;
  for (const [folder, elId] of [['resourcepacks', 'rp-list'], ['shaderpacks', 'sh-list']]) {
    const items = await window.masterAPI.listFolder({ version: versionSelect.value, loader: loaderSelect.value, folder });
    document.getElementById(elId).innerHTML = items.length
      ? items.map((f) => `<div class="mod-item"><strong>${f}</strong></div>`).join('')
      : `<div class="mod-item"><span style="color:var(--muted)">Empty — click + Add to import .zip</span></div>`;
  }
}
document.getElementById('import-rp-btn').onclick = async () => {
  await window.masterAPI.importFile({ version: versionSelect.value, loader: loaderSelect.value, folder: 'resourcepacks', ext: 'zip' });
  refreshPacks();
};
document.getElementById('import-sh-btn').onclick = async () => {
  await window.masterAPI.importFile({ version: versionSelect.value, loader: loaderSelect.value, folder: 'shaderpacks', ext: 'zip' });
  refreshPacks();
};

// 2D Character Skin Renderer
const ctx = document.getElementById('skin-canvas').getContext('2d');
ctx.imageSmoothingEnabled = false;
function drawDefaultAvatar() {
  ctx.fillStyle = '#14141e'; ctx.fillRect(0, 0, 160, 220);
  ctx.fillStyle = '#ff2a4b'; ctx.fillRect(56, 20, 48, 48);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(64, 38, 10, 6); ctx.fillRect(86, 38, 10, 6);
  ctx.fillStyle = '#1e1e2a'; ctx.fillRect(52, 72, 56, 68);
  ctx.fillStyle = '#ff2a4b'; ctx.fillRect(32, 72, 18, 64); ctx.fillRect(110, 72, 18, 64);
  ctx.fillStyle = '#14141c'; ctx.fillRect(54, 142, 24, 62); ctx.fillRect(82, 142, 24, 62);
}
drawDefaultAvatar();

document.getElementById('skin-upload').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    ctx.fillStyle = '#14141e'; ctx.fillRect(0, 0, 160, 220);
    ctx.drawImage(img, 8, 8, 8, 8, 56, 20, 48, 48);
    ctx.drawImage(img, 20, 20, 8, 12, 52, 72, 56, 68);
    ctx.drawImage(img, 44, 20, 4, 12, 32, 72, 18, 64);
    ctx.drawImage(img, 36, 52, 4, 12, 110, 72, 18, 64);
    ctx.drawImage(img, 4, 20, 4, 12, 54, 142, 24, 62);
    ctx.drawImage(img, 20, 52, 4, 12, 82, 142, 24, 62);
  };
  img.src = URL.createObjectURL(file);
};
