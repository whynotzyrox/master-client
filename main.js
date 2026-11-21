const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function getInstanceDir(version, loader) {
  const safeName = `${version}-${loader}`.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dir = path.join(app.getPath('userData'), 'instances', safeName);
  for (const sub of ['mods', 'resourcepacks', 'shaderpacks', 'cosmetics']) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  return dir;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 1020,
    minHeight: 640,
    frame: false,
    backgroundColor: '#08080c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Window Controls
ipcMain.on('win-minimize', () => mainWindow?.minimize());
ipcMain.on('win-maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('win-close', () => mainWindow?.close());

// Fetch ALL official Minecraft versions from 1.8 to Latest
ipcMain.handle('get-mc-versions', async () => {
  try {
    const res = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
    if (!res.ok) throw new Error('Failed to fetch Mojang manifest');
    const data = await res.json();

    const minReleaseDate = new Date('2014-09-02T00:00:00Z').getTime();

    const versions = data.versions
      .filter((v) => {
        if (v.type !== 'release' && v.type !== 'snapshot') return false;
        return new Date(v.releaseTime).getTime() >= minReleaseDate;
      })
      .map((v) => ({
        id: v.id,
        type: v.type,
        isLatest: v.id === data.latest?.release
      }));

    return { latestRelease: data.latest?.release, versions };
  } catch (err) {
    return {
      latestRelease: '1.21.4',
      versions: [
        { id: '1.21.4', type: 'release', isLatest: true },
        { id: '1.21.1', type: 'release', isLatest: false },
        { id: '1.20.4', type: 'release', isLatest: false },
        { id: '1.20.1', type: 'release', isLatest: false },
        { id: '1.19.4', type: 'release', isLatest: false },
        { id: '1.18.2', type: 'release', isLatest: false },
        { id: '1.16.5', type: 'release', isLatest: false },
        { id: '1.12.2', type: 'release', isLatest: false },
        { id: '1.8.9', type: 'release', isLatest: false },
        { id: '1.8', type: 'release', isLatest: false }
      ]
    };
  }
});

// Download compatible Modrinth project .jar
async function installModrinthProject(projectSlug, version, loader, modsDir) {
  const url = `https://api.modrinth.com/v2/project/${projectSlug}/version?game_versions=${encodeURIComponent(
    JSON.stringify([version])
  )}&loaders=${encodeURIComponent(JSON.stringify([loader]))}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'MasterClient/2.1.0 (FeatherEdition)' }
  });
  if (!res.ok) return null;

  const versions = await res.json();
  if (!versions.length) return null;

  const file = versions[0].files.find((f) => f.primary) || versions[0].files[0];
  if (!file) return null;

  const destPath = path.join(modsDir, file.filename);
  if (fs.existsSync(destPath) || fs.existsSync(destPath + '.disabled')) {
    return file.filename;
  }

  const jarRes = await fetch(file.url);
  const buffer = Buffer.from(await jarRes.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return file.filename;
}

// Write Pro FPS options.txt if not already customized
function applyProFpsConfig(instanceDir) {
  const optionsPath = path.join(instanceDir, 'options.txt');
  if (!fs.existsSync(optionsPath)) {
    const proOptions = [
      'maxFps:260',
      'enableVsync:false',
      'particles:2',
      'renderClouds:"false"',
      'entityShadows:false',
      'biomeBlendRadius:1',
      'mipmapLevels:2',
      'bobView:false',
      'fov:0.5'
    ].join('\n');
    fs.writeFileSync(optionsPath, proOptions, 'utf8');
  }
}

// Launch Game
ipcMain.handle('launch-game', async (_, config) => {
  const { username, version, loader, ramGb, fpsBoost, voiceChat, proSettings } = config;
  const instanceDir = getInstanceDir(version, loader);
  const modsDir = path.join(instanceDir, 'mods');

  try {
    const eml = await import('eml-lib');
    const Launcher = eml.Launcher || eml.default?.Launcher;
    const CrackAuth = eml.CrackAuth || eml.default?.CrackAuth;

    if (proSettings) applyProFpsConfig(instanceDir);

    if (fpsBoost && loader === 'fabric') {
      const ultraFpsMods = [
        'fabric-api',
        'sodium',
        'sodium-extra',
        'reeses-sodium-options',
        'lithium',
        'immediatelyfast',
        'entityculling',
        'ferrite-core',
        'cull-leaves'
      ];
      for (let i = 0; i < ultraFpsMods.length; i++) {
        const slug = ultraFpsMods[i];
        mainWindow.webContents.send('launch-status', {
          text: `Ultra FPS Engine (${i + 1}/${ultraFpsMods.length}): ${slug}...`,
          progress: 5 + Math.round(((i + 1) / ultraFpsMods.length) * 20)
        });
        await installModrinthProject(slug, version, loader, modsDir);
      }
    }

    if (voiceChat && loader === 'fabric') {
      mainWindow.webContents.send('launch-status', {
        text: 'Checking Built-In Proximity Voice Chat...',
        progress: 28
      });
      await installModrinthProject('simple-voice-chat', version, loader, modsDir);
    }

    mainWindow.webContents.send('launch-status', {
      text: `Preparing Minecraft ${version} (${loader})...`,
      progress: 32
    });

    const account = new CrackAuth().auth(username || 'MasterPlayer');
    const mcConfig = loader === 'vanilla' ? { version } : { version, loader };

    const launcher = new Launcher({
      root: instanceDir,
      account,
      minecraft: mcConfig,
      memory: {
        min: 1024,
        max: Math.max(2048, Number(ramGb) * 1024)
      }
    });

    launcher.on('launch_download', (d) => {
      const pct = d?.total?.size
        ? Math.min(92, 32 + Math.round((d.current.size / d.total.size) * 60))
        : 60;
      mainWindow.webContents.send('launch-status', {
        text: `Downloading game files (${d?.current?.amount || 0}/${d?.total?.amount || '?'})...`,
        progress: pct
      });
    });

    launcher.on('launch_launch', () => {
      mainWindow.webContents.send('launch-status', {
        text: `Master Client ${version} Running!`,
        progress: 100
      });
    });

    launcher.on('launch_close', () => {
      mainWindow.webContents.send('launch-closed');
    });

    await launcher.launch();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Mods & Packs Management
ipcMain.handle('get-mods', (_, { version, loader }) => {
  const modsDir = path.join(getInstanceDir(version, loader), 'mods');
  return fs
    .readdirSync(modsDir)
    .filter((f) => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
    .map((f) => ({
      filename: f,
      displayName: f.replace(/\.jar(\.disabled)?$/, ''),
      enabled: f.endsWith('.jar')
    }));
});

ipcMain.handle('toggle-mod', (_, { version, loader, filename }) => {
  const modsDir = path.join(getInstanceDir(version, loader), 'mods');
  const oldPath = path.join(modsDir, filename);
  if (!fs.existsSync(oldPath)) return false;
  const newFilename = filename.endsWith('.disabled')
    ? filename.replace(/\.disabled$/, '')
    : `${filename}.disabled`;
  fs.renameSync(oldPath, path.join(modsDir, newFilename));
  return true;
});

ipcMain.handle('delete-mod', (_, { version, loader, filename }) => {
  const modsDir = path.join(getInstanceDir(version, loader), 'mods');
  const target = path.join(modsDir, filename);
  if (fs.existsSync(target)) fs.unlinkSync(target);
  return true;
});

ipcMain.handle('import-file', async (_, { version, loader, folder, ext }) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: `Select .${ext} File`,
    filters: [{ name: folder.toUpperCase(), extensions: [ext] }],
    properties: ['openFile', 'multiSelections']
  });
  if (res.canceled) return 0;

  const targetDir = path.join(getInstanceDir(version, loader), folder);
  for (const filePath of res.filePaths) {
    fs.copyFileSync(filePath, path.join(targetDir, path.basename(filePath)));
  }
  return res.filePaths.length;
});

ipcMain.handle('list-folder', (_, { version, loader, folder }) => {
  const dir = path.join(getInstanceDir(version, loader), folder);
  return fs.readdirSync(dir);
});

ipcMain.handle('install-modrinth', async (_, { projectId, version, loader }) => {
  const modsDir = path.join(getInstanceDir(version, loader), 'mods');
  const installed = await installModrinthProject(projectId, version, loader, modsDir);
  return Boolean(installed);
});

ipcMain.handle('open-folder', (_, { version, loader, folder }) => {
  shell.openPath(path.join(getInstanceDir(version, loader), folder));
});
