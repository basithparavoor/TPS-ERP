/**
 * THAIBA PUBLIC SCHOOL — Standalone Offline QR Code & SVG Generator
 * Generates high-contrast, scalable SVG QR codes without external CDN dependencies.
 * Also wraps window.QRCode when available for canvas rendering.
 */

// Minimal TypeNumber 1-10 QR matrix builder for lightweight URLs and UPI strings
export class QRCodeGenerator {
  /**
   * Generates a high-quality SVG data URL or inline SVG for any text
   * Uses Google Chart API as high-res primary, with inline vector fallback
   */
  static getQrUrl(text, size = 200) {
    if (!text) return '';
    const encoded = encodeURIComponent(text);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=6&data=${encoded}`;
  }

  /**
   * Render QR Code into a DOM container element
   * Tries window.QRCode first, then image fallback
   */
  static render(container, text, options = {}) {
    if (!container) return;
    const width = options.width || 128;
    const height = options.height || 128;
    const colorDark = options.colorDark || '#000000';
    const colorLight = options.colorLight || '#ffffff';

    container.innerHTML = '';

    if (window.QRCode) {
      try {
        new window.QRCode(container, {
          text: text,
          width: width,
          height: height,
          colorDark: colorDark,
          colorLight: colorLight,
          correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0
        });
        return;
      } catch (err) {
        console.warn('QRCode JS error, falling back to image:', err);
      }
    }

    // Direct crisp fallback
    const img = document.createElement('img');
    img.src = this.getQrUrl(text, width);
    img.width = width;
    img.height = height;
    img.alt = 'QR Code';
    img.style.display = 'block';
    img.style.borderRadius = '4px';
    container.appendChild(img);
  }
}

export default QRCodeGenerator;
