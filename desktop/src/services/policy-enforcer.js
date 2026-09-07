const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

class LinuxPolicyEnforcer {
  constructor() {
    this.primaryPolicyPath =
      process.env.CHROME_POLICY_PATH || '/etc/opt/chrome/policies/managed/zerofeed.json';
    this.chromiumPolicyPath =
      process.env.CHROMIUM_POLICY_PATH || '/etc/chromium/policies/managed/zerofeed.json';
    this.fallbackDevPath = path.join(os.homedir(), '.config/google-chrome/policies/managed/zerofeed.json');
  }

  getEffectivePolicyPath() {
    if (process.env.CHROME_POLICY_PATH) {
      return process.env.CHROME_POLICY_PATH;
    }
    return this.primaryPolicyPath;
  }

  generatePolicyJson(extensionId, forceInstall = true) {
    const cleanId = (extensionId || 'hpgfdhmdhondhgcfapnfgeedflocaaia').trim().toLowerCase();
    if (!/^[a-p]{32}$/.test(cleanId)) {
      throw new Error(`Invalid Chrome extension ID "${cleanId}". Must be exactly 32 lowercase letters (a-p).`);
    }
    return {
      ExtensionSettings: {
        [cleanId]: {
          installation_mode: forceInstall ? 'force_installed' : 'normal_installed',
          update_url: 'https://clients2.google.com/service/update2/crx',
        },
      },
    };
  }

  writeElevated(policyPath, content) {
    try {
      const script = 'mkdir -p "$(dirname "$1")" && printf \'%s\\n\' "$2" > "$1" && chmod 666 "$1"';
      const result = spawnSync('pkexec', ['sh', '-c', script, '_', policyPath, content], {
        encoding: 'utf8',
        timeout: 30000,
      });
      if (result.status === 0) {
        return { success: true };
      }
      return {
        success: false,
        error: result.stderr || (result.error ? result.error.message : `Process exited with code ${result.status}`),
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  applyPolicy(extensionId) {
    const policyPath = this.getEffectivePolicyPath();
    const policyDir = path.dirname(policyPath);
    let content;
    try {
      content = JSON.stringify(this.generatePolicyJson(extensionId, true), null, 2);
    } catch (valErr) {
      return {
        success: false,
        error: 'INVALID_EXTENSION_ID',
        message: valErr.message,
      };
    }

    try {
      if (!fs.existsSync(policyDir)) {
        fs.mkdirSync(policyDir, { recursive: true });
      }
      fs.writeFileSync(policyPath, content, 'utf8');
      return {
        success: true,
        message: `Chrome Enterprise Policy successfully applied (force_installed) at ${policyPath}`,
        policyPath,
        extensionId,
        installationMode: 'force_installed',
      };
    } catch (err) {
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        const elevated = this.writeElevated(policyPath, content);
        if (elevated.success) {
          return {
            success: true,
            message: `Chrome Enterprise Policy successfully applied with elevated permissions at ${policyPath}`,
            policyPath,
            extensionId,
            installationMode: 'force_installed',
          };
        }
      }
      return {
        success: false,
        error: err.code || 'WRITE_FAILED',
        message: `Could not write policy to ${policyPath}: ${err.message}. Ensure permissions or run with sudo.`,
        suggestedCommand: `sudo touch ${policyPath} && sudo chmod 666 ${policyPath}`,
        policyPath,
        extensionId,
      };
    }
  }

  removePolicy(extensionId) {
    const policyPath = this.getEffectivePolicyPath();
    let content;
    try {
      content = JSON.stringify(this.generatePolicyJson(extensionId, false), null, 2);
    } catch (valErr) {
      return {
        success: false,
        error: 'INVALID_EXTENSION_ID',
        message: valErr.message,
      };
    }

    try {
      if (fs.existsSync(policyPath)) {
        fs.writeFileSync(policyPath, content, 'utf8');
      }
      return {
        success: true,
        message: `Chrome Enterprise Policy disabled (set to normal_installed) at ${policyPath}`,
        policyPath,
        extensionId,
        installationMode: 'normal_installed',
      };
    } catch (err) {
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        const elevated = this.writeElevated(policyPath, content);
        if (elevated.success) {
          return {
            success: true,
            message: `Chrome Enterprise Policy disabled with elevated permissions at ${policyPath}`,
            policyPath,
            extensionId,
            installationMode: 'normal_installed',
          };
        }
      }
      return {
        success: false,
        error: err.code || 'WRITE_FAILED',
        message: `Could not modify policy at ${policyPath}: ${err.message}.`,
        suggestedCommand: `sudo touch ${policyPath} && sudo chmod 666 ${policyPath}`,
      };
    }
  }

  getPolicyStatus(extensionId) {
    const policyPath = this.getEffectivePolicyPath();
    const targetId = (extensionId || 'hpgfdhmdhondhgcfapnfgeedflocaaia').trim().toLowerCase();

    if (!fs.existsSync(policyPath)) {
      return {
        installed: false,
        active: false,
        policyPath,
        extensionId: targetId,
        details: 'Policy file does not exist on disk.',
      };
    }

    try {
      const raw = fs.readFileSync(policyPath, 'utf8');
      const data = JSON.parse(raw);
      const settings = data.ExtensionSettings?.[targetId];
      const isForceInstalled = settings?.installation_mode === 'force_installed';

      return {
        installed: true,
        active: isForceInstalled,
        installationMode: settings?.installation_mode || 'unknown',
        policyPath,
        extensionId: targetId,
        content: data,
      };
    } catch (err) {
      return {
        installed: true,
        active: false,
        error: 'PARSE_ERROR',
        message: err.message,
        policyPath,
      };
    }
  }

  detectInstalledExtensions() {
    const detected = [];
    const basePaths = [
      path.join(os.homedir(), '.config/google-chrome'),
      path.join(os.homedir(), '.config/chromium'),
    ];

    for (const basePath of basePaths) {
      if (!fs.existsSync(basePath)) continue;

      let profiles = [];
      try {
        profiles = fs.readdirSync(basePath).filter((name) =>
          name === 'Default' || name.startsWith('Profile ')
        );
      } catch (_) {
        continue;
      }

      for (const profile of profiles) {
        const extDir = path.join(basePath, profile, 'Extensions');
        if (!fs.existsSync(extDir)) continue;

        let extIds = [];
        try {
          extIds = fs.readdirSync(extDir).filter((id) => /^[a-p]{32}$/.test(id));
        } catch (_) {
          continue;
        }

        for (const id of extIds) {
          try {
            const versionsDir = path.join(extDir, id);
            const versions = fs.readdirSync(versionsDir).filter((v) => !v.startsWith('.'));
            if (versions.length === 0) continue;

            const manifestPath = path.join(versionsDir, versions[0], 'manifest.json');
            if (fs.existsSync(manifestPath)) {
              const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
              const name = manifest.name || 'Unnamed Extension';
              const isZeroFeed =
                name.toLowerCase().includes('zero') && name.toLowerCase().includes('feed');
              detected.push({
                id,
                name,
                version: manifest.version || '1.0.0',
                profile,
                isZeroFeed,
              });
            }
          } catch (_) {}
        }
      }
    }

    return detected;
  }
}

module.exports = new LinuxPolicyEnforcer();
