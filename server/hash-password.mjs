// Czyta hasło ze standardowego wejścia (nie z argumentów – nie zostaje w historii powłoki) i wypisuje hash scrypt.
import crypto from 'node:crypto';
let s = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (s += c));
process.stdin.on('end', () => {
  const pw = s.replace(/\r?\n$/, '');
  if (pw.length < 8) { console.error('Hasło musi mieć co najmniej 8 znaków'); process.exit(1); }
  const N = 16384, salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 32, { N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  console.log(`scrypt$${N}$${salt.toString('base64')}$${h.toString('base64')}`);
});
