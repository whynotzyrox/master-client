const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('masterAPI', {
  minimize: () => ipcRenderer.send('win-minimize'),
  maximize: () => ipcRenderer.send('win-maximize'),
  close: () => ipcRenderer.send('win-close'),
  getMcVersions: () => ipcRenderer.invoke('get-mc-versions'),
  launchGame: (cfg) => ipcRenderer.invoke('launch-game', cfg),
  onLaunchStatus: (cb) => ipcRenderer.on('launch-status', (_, data) => cb(data)),
  onLaunchClosed: (cb) => ipcRenderer.on('launch-closed', () => cb()),
  getMods: (ctx) => ipcRenderer.invoke('get-mods', ctx),
  toggleMod: (data) => ipcRenderer.invoke('toggle-mod', data),
  deleteMod: (data) => ipcRenderer.invoke('delete-mod', data),
  importFile: (data) => ipcRenderer.invoke('import-file', data),
  listFolder: (data) => ipcRenderer.invoke('list-folder', data),
  installModrinth: (data) => ipcRenderer.invoke('install-modrinth', data),
  openFolder: (data) => ipcRenderer.invoke('open-folder', data)
});
