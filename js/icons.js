import { raw } from './ui-core.js';
// Spójny zestaw ikon (kreska 1.8, zaokrąglone zakończenia).
const P = {
  chat: '<path d="M5 4.500h14a2 2 0 0 1 2 2v8.500a2 2 0 0 1-2 2h-7.500L7 20.500V17H5a2 2 0 0 1-2-2V6.500a2 2 0 0 1 2-2z"/><path d="M8 9.500h8M8 13h5"/>',
  send: '<path d="M21 3 10 14M21 3l-6.500 18-3.500-7.500L3.500 10z"/>',
  reply: '<path d="M10 7 4 12l6 5V14c5 0 8 1 10 5-.5-6-4-9.500-10-9.500z"/>',
  paperclip: '<path d="m20 11-8.500 8.500a5 5 0 0 1-7-7L13 4a3.500 3.500 0 0 1 5 5l-8.500 8.500a2 2 0 0 1-3-3L14.500 7"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/>',
  heart: '<path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.700-8 10.600-8 10.600z"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.500 7.500 2.500 7.500h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.400 3.600-7 8-7s8 2.600 8 7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
  pencil: '<path d="m4 20 1-4L16.500 4.500a2.100 2.100 0 0 1 3 3L8 19z"/><path d="m14.500 6.500 3 3"/>',
  camera: '<path d="M4 8h3l1.500-2.500h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.500"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  pin: '<path d="M12 21s-6.500-6-6.500-11a6.500 6.500 0 0 1 13 0c0 5-6.500 11-6.500 11z"/><circle cx="12" cy="10" r="2.300"/>',
  truck: '<path d="M2.500 6.500h11v9h-11zM13.500 9.500h4l3 3v3h-7z"/><circle cx="7" cy="17.500" r="1.800"/><circle cx="17" cy="17.500" r="1.800"/>',
  medic: '<rect x="3.500" y="3.500" width="17" height="17" rx="3.500"/><path d="M12 8v8M8 12h8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.500 3.500 0 0 0 0-7H9a3.500 3.500 0 0 1 0-7h7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2.500"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2.500"/><path d="M8 11V8a4 4 0 0 1 7.500-2"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.500v5.500M12 16.500v.01"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.600v.01"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.300-5.700M20 4v5h-5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6v.01M4 12v.01M4 18v.01"/>',
  box: '<path d="M3.500 7.500 12 3l8.500 4.500v9L12 21l-8.500-4.500zM3.500 7.500 12 12l8.500-4.500M12 12v9"/>',
  star: '<path d="m12 3 2.700 5.600 6.100.8-4.500 4.300 1.100 6.100L12 16.800 6.600 19.800l1.100-6.100L3.200 9.400l6.100-.8z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
  walk: '<circle cx="12" cy="4.500" r="2"/><path d="m12 7-1 5 3 3v6M11 12l-3 2-1 4M13 8.500l3 2.500 3-.5"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  gift: '<rect x="3.500" y="9" width="17" height="11" rx="2"/><path d="M12 9v11M3.500 13h17M12 9c-1-4-5.500-4.500-5.500-2s3 2 5.500 2zm0 0c1-4 5.500-4.500 5.500-2s-3 2-5.500 2z"/>',
  paw: '<ellipse cx="6.500" cy="10.500" rx="1.900" ry="2.400"/><ellipse cx="10" cy="6.500" rx="2" ry="2.600"/><ellipse cx="14" cy="6.500" rx="2" ry="2.600"/><ellipse cx="17.500" cy="10.500" rx="1.900" ry="2.400"/><path d="M12 12.500c-3 0-5.500 2.700-5.500 5 0 1.600 1.400 2.200 2.800 2 .9-.1 1.700-.5 2.700-.5s1.800.4 2.700.5c1.400.2 2.800-.4 2.800-2 0-2.300-2.500-5-5.500-5z"/>'
};
export const FILLED = new Set(['paw']);
export function icon(name, cls = '') {
  const fill = FILLED.has(name) ? ' fill' : '';
  return raw(`<svg class="ico${fill} ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`);
}
