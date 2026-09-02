#!/bin/bash
set -e
cd /var/www/icocard/backend
node <<'NODE'
const crypto = require('crypto');
const fs = require('fs');
const secret = 'NFRW6Y3BOJSC25DFON2C233UOAWWWZLZEEQQ';
const ALPH='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function fromBase32(s){
  s=s.replace(/=+$/,'').toUpperCase();
  let bits=0,value=0,out=[];
  for(const ch of s){
    const idx=ALPH.indexOf(ch); if(idx<0) continue;
    value=(value<<5)|idx; bits+=5;
    if(bits>=8){ out.push((value>>>(bits-8))&255); bits-=8; }
  }
  return Buffer.from(out);
}
function hotp(sec, counter){
  const buf=Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter/0x100000000),0);
  buf.writeUInt32BE(counter & 0xffffffff,4);
  const hmac=crypto.createHmac('sha1', fromBase32(sec)).update(buf).digest();
  const off=hmac[hmac.length-1]&0xf;
  const code=((hmac[off]&0x7f)<<24)|(hmac[off+1]<<16)|(hmac[off+2]<<8)|hmac[off+3];
  return String(code%1000000).padStart(6,'0');
}
const t=Math.floor(Date.now()/1000/30);
const code=hotp(secret,t);
fs.writeFileSync('/tmp/otp-code.txt', code);
console.log('OTP', code);
NODE

CODE=$(cat /tmp/otp-code.txt)

# member verify
TOKEN=$(curl -s -X POST http://127.0.0.1:3001/api/auth/login -H 'Content-Type: application/json' --data-binary @/tmp/m.json | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
echo "MEMBER_TOKEN_OK"
curl -s -X POST http://127.0.0.1:3001/api/auth/otp/verify -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{\"code\":\"$CODE\"}"
echo

# admin verify
ATOKEN=$(curl -s -X POST http://127.0.0.1:3001/api/admin/login -H 'Content-Type: application/json' --data-binary @/tmp/a.json | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
echo "ADMIN_TOKEN_OK"
curl -s -X POST http://127.0.0.1:3001/api/admin/otp/verify -H "Content-Type: application/json" -H "Authorization: Bearer $ATOKEN" -d "{\"code\":\"$CODE\"}"
echo
