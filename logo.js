/**
 * THAIBA PUBLIC SCHOOL — Official Emblem & Brand Logo SVG Engine
 * Matching the Thaiba Public School / Thaiba Heritage Identity
 *
 * An administrator can upload a real institute logo (Admin -> Branding).
 * When one is set, every emblem rendered anywhere in the application or in
 * printed documents uses that image instead of the built-in SVG.
 */

const LOGO_CACHE_KEY = 'tps_brand_logo';

let customLogoUrl = './tps-logo.png';
try {
  customLogoUrl = localStorage.getItem(LOGO_CACHE_KEY) || localStorage.getItem('tms_brand_logo') || './tps-logo.png';
} catch (e) {
  customLogoUrl = './tps-logo.png';
}

const attrEsc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function customLogoImg(size) {
  return `<img src="${attrEsc(customLogoUrl || './tps-logo.png')}" alt="Institute Logo" `
    + `style="width:${size}px; height:${size}px; object-fit:contain; flex-shrink:0;">`;
}

export const TMS_LOGO = {
  /** Set (or clear) the institute logo used across the whole application. */
  setCustomLogo: (url) => {
    customLogoUrl = url || './tps-logo.png';
    try {
      if (url) {
        localStorage.setItem(LOGO_CACHE_KEY, url);
        localStorage.setItem('tms_brand_logo', url);
      } else {
        localStorage.setItem(LOGO_CACHE_KEY, './tps-logo.png');
      }
    } catch (e) { /* storage unavailable */ }
  },

  getCustomLogo: () => customLogoUrl || './tps-logo.png',

  animatedLoader: (size = 72, text = 'Loading Thaiba ERP...') => `
    <div class="tms-animated-loader" style="padding: 32px 16px; text-align: center;">
      <div class="tms-loader-emblem-wrap" style="position: relative; width: ${size}px; height: ${size}px; margin: 0 auto 14px;">
        <div class="tms-loader-aura"></div>
        <img src="${attrEsc(customLogoUrl || './tps-logo.png')}" alt="Thaiba Public School" class="tms-loader-img" style="width: ${size * 0.82}px; height: ${size * 0.82}px; object-fit: contain; position: relative; z-index: 2;">
      </div>
      ${text ? `<div class="tms-loader-text" style="font-family: 'Outfit', sans-serif; font-weight: 700; color: #BF9A33; font-size: 0.92rem;">${text}</div>` : ''}
    </div>
  `,

  // Geometric Leaf / Diamond Shield Emblem (Matching Logo Theme Gold)
  emblemSvg: (size = 48) => {
    if (customLogoUrl) return customLogoImg(size);
    return `
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
      <defs>
        <linearGradient id="tmsGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#BF9A33" />
          <stop offset="100%" stop-color="#8C6E1E" />
        </linearGradient>
        <linearGradient id="tmsGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#D4AF37" />
          <stop offset="100%" stop-color="#BF9A33" />
        </linearGradient>
      </defs>
      <!-- Outer Shield / Diamond -->
      <path d="M50 4 L92 28 V72 L50 96 L8 72 V28 Z" fill="url(#tmsGrad1)" />
      <!-- Inner White Geometric Frame -->
      <path d="M50 14 L82 33 V67 L50 86 L18 67 V33 Z" stroke="#ffffff" stroke-width="4" stroke-linejoin="round" fill="none" opacity="0.95" />
      <!-- Stylized Center Leaves / Book of Knowledge -->
      <path d="M50 24 L72 38 V62 L50 76 L28 62 V38 Z" fill="url(#tmsGrad2)" />
      <!-- Center Spire / Pen Nib Accent -->
      <path d="M50 28 L62 48 H38 Z" fill="#ffffff" />
      <circle cx="50" cy="58" r="4" fill="#ffffff" />
    </svg>
  `;
  },

  // Full Brand Logo with Institution & Heritage Subtext
  fullBrandSvg: (height = 64) => `
    <div style="display: flex; align-items: center; gap: 14px; text-align: left;">
      ${TMS_LOGO.emblemSvg(height)}
      <div>
        <div style="font-family: 'Outfit', sans-serif; font-weight: 800; font-size: ${height * 0.36}px; line-height: 1.1; letter-spacing: 0.04em; color: #0f172a;" class="brand-text-dark">
          THAIBA PUBLIC SCHOOL
        </div>
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: ${height * 0.19}px; font-weight: 600; color: #BF9A33; letter-spacing: 0.05em; text-transform: uppercase;">
          Run by : Thaiba Heritage, Kolkata
        </div>
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: ${height * 0.17}px; color: #64748b;">
          Baghait, Tapan, Dakshin Dinajpur • Regd. No. : IV 01894/2011
        </div>
      </div>
    </div>
  `,

  // Print-Ready Monochrome / Crisp Header for A4 PDF Document
  printHeaderSvg: (opts = {}) => {
    const instName = opts.title || 'THAIBA PUBLIC SCHOOL';
    const subTitle = opts.subtitle || 'Run by : Thaiba Heritage, Kolkata';
    const address = opts.address || 'Baghait, Tapan, Dakshin Dinajpur • Regd. No. : IV 01894/2011';
    const website = opts.website || 'www.thaibagarden.com';
    const email = opts.email || 'tps@thaibagarden.com';
    const contact = opts.contact || '+91 8653382851, +91 8167782851';

    return `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
      <div style="display: flex; gap: 14px; align-items: center;">
        ${TMS_LOGO.emblemSvg(70)}
        <div style="font-family: 'Outfit', sans-serif;">
          <div style="font-size: 10px; font-weight: 700; color: #8C6E1E; letter-spacing: 0.05em;">${attrEsc(instName)}</div>
          <div style="font-size: 8px; color: #64748b;">Thaiba Garden, Tapan</div>
        </div>
      </div>

      <div style="text-align: center; flex: 1; padding: 0 10px;">
        <h1 style="font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: 0.02em; color: #000; margin: 0; text-transform: uppercase;">
          ${attrEsc(instName)}
        </h1>
        <div style="font-size: 11px; font-weight: 700; color: #111; margin-top: 2px;">
          ${attrEsc(subTitle)}
        </div>
        <div style="font-size: 10.5px; color: #222; margin-top: 1px;">
          ${attrEsc(address)}
        </div>
        <div style="font-size: 9.5px; color: #444; margin-top: 1px;">
          Web: <strong>${attrEsc(website)}</strong> • Mail: <strong>${attrEsc(email)}</strong>
        </div>
        <div style="font-size: 9.5px; color: #444; margin-top: 1px;">
          Contact: <strong>${attrEsc(contact)}</strong>
        </div>
      </div>

      <div style="width: 105px; height: 125px; border: 1.5px solid #0f172a; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 9.5px; color: #555; background: #fafafa; font-style: italic; line-height: 1.2; padding: 4px;">
        Passport Size Photo
      </div>
    </div>
  `;
  }
};

export default TMS_LOGO;
