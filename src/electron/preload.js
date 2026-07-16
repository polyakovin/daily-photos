const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('photoDayDesktop', {
  platform: process.platform,
  getArchiveState: () => ipcRenderer.invoke('archive:get-state'),
  chooseArchiveDirectory: () => ipcRenderer.invoke('archive:choose-directory'),
  scanPhotoLocations: () => ipcRenderer.invoke('archive:scan-photo-locations'),
  revealArchiveDirectory: () => ipcRenderer.invoke('archive:reveal-directory'),
  getBirthDate: () => ipcRenderer.invoke('profile:get-birth-date'),
  setBirthDate: (value) => ipcRenderer.invoke('profile:set-birth-date', value),
  onSettingsRequested: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('archive:request-settings', handler);
    return () => ipcRenderer.removeListener('archive:request-settings', handler);
  }
});
