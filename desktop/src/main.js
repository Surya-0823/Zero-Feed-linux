const { app, BrowserWindow, ipcMain, shell } = require('electron');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const policyEnforcer = require('./services/policy-enforcer');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || 'http://localhost:3001';

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
  ipcMain.handle('auth:startBrowserLogin', async () => {
    return new Promise((resolve) => {
      const state = crypto.randomBytes(16).toString('hex');
      let isResolved = false;

      const server = http.createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url, 'http://127.0.0.1');
          if (reqUrl.pathname === '/callback') {
            const code = reqUrl.searchParams.get('code');
            const incomingState = reqUrl.searchParams.get('state');

            if (!code || incomingState !== state) {
              res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end('<h1>Authentication Failed</h1><p>Invalid or expired state parameter.</p>');
              return;
            }

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#FAFAFA;">
              <h1 style="color:#10B981;">⚡ ZeroFeed Desktop Authenticated</h1>
              <p>You can close this tab and return to the ZeroFeed desktop application.</p>
              <script>setTimeout(() => window.close(), 2500);</script>
            </body></html>`);

            try {
              server.close();
            } catch (_) {}

            if (!isResolved) {
              isResolved = true;
              try {
                const exchangeResult = await apiRequest('/api/v1/auth/exchange', 'POST', { code, state });
                sessionData.accessToken = exchangeResult.tokens.accessToken;
                sessionData.refreshToken = exchangeResult.tokens.refreshToken;
                sessionData.user = exchangeResult.user;
                sessionData.subscription = exchangeResult.subscription;
                resolve({ success: true, data: exchangeResult });
              } catch (exchangeErr) {
                resolve({ success: false, error: exchangeErr.message });
              }
            }
          } else {
            res.writeHead(404);
            res.end();
          }
        } catch (err) {
          res.writeHead(500);
          res.end();
        }
      });

      // Bind on dynamic port 0 (standard RFC 8252 loopback)
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const targetUrl = `${WEB_PORTAL_URL}/?source=desktop&port=${port}&state=${state}`;
        shell.openExternal(targetUrl);
      });

      // Ephemeral listener safety: generous 5-minute timeout for 2FA & browser handshakes
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          try {
            server.close();
          } catch (_) {}
          resolve({ success: false, error: 'Sign in timed out (5 minutes). Please try again.' });
        }
      }, 300000);
    });
  });

  ipcMain.handle('auth:openWebPortal', (_, targetPath = '') => {
    const url = targetPath ? `${WEB_PORTAL_URL}${targetPath}` : WEB_PORTAL_URL;
    shell.openExternal(url);
    return { success: true };
  });

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
