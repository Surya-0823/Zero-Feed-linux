const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const policyEnforcer = require('./services/policy-enforcer');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

let sessionData = {
  accessToken: null,
  refreshToken: null,
  user: null,
  subscription: null,
};

async function apiRequest(endpoint, method = 'GET', body = null, retry = true) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (sessionData.accessToken) {
    headers['Authorization'] = `Bearer ${sessionData.accessToken}`;
  }

  const options = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BACKEND_URL}${endpoint}`, options);
  const data = await res.json().catch(() => ({}));

  // Handle transparent token refresh on 401 Unauthorized
  if (
    res.status === 401 &&
    retry &&
    sessionData.refreshToken &&
    endpoint !== '/api/v1/auth/refresh' &&
    endpoint !== '/api/v1/auth/google'
  ) {
    try {
      const refreshRes = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: sessionData.refreshToken }),
      });
      const refreshData = await refreshRes.json().catch(() => ({}));
      if (refreshRes.ok && refreshData.tokens?.accessToken) {
        sessionData.accessToken = refreshData.tokens.accessToken;
        sessionData.refreshToken = refreshData.tokens.refreshToken;
        return apiRequest(endpoint, method, body, false);
      }
    } catch (_) {
      // If refresh failed, fall through to error handling
    }
  }

  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  }

  return data;
}

function setupIpcHandlers() {
  // Auth Handlers
  ipcMain.handle('auth:google', async (_, idToken) => {
    try {
      const result = await apiRequest('/api/v1/auth/google', 'POST', { idToken });
      sessionData.accessToken = result.tokens.accessToken;
      sessionData.refreshToken = result.tokens.refreshToken;
      sessionData.user = result.user;
      sessionData.subscription = result.subscription;
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:me', async () => {
    try {
      const result = await apiRequest('/api/v1/auth/me');
      sessionData.user = result.user;
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:logout', async () => {
    try {
      if (sessionData.refreshToken) {
        await apiRequest('/api/v1/auth/logout', 'POST', { refreshToken: sessionData.refreshToken });
      }
    } catch (_) {}
    sessionData = { accessToken: null, refreshToken: null, user: null, subscription: null };
    return { success: true };
  });

  ipcMain.handle('auth:getSession', () => {
    return sessionData;
  });

  // Policy Handlers
  ipcMain.handle('policy:get', async () => {
    try {
      const result = await apiRequest('/api/v1/policy');
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('policy:setPartner', async (_, { email, name }) => {
    try {
      const result = await apiRequest('/api/v1/policy/partner', 'POST', { email, name });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('policy:setExtensionId', async (_, extensionId) => {
    try {
      const result = await apiRequest('/api/v1/policy/extension-id', 'POST', { extensionId });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('policy:enable', async () => {
    try {
      const result = await apiRequest('/api/v1/policy/enable', 'POST');
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('policy:requestOtp', async (_, { action, targetState }) => {
    try {
      const result = await apiRequest('/api/v1/policy/request-otp', 'POST', { action, targetState });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('policy:verifyOtp', async (_, { action, otpCode }) => {
    try {
      const result = await apiRequest('/api/v1/policy/verify-otp', 'POST', { action, otpCode });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('policy:getChromeJson', async () => {
    try {
      const result = await apiRequest('/api/v1/policy/chrome-json');
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Linux Chrome Enterprise Policy Enforcer Handlers
  ipcMain.handle('enforcer:apply', (_, extensionId) => {
    return policyEnforcer.applyPolicy(extensionId);
  });

  ipcMain.handle('enforcer:remove', (_, extensionId) => {
    return policyEnforcer.removePolicy(extensionId);
  });

  ipcMain.handle('enforcer:status', (_, extensionId) => {
    return policyEnforcer.getPolicyStatus(extensionId);
  });

  ipcMain.handle('enforcer:detectExtensions', () => {
    return policyEnforcer.detectInstalledExtensions();
  });
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'ZeroFeed Linux Desktop Enforcer',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
