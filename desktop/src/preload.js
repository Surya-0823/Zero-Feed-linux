const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zeroFeedAPI', {
  // Authentication
  auth: {
    loginWithGoogle: (idToken) => ipcRenderer.invoke('auth:google', idToken),
    startBrowserLogin: () => ipcRenderer.invoke('auth:startBrowserLogin'),
    openWebPortal: (path) => ipcRenderer.invoke('auth:openWebPortal', path),
    getMe: () => ipcRenderer.invoke('auth:me'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
  },

  // Backend Policy & Partner Management
  policy: {
    getPolicy: () => ipcRenderer.invoke('policy:get'),
    setPartner: (email, name) => ipcRenderer.invoke('policy:setPartner', { email, name }),
    setExtensionId: (extensionId) => ipcRenderer.invoke('policy:setExtensionId', extensionId),
    enablePolicy: () => ipcRenderer.invoke('policy:enable'),
    requestOtp: (action, targetState) => ipcRenderer.invoke('policy:requestOtp', { action, targetState }),
    verifyOtp: (action, otpCode) => ipcRenderer.invoke('policy:verifyOtp', { action, otpCode }),
    getChromeJson: () => ipcRenderer.invoke('policy:getChromeJson'),
  },

  // Linux Chrome Enterprise Policy Enforcer
  enforcer: {
    applyLinuxPolicy: (extensionId) => ipcRenderer.invoke('enforcer:apply', extensionId),
    removeLinuxPolicy: (extensionId) => ipcRenderer.invoke('enforcer:remove', extensionId),
    getLinuxPolicyStatus: (extensionId) => ipcRenderer.invoke('enforcer:status', extensionId),
    detectInstalledExtensions: () => ipcRenderer.invoke('enforcer:detectExtensions'),
  },
});
