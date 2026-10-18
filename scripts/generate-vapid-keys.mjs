import { webcrypto } from 'node:crypto';
const { subtle } = webcrypto;
const b64url=(buf)=>Buffer.from(buf).toString('base64url');
const keyPair=await subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const pub=await subtle.exportKey('raw',keyPair.publicKey);
const jwk=await subtle.exportKey('jwk',keyPair.privateKey);
console.log('VAPID_PUBLIC_KEY='+b64url(pub));
console.log('VAPID_PRIVATE_KEY='+jwk.d);
console.log('\nStore VAPID_PRIVATE_KEY as a Cloudflare secret. VAPID_PUBLIC_KEY can be a normal environment variable.');
