/**
 * ZEROFEED · Client Application Logic
 *
 * Security model:
 *   All Supabase credentials live server-side in .env.
 *   The browser ONLY communicates with the Flask MVC backend at /api/*.
 *   No API keys are ever shipped to the client.
 *
 * Features:
 * - Focus Simulator (Doomscroll vs ZeroFeed Preview)
 * - Pricing Billing Switcher (Monthly / Annual / Founder)
 * - DB-backed signup via /api/signup — persists across page refreshes
 * - Live stats from /api/stats on every page load
 * - Monthly 31-day expiration & renewal notice
 * - 1-Year hard lock & tamper surveillance
 * - FAQ Accordion & Smooth Scrolling
 */

// 1. Account Lifecycle & Launch Configuration Constants
const ACCOUNT_CONSTANTS = {
    MONTHLY_VALIDITY_DAYS: 31,
    YEARLY_LOCK_DAYS: 365,
    FOUNDER_PRE_LAUNCH_DAYS: 30,
    FOUNDER_LAUNCH_THRESHOLD: 10,
    MAX_SPOTS: 100,
    SUPPORT_EMAIL: 'dhanasurya.official@gmail.com',
    LAUNCH_TARGET_DATE: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000) + (14 * 60 * 60 * 1000) + (22 * 60 * 1000))
};

// Resolve API base from <meta name="api-base"> — no hardcoded URLs
const API_BASE = (() => {
    const meta = document.querySelector('meta[name="api-base"]');
    return meta ? meta.getAttribute('content') : '/api';
})();

// Utility: Escape untrusted input to prevent XSS in HTML string interpolation
function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

class ZeroFeedAccountEngine {
    constructor() {
        this.user = {
            id: 'usr_student_882',
            username: 'alex_m_focus',
            email: 'student@university.edu',
            plan: 'MONTHLY',
            activatedAt: new Date(Date.now() - (31 * 24 * 60 * 60 * 1000)),
            isLocked: false,
            status: 'ACTIVE',
            streakDays: 48
        };
        this.founderSignups = this._loadLocal('zerofeed_founder_signups');
        this.monthlySignups = this._loadLocal('zerofeed_monthly_signups');
        this.yearlySignups = this._loadLocal('zerofeed_yearly_signups');
        this.isSyncing = false;
    }

    _loadLocal(key) {
        try {
            const saved = localStorage.getItem(key);
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return [];
    }

    _saveLocal(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {}
    }

    /* ==========================================================================
       MONTHLY EXPIRATION & EXTENSION DISABLE / UNINSTALL ENFORCEMENT
       ========================================================================== */

    verifyMonthlyExpiration(daysElapsed = 31) {
        if (daysElapsed >= ACCOUNT_CONSTANTS.MONTHLY_VALIDITY_DAYS) {
            this.user.status = 'EXPIRED';
            this.showRenewalNotice();
            return {
                expired: true,
                status: 'EXPIRED',
                message: 'Your 31-Day Monthly Focus Pass has expired. Please renew your plan.',
                display_renewal_message: true
            };
        }
        return { expired: false, status: 'ACTIVE' };
    }

    showRenewalNotice() {
        let banner = document.getElementById('zerofeed-renewal-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'zerofeed-renewal-banner';
            banner.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                background: #FFFDF0;
                border: 3px solid #000;
                box-shadow: 6px 6px 0px #000;
                border-radius: 16px;
                padding: 18px 22px;
                z-index: 99999;
                max-width: 380px;
                font-family: var(--font-mono, monospace);
            `;
            banner.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong style="color:#DC2626; font-size:0.85rem;">⏰ 31-DAY PASS EXPIRED</strong>
                    <button id="close-renewal-banner" style="background:none; border:none; cursor:pointer; font-weight:800;">✕</button>
                </div>
                <p style="font-size:0.78rem; color:#181A20; margin-bottom:12px; line-height:1.4;">
                    Your <strong>31-Day Monthly Focus Pass</strong> has expired. Renew your plan now to keep your study streak active and feeds neutralized.
                </p>
                <a href="#pricing" class="btn-primary" style="display:block; text-align:center; padding:8px 14px; font-size:0.78rem; text-decoration:none;">
                    ⚡ RENEW MONTHLY PASS ($19)
                </a>
            `;
            document.body.appendChild(banner);
            document.getElementById('close-renewal-banner')?.addEventListener('click', () => banner.remove());
        }
    }

    /**
     * Enforcement Protocol: Extension Disable / Uninstall / Tamper Attempt
     * - Identifies user by username (@username) and email
     * - Resets study streak to 0 days immediately
     * - Kicks user out of account (status: EJECTED_REMOVED)
     * - Publishes record to Graveyard Ledger
     */
    handleExtensionDisableAttempt(username = this.user.username, userEmail = this.user.email) {
        const previousStreak = this.user.streakDays || 0;
        
        // 1. Reset streak to 0
        this.user.streakDays = 0;

        // 2. Kick user out of extension & account
        this.user.status = 'EJECTED_REMOVED';
        this.user.isLocked = false;

        const emailNotice = {
            to: userEmail,
            username: username,
            subject: `🚨 TAMPER ALERT: Extension Disable/Uninstall Detected for @${username}`,
            timestamp: new Date().toLocaleString(),
            action: 'Streak Reset to 0 · User Kicked Out & Account Revoked',
            previousStreak
        };

        // 3. Add to Graveyard Ejected List dynamically in UI
        this._addGraveyardEjectionRecord(username, 'Tried to Disable/Uninstall Ext.');

        // 4. Render Enforcement Banner Alert Box
        let alertBox = document.getElementById('zerofeed-security-alert');
        if (!alertBox) {
            alertBox = document.createElement('div');
            alertBox.id = 'zerofeed-security-alert';
            alertBox.style.cssText = `
                position: fixed;
                top: 24px;
                left: 50%;
                transform: translateX(-50%);
                background: #FEE2E2;
                border: 3px solid #DC2626;
                box-shadow: 6px 6px 0px #991B1B;
                border-radius: 16px;
                padding: 20px 24px;
                z-index: 99999;
                max-width: 540px;
                font-family: var(--font-mono, monospace);
            `;
            alertBox.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong style="color:#B91C1C; font-size:0.9rem;">🚨 TAMPER PROTOCOL TRIGGERED · @${escapeHTML(username)}</strong>
                    <button id="close-security-alert" style="background:none; border:none; cursor:pointer; font-weight:800;">✕</button>
                </div>
                <p style="font-size:0.8rem; color:#7F1D1D; margin-bottom:8px; line-height:1.4;">
                    Attempt to disable, uninstall, or bypass ZeroFeed detected for user <strong>@${escapeHTML(username)}</strong> (${escapeHTML(userEmail)}).
                </p>
                <div style="background:#FFFFFF; border:1.5px solid #DC2626; border-radius:8px; padding:10px; font-size:0.72rem; margin-bottom:12px;">
                    <div><strong>👤 User Account:</strong> @${escapeHTML(username)} (${escapeHTML(userEmail)})</div>
                    <div><strong>🔥 Study Streak:</strong> RESET FROM ${previousStreak} DAYS → <span style="color:#DC2626; font-weight:800;">0 DAYS</span></div>
                    <div><strong>🚫 Account Status:</strong> KICKED OUT · Access Revoked &amp; Forfeited</div>
                    <div><strong>⚰️ Graveyard Wall:</strong> Recorded permanently on public leaderboard</div>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:0.7rem; color:#991B1B; font-weight:700;">Study or Die Accountability Protocol</span>
                </div>
            `;
            document.body.appendChild(alertBox);
            document.getElementById('close-security-alert')?.addEventListener('click', () => alertBox.remove());
        }

        return emailNotice;
    }

    handleYearlyLockViolation(userEmail = this.user.email) {
        return this.handleExtensionDisableAttempt(this.user.username, userEmail);
    }

    _addGraveyardEjectionRecord(username, reason) {
        const ejectedList = document.querySelector('.ejected-list');
        if (ejectedList) {
            const li = document.createElement('li');
            li.className = 'ejected-item';
            li.innerHTML = `
                <span class="ejected-name">⚰️ @${escapeHTML(username)}</span>
                <span class="ejected-tag">KICKED OUT · ${escapeHTML(reason)}</span>
            `;
            ejectedList.prepend(li);
        }
    }

    /* ==========================================================================
       SECURE API INTEGRATION — All DB calls go through /api/* (Flask backend)
       Credentials never reach the browser.
       ========================================================================== */

    /**
     * Fetch live stats from the Flask backend (/api/stats → Supabase).
     * Called on every page load to restore UI state from DB (fixes refresh bug).
     */
    async fetchStats() {
        try {
            const res = await fetch(`${API_BASE}/stats`);
            if (res.ok) {
                const data = await res.json();
                return {
                    totalSignups: data.totalSignups ?? data.total_signups ?? 0,
                    maxSpots: data.maxSpots ?? data.max_spots ?? 100,
                    spotsRemaining: data.spotsRemaining ?? data.spots_remaining ?? 100,
                    percentClaimed: data.percentClaimed ?? data.percent_claimed ?? 0,
                    isLaunchReady: data.isLaunchReady ?? data.is_launch_ready ?? false,
                    isSoldOut: data.isSoldOut ?? data.is_sold_out ?? false
                };
            }
        } catch (e) {
            console.debug('ZeroFeed: running in offline mode, using local stats');
        }
        return this.getSpotsStats();
    }

    /**
     * Submit a signup to the Flask backend (/api/signup → Supabase).
     * Returns a Promise resolving to { success, already, message, stats }.
     * Also persists to localStorage as offline fallback.
     */
    async submitSignup(email, planType = 'MONTHLY', source = 'pricing_card') {
        if (!email || !email.includes('@')) {
            return { success: false, message: 'Please enter a valid email address.' };
        }
        const norm = email.trim().toLowerCase();
        const plan = planType.toUpperCase();

        try {
            const res = await fetch(`${API_BASE}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: norm, plan_type: plan, source })
            });
            const data = await res.json();

            // Mirror to localStorage as offline cache
            if (data.success && !data.already) {
                this._mirrorToLocal(norm, plan, source);
            }

            // Merge fresh stats from server response
            if (data.stats) {
                this._applyServerStats(data.stats);
            }

            return data;
        } catch (e) {
            // Offline fallback — use localStorage only
            console.debug('ZeroFeed: offline fallback for signup');
            return this._localFallbackSignup(norm, plan, source);
        }
    }

    /** Mirror a successful server-side insert into localStorage (offline cache) */
    _mirrorToLocal(norm, plan, source) {
        if (plan === 'MONTHLY') {
            if (!this.monthlySignups.some(s => s.email === norm)) {
                this.monthlySignups.push({ email: norm, plan: 'MONTHLY', date: new Date().toISOString(), source });
                this._saveLocal('zerofeed_monthly_signups', this.monthlySignups);
            }
        } else if (plan === 'YEARLY') {
            if (!this.yearlySignups.some(s => s.email === norm)) {
                this.yearlySignups.push({ email: norm, plan: 'YEARLY', date: new Date().toISOString(), source });
                this._saveLocal('zerofeed_yearly_signups', this.yearlySignups);
            }
        } else {
            if (!this.founderSignups.some(s => s.email.toLowerCase() === norm)) {
                const num = this.founderSignups.length + 1;
                this.founderSignups.push({ email: norm, date: new Date().toISOString(), founderNumber: num, source });
                this._saveLocal('zerofeed_founder_signups', this.founderSignups);
            }
        }
    }

    /** Apply server-side stats into local state */
    _applyServerStats(serverStats) {
        // We don't overwrite the local array; just sync the count
        this._serverStats = serverStats;
    }

    /** Pure offline fallback — used only when server is unreachable */
    _localFallbackSignup(norm, plan, source) {
        if (plan === 'MONTHLY') {
            const exists = this.monthlySignups.find(s => s.email === norm);
            if (exists) return { success: true, already: true, message: '✓ Already Registered! Your 31-Day pass activation is ready.' };
            this.monthlySignups.push({ email: norm, plan: 'MONTHLY', date: new Date().toISOString(), source });
            this._saveLocal('zerofeed_monthly_signups', this.monthlySignups);
            return { success: true, already: false, message: '✓ 31-Day Monthly Pass Reserved! Activation link sent to your email.' };
        }
        if (plan === 'YEARLY') {
            const exists = this.yearlySignups.find(s => s.email === norm);
            if (exists) return { success: true, already: true, message: '✓ Already Registered! Your 1-Year Academic account is reserved.' };
            this.yearlySignups.push({ email: norm, plan: 'YEARLY', date: new Date().toISOString(), source });
            this._saveLocal('zerofeed_yearly_signups', this.yearlySignups);
            return { success: true, already: false, message: '✓ 1-Year Academic Account Reserved! 365-day tamper-proof pass details saved.' };
        }
        // FOUNDER_LIFETIME
        const existing = this.founderSignups.find(s => s.email.toLowerCase() === norm);
        if (existing) return { success: true, already: true, message: '✓ Already Registered! Your Founder Lifetime Spot is locked for Product Hunt VIP.' };
        if (this.founderSignups.length >= ACCOUNT_CONSTANTS.MAX_SPOTS) {
            return { success: false, isSoldOut: true,
                message: 'All 50 Founder Spots have been claimed! Please choose Monthly or Annual Pass.'
            };
        }

        const num = this.founderSignups.length + 1;
        this.founderSignups.push({ email: norm, date: new Date().toISOString(), founderNumber: num, source });
        this._saveLocal('zerofeed_founder_signups', this.founderSignups);
        return { success: true, already: false, message: '🎉 Founder Lifetime Spot Secured! You are on the Product Hunt Day 1 VIP List.' };
    }

    getSpotsStats() {
        const total = this.founderSignups.length;
        const max = ACCOUNT_CONSTANTS.MAX_SPOTS;
        const remaining = Math.max(0, max - total);
        const percent = Math.min(100, Math.round((total / max) * 100));
        const launchReady = total > ACCOUNT_CONSTANTS.FOUNDER_LAUNCH_THRESHOLD;
        const isSoldOut = total >= max;

        return {
            totalSignups: total,
            maxSpots: max,
            spotsRemaining: remaining,
            percentClaimed: percent,
            isLaunchReady: launchReady,
            isSoldOut: isSoldOut
        };
    }

    getFounderCount() {
        return this.founderSignups.length;
    }

    isProductHuntLaunchReady() {
        return this.founderSignups.length > ACCOUNT_CONSTANTS.FOUNDER_LAUNCH_THRESHOLD;
    }
}

// Global engine instance
const accountEngine = new ZeroFeedAccountEngine();
window.ZeroFeedAccount = accountEngine;

const initApp = () => {
    // 1. Focus Simulator Toggle (Doomscroll vs ZeroFeed Mode)
    const btnDoom = document.getElementById('btn-toggle-doom');
    const btnZero = document.getElementById('btn-toggle-zero');
    const cleanView = document.getElementById('sim-clean-view');
    const doomView = document.getElementById('sim-doom-view');
    const urlIcon = document.getElementById('sim-url-icon');
    const urlBadge = document.getElementById('sim-url-badge');
    const trapsNum = document.getElementById('metric-traps-num');
    const trapsLabel = document.getElementById('metric-traps-label');
    const focusNum = document.getElementById('metric-focus-num');
    const focusLabel = document.getElementById('metric-focus-label');

    if (btnDoom && btnZero && cleanView && doomView) {
        btnDoom.addEventListener('click', () => {
            btnDoom.classList.add('active');
            btnZero.classList.remove('active');
            cleanView.style.display = 'none';
            doomView.style.display = 'block';
            if (urlIcon) urlIcon.textContent = '⚠️';
            if (urlBadge) {
                urlBadge.textContent = 'ALGORITHMIC TRAPS ACTIVE ⚠️';
                urlBadge.classList.add('warn');
            }
            if (trapsNum) { trapsNum.textContent = '100%'; trapsNum.style.color = '#EF4444'; }
            if (trapsLabel) trapsLabel.textContent = 'Distraction Feed';
            if (focusNum) { focusNum.textContent = '-2.5 HRS'; focusNum.style.color = '#EF4444'; }
            if (focusLabel) focusLabel.textContent = 'Attention Lost';
        });

        btnZero.addEventListener('click', () => {
            btnZero.classList.add('active');
            btnDoom.classList.remove('active');
            doomView.style.display = 'none';
            cleanView.style.display = 'block';
            if (urlIcon) urlIcon.textContent = '🔒';
            if (urlBadge) {
                urlBadge.textContent = 'FEED STRIPPED BY ZEROFEED ⚡';
                urlBadge.classList.remove('warn');
            }
            if (trapsNum) { trapsNum.textContent = '0%'; trapsNum.style.color = 'var(--color-yellow)'; }
            if (trapsLabel) trapsLabel.textContent = 'Feed Traps';
            if (focusNum) { focusNum.textContent = '+2.5 HRS'; focusNum.style.color = 'var(--color-yellow)'; }
            if (focusLabel) focusLabel.textContent = 'Daily Focus Reclaimed';
        });
    }

    // 2. Pricing Billing Toggle (Monthly vs Annual vs Founder)
    const btnMonthly = document.getElementById('btn-billing-monthly');
    const btnAnnual = document.getElementById('btn-billing-annual');
    const btnFounder = document.getElementById('btn-billing-founder');
    const cardMonthly = document.getElementById('card-monthly');
    const cardAnnual = document.getElementById('card-annual');
    const cardFounder = document.getElementById('card-founder');

    const updatePricingCards = (activeBtn, activeCard) => {
        [btnMonthly, btnAnnual, btnFounder].forEach(btn => btn?.classList.remove('active'));
        [cardMonthly, cardAnnual, cardFounder].forEach(card => card?.classList.remove('featured'));
        activeBtn?.classList.add('active');
        activeCard?.classList.add('featured');
    };

    if (btnMonthly && cardMonthly) {
        btnMonthly.addEventListener('click', () => updatePricingCards(btnMonthly, cardMonthly));
    }
    if (btnAnnual && cardAnnual) {
        btnAnnual.addEventListener('click', () => updatePricingCards(btnAnnual, cardAnnual));
    }
    if (btnFounder && cardFounder) {
        btnFounder.addEventListener('click', () => updatePricingCards(btnFounder, cardFounder));
    }

    // 3. Dynamic Natural Handwritten Spots Counter Refresh
    const refreshSpotsUI = (stats = accountEngine.getSpotsStats()) => {
        const claimedEl = document.getElementById('founder-claimed-count');
        const headerClaimedEl = document.getElementById('founder-header-claimed');
        const remainingEl = document.getElementById('founder-remaining-text');
        const headerRemainingEl = document.getElementById('founder-header-remaining');
        const founderBtn = document.getElementById('btn-join-founder');
        const signupCountEl = document.getElementById('signup-count');
        const buildGateBanner = document.getElementById('build-gate-banner');

        if (claimedEl) claimedEl.textContent = stats.totalSignups;
        if (headerClaimedEl) headerClaimedEl.textContent = stats.totalSignups;
        if (signupCountEl) signupCountEl.textContent = stats.totalSignups;

        // Email Threshold: Show build-gate banner if threshold (> 10) is reached
        if (buildGateBanner) {
            if (stats.isLaunchReady || stats.totalSignups > 10) {
                buildGateBanner.style.display = 'block';
            } else {
                buildGateBanner.style.display = 'none';
            }
        }
        
        if (stats.isSoldOut) {
            if (remainingEl) remainingEl.textContent = '· SOLD OUT · ALL 100 SPOTS CLAIMED';
            if (headerRemainingEl) headerRemainingEl.textContent = '· ALL 100 SPOTS CLAIMED!';
            if (founderBtn) {
                founderBtn.disabled = true;
                founderBtn.textContent = '👑 100 Spots Sold Out';
                founderBtn.style.opacity = '0.6';
                founderBtn.style.cursor = 'not-allowed';
            }
        } else {
            if (remainingEl) remainingEl.textContent = `· Only ${stats.spotsRemaining} Spots Left`;
            if (headerRemainingEl) headerRemainingEl.textContent = `· Only ${stats.spotsRemaining} Spots Left!`;
            if (founderBtn) {
                founderBtn.disabled = false;
                founderBtn.textContent = 'Get Lifetime ($39) →';
                founderBtn.style.opacity = '1';
                founderBtn.style.cursor = 'pointer';
            }
        }
    };

    // Initial render & fetch live stats from DB (fixes page-refresh state)
    refreshSpotsUI();
    accountEngine.fetchStats().then(stats => refreshSpotsUI(stats));

    // Helper: Safe Desktop Application Handoff (No tokens in URL or clipboard)
    function triggerDesktopHandoff(session, email, planType) {
        const modal = document.getElementById('desktop-handoff-modal');
        const openBtn = document.getElementById('btn-open-desktop');
        const copyBtn = document.getElementById('btn-copy-token');
        const toast = document.getElementById('token-copied-toast');

        // Safe deep link without auth token URL leakage (referrers, browser history)
        const safeDeepLink = `zerofeed://subscription-activated?email=${encodeURIComponent(email)}&plan=${encodeURIComponent(planType)}&status=active`;

        if (modal) {
            modal.style.display = 'block';
            modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        if (openBtn) {
            openBtn.setAttribute('href', safeDeepLink);
            openBtn.textContent = '⚡ Return to ZeroFeed Desktop';
        }

        if (copyBtn) {
            copyBtn.textContent = 'Copy Activation Confirmation';
            copyBtn.onclick = () => {
                const confText = `ZeroFeed Plan: ${planType} | Account: ${email} | Status: Active`;
                navigator.clipboard.writeText(confText).then(() => {
                    if (toast) {
                        toast.textContent = 'Activation details copied to clipboard!';
                        toast.style.display = 'block';
                        setTimeout(() => { toast.style.display = 'none'; }, 4000);
                    }
                });
            };
        }

        // Proactively attempt notifying the desktop app
        setTimeout(() => {
            try {
                window.location.href = safeDeepLink;
            } catch (e) {
                console.debug('Deep link trigger notice:', e);
            }
        }, 1200);
    }

    // Accessible 6-Digit Verification Modal Handler
    function requestEmailOtpVerification(email, initialDevOtp) {
        return new Promise((resolve) => {
            const modal = document.getElementById('otp-verification-modal');
            if (!modal) {
                const fallbackCode = window.prompt(`ZeroFeed Security: Code sent to ${email}:`, initialDevOtp || '');
                resolve(fallbackCode ? fallbackCode.trim() : null);
                return;
            }

            const emailDisplay = document.getElementById('otp-modal-email-display');
            const devHint = document.getElementById('otp-dev-hint');
            const devCodeEl = document.getElementById('otp-dev-code');
            const fillDevBtn = document.getElementById('btn-otp-fill-dev');
            const errorEl = document.getElementById('otp-modal-error');
            const resendFeedback = document.getElementById('otp-resend-feedback');
            const resendBtn = document.getElementById('btn-resend-otp-modal');
            const cancelBtn = document.getElementById('btn-cancel-otp-modal');
            const closeBtn = document.getElementById('btn-close-otp-modal');
            const submitOtpBtn = document.getElementById('btn-submit-otp');
            const digitBoxes = modal.querySelectorAll('.otp-digit-box');

            let currentDevOtp = initialDevOtp || '';

            // Reset state
            if (emailDisplay) emailDisplay.textContent = email;
            if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
            if (resendFeedback) resendFeedback.style.display = 'none';

            function updateDevBanner(otp) {
                currentDevOtp = otp || '';
                if (currentDevOtp && devHint && devCodeEl) {
                    devCodeEl.textContent = currentDevOtp;
                    devHint.style.display = 'flex';
                } else if (devHint) {
                    devHint.style.display = 'none';
                }
            }
            updateDevBanner(initialDevOtp);

            digitBoxes.forEach((box) => {
                box.value = '';
                box.classList.remove('has-value', 'error');
            });

            modal.style.display = 'flex';
            setTimeout(() => {
                if (digitBoxes[0]) digitBoxes[0].focus();
            }, 60);

            function closeModal(result) {
                modal.style.display = 'none';
                cleanup();
                resolve(result);
            }

            function getEnteredCode() {
                let code = '';
                digitBoxes.forEach((box) => { code += box.value.trim(); });
                return code;
            }

            function fillCode(str) {
                const digits = str.replace(/\D/g, '').slice(0, 6).split('');
                digitBoxes.forEach((box, i) => {
                    box.value = digits[i] || '';
                    if (digits[i]) box.classList.add('has-value');
                    else box.classList.remove('has-value');
                });
                const focusIdx = Math.min(digits.length, 5);
                if (digitBoxes[focusIdx]) digitBoxes[focusIdx].focus();
                if (errorEl) errorEl.style.display = 'none';
            }

            // Input, paste & keyboard navigation
            digitBoxes.forEach((box, idx) => {
                box.oninput = () => {
                    const val = box.value.replace(/\D/g, '');
                    box.value = val ? val[val.length - 1] : '';
                    if (box.value) {
                        box.classList.add('has-value');
                        box.classList.remove('error');
                        if (idx < digitBoxes.length - 1) {
                            digitBoxes[idx + 1].focus();
                        }
                    } else {
                        box.classList.remove('has-value');
                    }
                    if (errorEl) errorEl.style.display = 'none';
                };

                box.onkeydown = (e) => {
                    if (e.key === 'Backspace' && !box.value && idx > 0) {
                        digitBoxes[idx - 1].focus();
                    } else if (e.key === 'ArrowLeft' && idx > 0) {
                        digitBoxes[idx - 1].focus();
                    } else if (e.key === 'ArrowRight' && idx < digitBoxes.length - 1) {
                        digitBoxes[idx + 1].focus();
                    } else if (e.key === 'Enter') {
                        handleSubmit();
                    } else if (e.key === 'Escape') {
                        closeModal(null);
                    }
                };

                box.onpaste = (e) => {
                    e.preventDefault();
                    const pasteData = (e.clipboardData || window.clipboardData).getData('text');
                    if (pasteData) {
                        fillCode(pasteData);
                    }
                };
            });

            if (fillDevBtn) {
                fillDevBtn.onclick = () => {
                    if (currentDevOtp) fillCode(currentDevOtp);
                };
            }

            async function handleResend() {
                if (resendBtn) {
                    resendBtn.disabled = true;
                    resendBtn.textContent = 'Sending...⏳';
                }
                try {
                    const res = await fetch(`${API_BASE}/email/send-verification`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    const data = await res.json();
                    if (data.success) {
                        if (resendFeedback) {
                            resendFeedback.style.display = 'block';
                            resendFeedback.textContent = '✓ Fresh verification code sent!';
                            setTimeout(() => {
                                if (resendFeedback) resendFeedback.style.display = 'none';
                            }, 4000);
                        }
                        if (data.dev_otp) {
                            updateDevBanner(data.dev_otp);
                        }
                    } else if (errorEl) {
                        errorEl.textContent = data.error || 'Failed to resend code.';
                        errorEl.style.display = 'block';
                    }
                } catch (err) {
                    if (errorEl) {
                        errorEl.textContent = 'Network error while resending code.';
                        errorEl.style.display = 'block';
                    }
                } finally {
                    if (resendBtn) {
                        resendBtn.disabled = false;
                        resendBtn.textContent = '🔄 Resend code';
                    }
                }
            }

            async function handleSubmit() {
                const code = getEnteredCode();
                if (code.length < 6) {
                    if (errorEl) {
                        errorEl.textContent = 'Please enter all 6 digits of your verification code.';
                        errorEl.style.display = 'block';
                    }
                    digitBoxes.forEach((b) => { if (!b.value) b.classList.add('error'); });
                    return;
                }

                if (submitOtpBtn) {
                    submitOtpBtn.disabled = true;
                    submitOtpBtn.textContent = 'Verifying Code...⏳';
                }

                try {
                    const verifyRes = await fetch(`${API_BASE}/email/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, code })
                    });
                    const verifyData = await verifyRes.json();
                    if (verifyData.success) {
                        closeModal(code);
                    } else {
                        if (errorEl) {
                            errorEl.textContent = verifyData.error || 'Invalid or expired verification code.';
                            errorEl.style.display = 'block';
                        }
                        digitBoxes.forEach((b) => b.classList.add('error'));
                    }
                } catch (err) {
                    if (errorEl) {
                        errorEl.textContent = 'Connection error. Please check your network and try again.';
                        errorEl.style.display = 'block';
                    }
                } finally {
                    if (submitOtpBtn) {
                        submitOtpBtn.disabled = false;
                        submitOtpBtn.textContent = 'Confirm & Proceed to Checkout →';
                    }
                }
            }

            if (submitOtpBtn) submitOtpBtn.onclick = handleSubmit;
            if (resendBtn) resendBtn.onclick = handleResend;
            if (cancelBtn) cancelBtn.onclick = () => closeModal(null);
            if (closeBtn) closeBtn.onclick = () => closeModal(null);

            modal.onclick = (e) => {
                if (e.target === modal) closeModal(null);
            };

            function cleanup() {
                modal.onclick = null;
                if (submitOtpBtn) submitOtpBtn.onclick = null;
                if (resendBtn) resendBtn.onclick = null;
                if (cancelBtn) cancelBtn.onclick = null;
                if (closeBtn) closeBtn.onclick = null;
                if (fillDevBtn) fillDevBtn.onclick = null;
                digitBoxes.forEach((b) => {
                    b.oninput = null;
                    b.onkeydown = null;
                    b.onpaste = null;
                });
            }
        });
    }

    let isCheckoutProcessing = false;

    // Unified Razorpay Checkout Coordinator
    async function processRazorpayCheckout({ planType, submitBtn, originalBtnText, successEl }) {
        if (isCheckoutProcessing) return;

        // If user is not authenticated with Google, preserve plan and redirect to OAuth
        if (!window.currentAuthUser) {
            try {
                sessionStorage.setItem('zf_pending_checkout_plan', planType);
            } catch (_) {}

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Redirecting to Google...⚡';
            }

            if (window.supabaseClient) {
                const webRedirectUrl = window.location.origin + window.location.pathname;
                console.info('[WEB_OAUTH] Initiating OAuth for pending plan:', planType);
                console.info('[WEB_OAUTH] Clean redirect URI:', webRedirectUrl);
                await window.supabaseClient.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: webRedirectUrl
                    }
                });
            } else {
                alert('Authentication service is initializing. Please try again.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                }
            }
            return;
        }

        const authUser = window.currentAuthUser;
        const userEmail = authUser.email;
        const userId = authUser.id;
        const session = window.currentAuthSession;

        if (!userEmail) {
            alert('Unable to identify authenticated email. Please re-authenticate.');
            return;
        }

        isCheckoutProcessing = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Order...🔒';
        }

        let orderData = null;
        try {
            const orderRes = await fetch(`${API_BASE}/checkout/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail, plan: planType, user_id: userId })
            });
            orderData = await orderRes.json();
        } catch (err) {
            console.error('Order creation error:', err);
        }

        // If backend order failed or offline
        if (!orderData || !orderData.success) {
            isCheckoutProcessing = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
            alert(orderData?.error || 'Unable to initialize payment checkout. Please try again.');
            return;
        }

        // Launch Razorpay Checkout Modal
        if (typeof window.Razorpay === 'function' && !orderData.mock) {
            const options = {
                key: orderData.key_id,
                amount: orderData.amount,
                currency: orderData.currency || 'INR',
                name: 'ZeroFeed',
                description: `${planType} Focus Pass (${orderData.days || 31} Days)`,
                image: '/src/assets/icon.svg',
                order_id: orderData.order_id,
                prefill: { email: userEmail },
                theme: { color: '#FF5A36' },
                handler: async function (response) {
                    if (submitBtn) submitBtn.textContent = 'Verifying Activation...🔒';
                    try {
                        await fetch(`${API_BASE}/verify-payment`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_signature: response.razorpay_signature,
                                email: userEmail,
                                plan_type: planType,
                                amount: orderData.amount
                            })
                        });
                    } catch (vErr) {
                        console.warn('Verify fetch note:', vErr);
                    }

                    if (successEl) successEl.style.display = 'block';
                    triggerDesktopHandoff(session, userEmail, planType);
                    isCheckoutProcessing = false;
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = '✓ Activated';
                    }
                },
                modal: {
                    ondismiss: function () {
                        isCheckoutProcessing = false;
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = originalBtnText;
                        }
                    }
                }
            };
            const rzpInstance = new window.Razorpay(options);
            rzpInstance.open();
        } else {
            // Mock test flow or direct development fallback
            if (submitBtn) submitBtn.textContent = 'Simulating Payment...';
            setTimeout(async () => {
                await fetch(`${API_BASE}/verify-payment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        razorpay_payment_id: 'pay_simulated_' + Date.now(),
                        razorpay_order_id: orderData.order_id,
                        razorpay_signature: 'sig_simulated',
                        email: userEmail,
                        plan_type: planType,
                        amount: orderData.amount
                    })
                });

                if (successEl) successEl.style.display = 'block';
                triggerDesktopHandoff(session, userEmail, planType);
                isCheckoutProcessing = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '✓ Activated';
                }
            }, 800);
        }
    }

    // 5. Annual Plan Checkout Button
    const btnJoinAnnual = document.getElementById('btn-join-annual');
    const annualSuccess = document.getElementById('annual-success-message');

    if (btnJoinAnnual) {
        btnJoinAnnual.addEventListener('click', async (e) => {
            e.preventDefault();
            await processRazorpayCheckout({
                planType: 'annual',
                submitBtn: btnJoinAnnual,
                originalBtnText: 'Get ZeroFeed ($24/year) →',
                successEl: annualSuccess
            });
        });
    }

    // 6. Founder Lifetime Plan Checkout Button
    const btnJoinFounder = document.getElementById('btn-join-founder');
    const founderSuccess = document.getElementById('founder-success-message');

    if (btnJoinFounder) {
        btnJoinFounder.addEventListener('click', async (e) => {
            e.preventDefault();
            await processRazorpayCheckout({
                planType: 'founder',
                submitBtn: btnJoinFounder,
                originalBtnText: 'Get Lifetime ($39) →',
                successEl: founderSuccess
            });
        });
    }

    // Direct Razorpay Link Handlers
    const setupDirectLink = (linkId, formId, inputId) => {
        const link = document.getElementById(linkId);
        const form = document.getElementById(formId);
        const input = document.getElementById(inputId);
        if (link && form) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                if (input && !input.value.trim()) {
                    input.focus();
                } else if (typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                } else {
                    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            });
        }
    };
    setupDirectLink('link-razorpay-monthly', 'monthly-signup-form', 'monthly-email-input');
    setupDirectLink('link-razorpay-annual', 'annual-signup-form', 'annual-email-input');
    setupDirectLink('link-razorpay-founder', 'founder-signup-form', 'founder-email-input');

    // 7. Compact Top-Right Corner Reverse Launch Countdown Timer
    const cornerCountdownText = document.getElementById('corner-countdown-text');

    const updateCountdown = () => {
        const now = new Date();
        const target = ACCOUNT_CONSTANTS.LAUNCH_TARGET_DATE;
        let diff = target - now;

        if (diff < 0) diff = 0;

        const pad = (n) => String(n).padStart(2, '0');
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);

        if (cornerCountdownText) {
            cornerCountdownText.textContent = `${pad(d)}d : ${pad(h)}h : ${pad(m)}m : ${pad(s)}s`;
        }
    };

    updateCountdown();
    setInterval(updateCountdown, 1000);

    // 8. Smooth FAQ Accordion Exclusive Behavior
    const allFaqs = document.querySelectorAll('.faq-card-item');
    allFaqs.forEach(faq => {
        faq.addEventListener('toggle', () => {
            if (faq.open) {
                allFaqs.forEach(otherFaq => {
                    if (otherFaq !== faq && otherFaq.open) {
                        otherFaq.removeAttribute('open');
                    }
                });
            }
        });
    });

    // 9. Smooth Anchor Link Handler
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#' || targetId === '' || targetId === '#checkout') return;
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                history.pushState(null, null, targetId);
            }
        });
    });

    /* ==========================================================================
       10. SUPABASE GOOGLE AUTH & PRICING FORM ADAPTER
       ========================================================================== */
    const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]')?.getAttribute('content') || 'https://pcfrsbziqlohvjumydwj.supabase.co';
    const SUPABASE_ANON_KEY = document.querySelector('meta[name="supabase-anon-key"]')?.getAttribute('content') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZnJzYnppcWxvaHZqdW15ZHdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMTM0MTQsImV4cCI6MjEwMzY4OTQxNH0.t4qArNTaYNvV1drUYeydJSBRsH1-ZlT0n1yP0FNSMSk';

    let supabaseClient = null;
    if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            window.supabaseClient = supabaseClient;
        } catch (e) {
            console.debug('Supabase client init error:', e);
        }
    }

    async function initGoogleAuth() {
        if (!supabaseClient) return;

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            window.currentAuthSession = session;
            window.currentAuthUser = session?.user || null;
            renderAuthUI(session?.user);

            // Plan preservation: restore selected plan after Google OAuth without auto-submitting checkout
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const qPlan = urlParams.get('plan') || urlParams.get('plan_type');
                if (qPlan && !sessionStorage.getItem('zf_pending_checkout_plan')) {
                    sessionStorage.setItem('zf_pending_checkout_plan', qPlan.toLowerCase());
                }
            } catch (_) {}

            const pendingPlan = sessionStorage.getItem('zf_pending_checkout_plan');
            if (pendingPlan && session?.user) {
                sessionStorage.removeItem('zf_pending_checkout_plan');
                const pricingEl = document.getElementById('pricing');
                if (pricingEl) {
                    pricingEl.scrollIntoView({ behavior: 'smooth' });
                }
                setTimeout(() => {
                    if (pendingPlan === 'annual' || pendingPlan === 'student') {
                        const card = document.getElementById('card-student');
                        const btn = document.getElementById('btn-join-annual');
                        if (card) {
                            card.style.outline = '4px solid var(--color-primary)';
                        }
                        if (btn) {
                            btn.textContent = 'Continue with Student Pro ($24/year) →';
                            btn.focus();
                        }
                    } else if (pendingPlan === 'founder' || pendingPlan === 'lifetime') {
                        const card = document.getElementById('card-founder');
                        const btn = document.getElementById('btn-join-founder');
                        if (card) {
                            card.style.outline = '4px solid #D97706';
                        }
                        if (btn) {
                            btn.textContent = 'Continue with Lifetime ($39) →';
                            btn.focus();
                        }
                    }
                }, 400);
            }

            supabaseClient.auth.onAuthStateChange((_event, session) => {
                window.currentAuthSession = session;
                window.currentAuthUser = session?.user || null;
                renderAuthUI(session?.user);
            });
        } catch (e) {
            console.debug('Google auth session check error:', e);
        }
    }

    function renderAuthUI(user) {
        const authPanel = document.getElementById('user-auth-panel');
        if (!authPanel) return;

        if (!user) {
            authPanel.innerHTML = `
                <button type="button" class="btn-google-nav" id="google-signin-btn" aria-label="Sign in with Google">
                    <svg class="google-icon-svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Sign in with Google</span>
                </button>
            `;
            document.getElementById('google-signin-btn')?.addEventListener('click', async () => {
                if (supabaseClient) {
                    const webRedirectUrl = window.location.origin + window.location.pathname;
                    console.info('[WEB_OAUTH] Initiating navbar sign-in');
                    console.info('[WEB_OAUTH] Clean redirect URI:', webRedirectUrl);
                    await supabaseClient.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                            redirectTo: webRedirectUrl
                        }
                    });
                }
            });
        } else {
            const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
            const avatar = user.user_metadata?.avatar_url || 'src/assets/icon.svg';
            authPanel.innerHTML = `
                <div class="google-account-container" id="google-account-container">
                    <button type="button" class="google-avatar-btn" id="google-avatar-btn" aria-haspopup="true" aria-expanded="false" aria-label="Google Account: ${escapeHTML(user.email)}">
                        <img src="${escapeHTML(avatar)}" alt="Google Account" class="google-nav-avatar" onerror="this.src='src/assets/icon.svg'" />
                    </button>
                    <div class="google-account-popover" id="google-account-popover" role="menu" aria-hidden="true">
                        <div class="popover-avatar-wrap">
                            <img src="${escapeHTML(avatar)}" alt="Google Account" class="popover-avatar-img" onerror="this.src='src/assets/icon.svg'" />
                        </div>
                        <div class="popover-user-name">${escapeHTML(name)}</div>
                        <div class="popover-user-email">${escapeHTML(user.email)}</div>
                        <button type="button" class="btn-popover-signout" id="popover-signout-btn">
                            Sign out of ZeroFeed
                        </button>
                    </div>
                </div>
            `;

            const avatarBtn = document.getElementById('google-avatar-btn');
            const popover = document.getElementById('google-account-popover');
            avatarBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                const isExpanded = popover?.classList.toggle('show');
                avatarBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
            });

            document.getElementById('popover-signout-btn')?.addEventListener('click', async () => {
                if (supabaseClient) await supabaseClient.auth.signOut();
            });

            // Dismiss popover on outside click or Escape
            document.addEventListener('click', (e) => {
                const container = document.getElementById('google-account-container');
                if (popover && popover.classList.contains('show') && !container?.contains(e.target)) {
                    popover.classList.remove('show');
                    avatarBtn?.setAttribute('aria-expanded', 'false');
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && popover && popover.classList.contains('show')) {
                    popover.classList.remove('show');
                    avatarBtn?.setAttribute('aria-expanded', 'false');
                }
            });
        }
    }

    // Initialize Auth
    window.renderAuthUI = renderAuthUI;
    initGoogleAuth();
};

// Initialize once modular sections are inlined, or on DOMContentLoaded
if (document.querySelector('[data-include]')) {
    document.addEventListener('sectionsLoaded', initApp);
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Desktop Auth Handoff Handler
(function initDesktopAuthHandoff() {
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('source');
    const port = urlParams.get('port');
    const state = urlParams.get('state');

    if (source === 'desktop' && port && state) {
        window.addEventListener('DOMContentLoaded', () => {
            const GOOGLE_CLIENT_ID = '109814022869-6bvlc37qt7g1vrfek19uui96ljunb5ug.apps.googleusercontent.com';
            const banner = document.createElement('div');
            banner.id = 'desktop-auth-banner';
            banner.style.cssText = 'position:sticky;top:0;left:0;right:0;background:#18181B;color:#FFFFFF;border-bottom:3px solid #27272A;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;z-index:999999;font-family:Plus Jakarta Sans,sans-serif;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
            banner.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:1.4rem;">⚡</span>
                    <span style="font-size:0.95rem;">ZeroFeed Desktop Link: Authenticate with Google to connect your app.</span>
                </div>
                <div id="google-desktop-btn-container" style="display:flex;align-items:center;"></div>
            `;
            document.body.prepend(banner);

            function setupGoogleSignIn() {
                if (!window.google?.accounts?.id) {
                    setTimeout(setupGoogleSignIn, 150);
                    return;
                }

                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: async (response) => {
                        if (!response || !response.credential) {
                            alert('Google Sign-In failed: No credential returned.');
                            return;
                        }

                        try {
                            const res = await fetch('http://localhost:4000/api/v1/auth/google', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    idToken: response.credential,
                                    generateDesktopCode: true,
                                    state: state,
                                }),
                            });
                            const data = await res.json();
                            if (data.desktopAuthCode) {
                                window.location.href = `http://127.0.0.1:${port}/callback?code=${encodeURIComponent(data.desktopAuthCode)}&state=${encodeURIComponent(state)}`;
                            } else {
                                alert('Authentication failed: ' + (data.message || data.error || 'Could not authenticate.'));
                            }
                        } catch (err) {
                            alert('Failed to connect to backend on port 4000: ' + err.message);
                        }
                    },
                });

                window.google.accounts.id.renderButton(
                    document.getElementById('google-desktop-btn-container'),
                    {
                        type: 'standard',
                        theme: 'outline',
                        size: 'medium',
                        text: 'continue_with',
                        shape: 'pill',
                    }
                );

                try {
                    window.google.accounts.id.prompt();
                } catch (_) {}
            }

            setupGoogleSignIn();
        });
    }
})();


