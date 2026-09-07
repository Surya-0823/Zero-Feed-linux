document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('emergencyForm');
  const msg = document.getElementById('statusMessage');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const reason = document.getElementById('reason').value;

    msg.className = 'status-msg success';
    msg.textContent = `OTP request dispatched to partner for: "${reason}". Valid for 15 minutes.`;
    msg.classList.remove('hidden');
    form.reset();
  });
});
