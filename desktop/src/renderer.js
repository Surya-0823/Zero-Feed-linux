import './index.css';

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const authScreen = document.getElementById('auth-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const userPill = document.getElementById('user-pill');
  const userEmailSpan = document.getElementById('user-email');
  const alertBanner = document.getElementById('alert-banner');

  const btnDevLogin = document.getElementById('btn-dev-login');
  const btnTokenLogin = document.getElementById('btn-token-login');
  const googleIdTokenInput = document.getElementById('google-id-token');
  const btnLogout = document.getElementById('btn-logout');

  const subPlanBadge = document.getElementById('sub-plan-badge');
  const subAccessBadge = document.getElementById('sub-access-badge');

  const inputPartnerEmail = document.getElementById('input-partner-email');
  const inputPartnerName = document.getElementById('input-partner-name');
  const btnSavePartner = document.getElementById('btn-save-partner');

  const policyStatusPill = document.getElementById('policy-status-pill');
  const inputExtensionId = document.getElementById('input-extension-id');
  const btnUpdateExtId = document.getElementById('btn-update-ext-id');
  const policyFilePathSpan = document.getElementById('policy-file-path');
  const btnApplyPolicy = document.getElementById('btn-apply-policy');
  const btnDisablePolicy = document.getElementById('btn-disable-policy');
  const btnRefreshStatus = document.getElementById('btn-refresh-status');
  const policyJsonPreview = document.getElementById('policy-json-preview');

  // Modal Elements
  const otpModal = document.getElementById('otp-modal');
  const otpModalDesc = document.getElementById('otp-modal-desc');
  const otpCodeInput = document.getElementById('otp-code-input');
  const btnSubmitOtp = document.getElementById('btn-submit-otp');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnResendOtp = document.getElementById('btn-resend-otp');
  const resendTimerSpan = document.getElementById('resend-timer');

  // State
  let currentAction = null;
  let currentActionPayload = null;
  let resendCountdown = 0;
  let resendInterval = null;

  function showAlert(message, type = 'success') {
    alertBanner.textContent = message;
    alertBanner.className = `alert-banner ${type}`;
    alertBanner.classList.remove('hidden');
    setTimeout(() => {
      alertBanner.classList.add('hidden');
    }, 6000);
  }

  function hideAlert() {
    alertBanner.classList.add('hidden');
  }

  // View Navigation
  function showDashboard(user, subscription) {
    authScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    userPill.classList.remove('hidden');

    userEmailSpan.textContent = user.email;
    subPlanBadge.textContent = subscription?.plan || 'FREE';
    
    if (subscription?.status === 'ACTIVE') {
      subAccessBadge.textContent = 'ACTIVE (PAID)';
      subAccessBadge.className = 'badge badge-success';
    } else {
      subAccessBadge.textContent = 'INACTIVE (UNPAID)';
      subAccessBadge.className = 'badge badge-warning';
    }

    refreshPolicyView();
  }

  function showAuthScreen() {
    authScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    userPill.classList.add('hidden');
  }

  // Refresh policy data from backend and disk
  async function refreshPolicyView() {
    if (!window.zeroFeedAPI) return;

    try {
      const res = await window.zeroFeedAPI.policy.getPolicy();
      if (!res.success) {
        showAlert(`Failed to fetch policy: ${res.error}`, 'error');
        return;
      }

      const { policy, partner } = res.data;

      // Update Partner Info
      if (partner) {
        inputPartnerEmail.value = partner.email;
        inputPartnerName.value = partner.name || '';
        inputPartnerEmail.disabled = true;
        inputPartnerName.disabled = true;
        btnSavePartner.textContent = 'Accountability Partner Locked';
        btnSavePartner.disabled = true;
      } else {
        inputPartnerEmail.disabled = false;
        inputPartnerName.disabled = false;
        btnSavePartner.textContent = 'Register Accountability Partner';
        btnSavePartner.disabled = false;
      }

      // Update Extension ID
      if (policy.extensionId) {
        inputExtensionId.value = policy.extensionId;
      }

      // Check Linux Chrome policy on disk
      const diskStatus = await window.zeroFeedAPI.enforcer.getLinuxPolicyStatus(inputExtensionId.value);
      policyFilePathSpan.textContent = diskStatus.policyPath;

      if (diskStatus.active && policy.isEnabled) {
        policyStatusPill.textContent = 'FORCE INSTALLED (LOCKED)';
        policyStatusPill.className = 'badge badge-success';
      } else if (diskStatus.installed && !policy.isEnabled) {
        policyStatusPill.textContent = 'UNLOCKED / NORMAL';
        policyStatusPill.className = 'badge badge-warning';
      } else {
        policyStatusPill.textContent = 'NOT INSTALLED ON DISK';
        policyStatusPill.className = 'badge badge-danger';
      }

      // Get generated JSON preview
      const chromeJsonRes = await window.zeroFeedAPI.policy.getChromeJson();
      if (chromeJsonRes.success) {
        policyJsonPreview.textContent = JSON.stringify(chromeJsonRes.data, null, 2);
      }
    } catch (err) {
      showAlert(err.message, 'error');
    }
  }

  // Auth: Dev Mock Login
  btnDevLogin.addEventListener('click', async () => {
    hideAlert();
    btnDevLogin.disabled = true;
    btnDevLogin.textContent = 'Signing in...';

    const res = await window.zeroFeedAPI.auth.loginWithGoogle('dev-mock-popeye@example.com');
    btnDevLogin.disabled = false;
    btnDevLogin.textContent = '⚡ Quick Sign-In with Google (Dev Mock)';

    if (res.success) {
      localStorage.setItem('zerofeed_last_token', 'dev-mock-popeye@example.com');
      showAlert(`Signed in successfully as ${res.data.user.email}!`, 'success');
      showDashboard(res.data.user, res.data.subscription);
    } else {
      showAlert(`Sign in failed: ${res.error}. Ensure backend is running on port 4000.`, 'error');
    }
  });

  // Auth: Token Login
  btnTokenLogin.addEventListener('click', async () => {
    hideAlert();
    const token = googleIdTokenInput.value.trim();
    if (!token) {
      showAlert('Please enter a valid Google ID token.', 'error');
      return;
    }

    btnTokenLogin.disabled = true;
    const res = await window.zeroFeedAPI.auth.loginWithGoogle(token);
    btnTokenLogin.disabled = false;

    if (res.success) {
      localStorage.setItem('zerofeed_last_token', token);
      showAlert(`Signed in as ${res.data.user.email}!`, 'success');
      showDashboard(res.data.user, res.data.subscription);
    } else {
      showAlert(`Verification failed: ${res.error}`, 'error');
    }
  });

  // Logout
  btnLogout.addEventListener('click', async () => {
    localStorage.removeItem('zerofeed_last_token');
    await window.zeroFeedAPI.auth.logout();
    showAuthScreen();
    showAlert('Signed out.', 'success');
  });

  // Save Partner
  btnSavePartner.addEventListener('click', async () => {
    hideAlert();
    const email = inputPartnerEmail.value.trim();
    const name = inputPartnerName.value.trim();

    if (!email || !email.includes('@')) {
      showAlert('Please provide a valid partner email.', 'error');
      return;
    }

    const res = await window.zeroFeedAPI.policy.setPartner(email, name);
    if (res.success) {
      showAlert(`Partner ${email} registered and locked!`, 'success');
      refreshPolicyView();
    } else {
      showAlert(`Failed to register partner: ${res.error}`, 'error');
    }
  });

  // Apply Linux Policy (Force Install) - Requires Partner Verification
  btnApplyPolicy.addEventListener('click', async () => {
    hideAlert();
    const extensionId = inputExtensionId.value.trim();

    const currentDiskStatus = await window.zeroFeedAPI.enforcer.getLinuxPolicyStatus(extensionId);
    const policyRes = await window.zeroFeedAPI.policy.getPolicy().catch(() => ({}));
    const isBackendEnabled = policyRes.data?.policy?.isEnabled;
    const partner = policyRes.data?.partner;

    if (currentDiskStatus.active && isBackendEnabled) {
      showAlert(`Policy is already active and force-installed in Chrome for extension [${extensionId}].`, 'success');
      return;
    }

    if (!partner) {
      showAlert('Please register and lock an accountability partner first. Partner verification is required for locking.', 'warning');
      return;
    }

    currentAction = 'ENABLE_POLICY';
    currentActionPayload = null;

    btnApplyPolicy.disabled = true;
    const res = await window.zeroFeedAPI.policy.requestOtp('ENABLE_POLICY');
    btnApplyPolicy.disabled = false;

    if (res.success) {
      openOtpModal(res.data.message);
    } else {
      showAlert(`Cannot request lock verification: ${res.error}`, 'error');
    }
  });

  // Disable Policy (Trigger Partner OTP)
  btnDisablePolicy.addEventListener('click', async () => {
    hideAlert();
    const extensionId = inputExtensionId.value.trim();

    const currentDiskStatus = await window.zeroFeedAPI.enforcer.getLinuxPolicyStatus(extensionId);
    if (!currentDiskStatus.active) {
      showAlert('Policy is already disabled and in normal mode. No partner verification is required.', 'success');
      return;
    }

    const policyRes = await window.zeroFeedAPI.policy.getPolicy().catch(() => ({}));
    const partner = policyRes.data?.partner;

    if (!partner) {
      showAlert('Please register an accountability partner first. Partner verification is required for unlocking.', 'warning');
      return;
    }

    currentAction = 'DISABLE_POLICY';
    currentActionPayload = null;

    btnDisablePolicy.disabled = true;
    const res = await window.zeroFeedAPI.policy.requestOtp('DISABLE_POLICY');
    btnDisablePolicy.disabled = false;

    if (res.success) {
      openOtpModal(res.data.message);
    } else {
      showAlert(`Cannot request unlock verification: ${res.error}`, 'error');
    }
  });

  // Change Extension ID
  btnUpdateExtId.addEventListener('click', async () => {
    hideAlert();
    const newExtId = inputExtensionId.value.trim();
    if (newExtId.length !== 32) {
      showAlert('Chrome Extension ID must be exactly 32 characters.', 'error');
      return;
    }

    // First check if partner is locked
    const policyRes = await window.zeroFeedAPI.policy.getPolicy();
    const partner = policyRes.data?.partner;

    if (!partner) {
      // Direct update during initial onboarding
      const updateRes = await window.zeroFeedAPI.policy.setExtensionId(newExtId);
      if (updateRes.success) {
        showAlert('Extension ID updated successfully!', 'success');
        refreshPolicyView();
      } else {
        showAlert(updateRes.error, 'error');
      }
    } else {
      // Partner is locked: trigger OTP
      currentAction = 'UPDATE_EXTENSION_ID';
      currentActionPayload = { extensionId: newExtId };

      const res = await window.zeroFeedAPI.policy.requestOtp('UPDATE_EXTENSION_ID', currentActionPayload);
      if (res.success) {
        openOtpModal(res.data.message);
      } else {
        showAlert(`Partner approval required: ${res.error}`, 'error');
      }
    }
  });

  // Check Disk Status Refresh
  btnRefreshStatus.addEventListener('click', () => {
    refreshPolicyView();
  });

  // Modal Functions
  function openOtpModal(description) {
    otpModalDesc.textContent = description;
    otpCodeInput.value = '';
    otpModal.classList.remove('hidden');
    otpCodeInput.focus();
    startResendCountdown(60);
  }

  function closeModal() {
    otpModal.classList.add('hidden');
    if (resendInterval) clearInterval(resendInterval);
  }

  function startResendCountdown(seconds) {
    resendCountdown = seconds;
    btnResendOtp.disabled = true;
    resendTimerSpan.textContent = `(${resendCountdown}s)`;

    if (resendInterval) clearInterval(resendInterval);
    resendInterval = setInterval(() => {
      resendCountdown--;
      if (resendCountdown <= 0) {
        clearInterval(resendInterval);
        btnResendOtp.disabled = false;
        resendTimerSpan.textContent = '';
      } else {
        resendTimerSpan.textContent = `(${resendCountdown}s)`;
      }
    }, 1000);
  }

  btnCloseModal.addEventListener('click', closeModal);

  btnResendOtp.addEventListener('click', async () => {
    if (resendCountdown > 0) return;
    const res = await window.zeroFeedAPI.policy.requestOtp(currentAction, currentActionPayload);
    if (res.success) {
      showAlert('New verification code sent to partner!', 'success');
      startResendCountdown(60);
    } else {
      showAlert(res.error, 'error');
    }
  });

  btnSubmitOtp.addEventListener('click', async () => {
    const code = otpCodeInput.value.trim();
    if (code.length !== 6) {
      showAlert('Please enter the full 6-digit code.', 'error');
      return;
    }

    btnSubmitOtp.disabled = true;
    const verifyRes = await window.zeroFeedAPI.policy.verifyOtp(currentAction, code);
    btnSubmitOtp.disabled = false;

    if (verifyRes.success) {
      closeModal();
      showAlert(verifyRes.data.message, 'success');

      // Update disk policy to reflect verified change
      if (currentAction === 'DISABLE_POLICY') {
        await window.zeroFeedAPI.enforcer.removeLinuxPolicy(inputExtensionId.value);
      } else if (currentAction === 'ENABLE_POLICY') {
        await window.zeroFeedAPI.enforcer.applyLinuxPolicy(inputExtensionId.value);
      } else if (currentAction === 'UPDATE_EXTENSION_ID') {
        await window.zeroFeedAPI.enforcer.applyLinuxPolicy(currentActionPayload.extensionId);
      }

      refreshPolicyView();
    } else {
      showAlert(verifyRes.error, 'error');
    }
  });

  // Auto-restore session on launch if saved
  const savedToken = localStorage.getItem('zerofeed_last_token');
  if (savedToken && window.zeroFeedAPI?.auth) {
    window.zeroFeedAPI.auth.loginWithGoogle(savedToken).then((res) => {
      if (res.success) {
        showDashboard(res.data.user, res.data.subscription);
      }
    }).catch(() => {});
  }
});
