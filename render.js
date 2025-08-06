window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('qrcode-container');

  window.botinho.onQrCode((dataUrl) => {
    container.innerHTML = '';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = 'QR Code';
    img.style.width = '200px';
    img.style.height = '200px';
    container.appendChild(img);
  });

  window.botinho.onConnected(() => {
    container.innerHTML = '<h2>WhatsApp já está conectado!</h2>';
  });
  // Inicia o WhatsApp
  window.botinho.startWhatsapp();
});
