// c:\Users\DELL\Documents\oculaa_Photo_Booth\preload.cjs
const { contextBridge, ipcRenderer } = require('electron');
 
contextBridge.exposeInMainWorld('electronAPI', {
  // Invoke methods (renderer to main, and expect a result)
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  getTemplates: () => ipcRenderer.invoke('get-templates'),
  uploadTemplate: (data) => ipcRenderer.invoke('upload-template', data),
  deleteTemplate: (templateName) => ipcRenderer.invoke('delete-template', templateName),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  setCameraFolder: (folderPath) => ipcRenderer.invoke('set-camera-folder', folderPath),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  mergeImage: (data) => ipcRenderer.invoke('merge-image', data),
  printImage: (data) => ipcRenderer.invoke('print-image', data),

  // Receive events (main to renderer)
  onNewPhoto: (callback) => ipcRenderer.on('new-photo', (event, photo) => callback(photo)),
});