const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const policyEnforcer = require('./policy-enforcer');

test('LinuxPolicyEnforcer', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zerofeed-policy-test-'));
  const testPolicyPath = path.join(tmpDir, 'managed', 'zerofeed.json');
  process.env.CHROME_POLICY_PATH = testPolicyPath;

  t.after(() => {
    delete process.env.CHROME_POLICY_PATH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const validTestId = 'abcdefghijklmnopabcdefghijklmnop';
  const invalidTestId = 'hpgfdhmdhondhgcfapngeedflocaiaa'; // 31 chars

  await t.test('generatePolicyJson generates correct Chrome Enterprise format', () => {
    const json = policyEnforcer.generatePolicyJson(validTestId, true);
    assert.deepEqual(json, {
      ExtensionSettings: {
        [validTestId]: {
          installation_mode: 'force_installed',
          update_url: 'https://clients2.google.com/service/update2/crx',
        },
      },
    });

    const normalJson = policyEnforcer.generatePolicyJson(validTestId, false);
    assert.equal(normalJson.ExtensionSettings[validTestId].installation_mode, 'normal_installed');

    // Reject invalid 31-char ID
    assert.throws(() => policyEnforcer.generatePolicyJson(invalidTestId), /Invalid Chrome extension ID/);
  });

  await t.test('getPolicyStatus reports not installed when file does not exist', () => {
    const status = policyEnforcer.getPolicyStatus(validTestId);
    assert.equal(status.installed, false);
    assert.equal(status.active, false);
  });

  await t.test('applyPolicy creates policy directory and writes force_installed JSON', () => {
    const res = policyEnforcer.applyPolicy(validTestId);
    assert.equal(res.success, true);
    assert.equal(res.installationMode, 'force_installed');
    assert.equal(fs.existsSync(testPolicyPath), true);

    const status = policyEnforcer.getPolicyStatus(validTestId);
    assert.equal(status.installed, true);
    assert.equal(status.active, true);
    assert.equal(status.installationMode, 'force_installed');

    // Reject invalid ID
    const failRes = policyEnforcer.applyPolicy(invalidTestId);
    assert.equal(failRes.success, false);
    assert.equal(failRes.error, 'INVALID_EXTENSION_ID');
  });

  await t.test('removePolicy updates policy to normal_installed without deleting the file', () => {
    const res = policyEnforcer.removePolicy(validTestId);
    assert.equal(res.success, true);
    assert.equal(res.installationMode, 'normal_installed');

    const status = policyEnforcer.getPolicyStatus(validTestId);
    assert.equal(status.installed, true);
    assert.equal(status.active, false);
    assert.equal(status.installationMode, 'normal_installed');
  });

  await t.test('detectInstalledExtensions returns an array of detected extensions', () => {
    const list = policyEnforcer.detectInstalledExtensions();
    assert.equal(Array.isArray(list), true);
    if (list.length > 0) {
      assert.ok(list[0].id);
      assert.ok(list[0].name);
    }
  });
});
