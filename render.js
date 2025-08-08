window.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.loader');
  const qrcode = document.querySelector('.qrcode')
  const connectBtn = document.getElementById('connect-btn')

  window.botinho.onQrCode((dataUrl) => {
    qrcode.innerHTML = '';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = 'QR Code';
    img.style.width = '200px';
    img.style.height = '200px';
    container.classList.remove('loader');
    qrcode.appendChild(img);

  });

  window.botinho.onConnected(() => {
    container.classList.remove('loader');
    qrcode.innerHTML = '';
    connectBtn.style.display = 'block'
  });

  window.botinho.startWhatsapp(); 
});
