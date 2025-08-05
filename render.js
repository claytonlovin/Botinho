window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('qrcode-container');
  const url = '';

  const dataUrl = await window.botinho.generateQRCode(url);

  if (dataUrl) {
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = 'QR Code';
    img.style.width = '200px';
    img.style.height = '200px';
    container.innerHTML = '';
    container.appendChild(img);
  } else {
    container.textContent = 'Erro ao gerar QR Code.';
  }
});
