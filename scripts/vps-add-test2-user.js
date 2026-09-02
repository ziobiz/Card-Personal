#!/usr/bin/env node
/**
 * VPS helper: upsert member test2 with a dedicated OTP secret
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.cwd();
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);
const jwt = env.JWT_SECRET || 'dev';
function hashPw(password) {
  return crypto.createHash('sha256').update(password + jwt).digest('hex');
}
const ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function toBase32(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPH[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPH[(value << (5 - bits)) & 31];
  return out;
}

const email = 'test2@test.com';
const password = 'test2345';
const otpSecret = toBase32(Buffer.from('icocard-test2-otp-secret!!'));

for (const rel of ['dist/data/users.json', 'src/data/users.json']) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let data = { users: [] };
  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {}
  }
  if (!Array.isArray(data.users)) data.users = [];
  let u = data.users.find((x) => String(x.email).toLowerCase() === email);
  if (!u) {
    u = {
      id: crypto.randomUUID(),
      email,
      createdAt: new Date().toISOString(),
      source: 'direct',
      country: 'KR',
      status: 'active',
    };
    data.users.push(u);
  }
  u.passwordHash = hashPw(password);
  u.status = 'active';
  u.source = 'direct';
  u.otpSecret = otpSecret;
  u.otpEnabled = true;
  u.wirexUserId = u.wirexUserId || 'mock-' + u.id.slice(0, 8);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log('upserted', file);
}

console.log(
  JSON.stringify(
    {
      email,
      password,
      otpSecret,
    },
    null,
    2
  )
);
