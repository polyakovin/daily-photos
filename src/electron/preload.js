const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('photoDayDesktop', {
  platform: process.platform,
  getArchiveState: () => ipcRenderer.invoke('archive:get-state'),
  chooseArchiveDirectory: () => ipcRenderer.invoke('archive:choose-directory'),
  scanPhotoLocations: () => ipcRenderer.invoke('archive:scan-photo-locations'),
  setArchiveConversion: (enabled) => ipcRenderer.invoke('archive:set-convert-images', enabled),
  revealArchiveDirectory: () => ipcRenderer.invoke('archive:reveal-directory'),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  suggestPhotoDate: (filePaths) => ipcRenderer.invoke('archive:suggest-photo-date', filePaths),
  importPhotos: (filePaths, date) => ipcRenderer.invoke('archive:import-photos', filePaths, date),
  getBirthDate: () => ipcRenderer.invoke('profile:get-birth-date'),
  setBirthDate: (value) => ipcRenderer.invoke('profile:set-birth-date', value),
  getNavigationState: () => ipcRenderer.invoke('ui:get-navigation-state'),
  setNavigationState: (value) => ipcRenderer.invoke('ui:set-navigation-state', value),
  onSettingsRequested: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('archive:request-settings', handler);
    return () => ipcRenderer.removeListener('archive:request-settings', handler);
  }
});
