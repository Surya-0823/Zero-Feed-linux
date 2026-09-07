const BACKEND_URL = 'http://localhost:4000';

async function checkBackendHealth() {
  const dot = document.getElementById('backendDot');
  const label = document.getElementById('backendStatus');

  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    if (res.ok) {
      const data = await res.json();
      dot.classList.add('online');
      label.textContent = `Backend Online (Latency: ${data.services?.database?.latencyMs ?? 0}ms)`;
    } else {
      dot.classList.remove('online');
      label.textContent = 'Backend Error';
    }
  } catch (err) {
    dot.classList.remove('online');
    label.textContent = 'Backend Offline';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkBackendHealth();
  setInterval(checkBackendHealth, 10000);

  const form = document.getElementById('setupForm');
  const resultDiv = document.getElementById('formResult');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const selectedFeeds = formData.getAll('feeds');

    const payload = {
      tenantEmail: formData.get('tenantEmail'),
      partnerEmail: formData.get('partnerEmail'),
      partnerName: formData.get('partnerName'),
      blockedFeeds: selectedFeeds,
      savedAt: new Date().toISOString()
    };

    resultDiv.className = 'form-result success';
    resultDiv.innerHTML = `
      <strong>Configuration Saved Successfully!</strong><br />
      Tenant: <code>${payload.tenantEmail}</code><br />
      Accountability Partner: <code>${payload.partnerName} (${payload.partnerEmail})</code><br />
      Active Feeds Blocked: <code>${selectedFeeds.join(', ') || 'None'}</code>
    `;
    resultDiv.classList.remove('hidden');
  });
});
