const admin = require('firebase-admin');
const fs = require('fs');

const base64 = fs.readFileSync('firebase_config_base64.txt', 'utf8');
const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

admin.initializeApp({
  credential: admin.credential.cert(json)
});

console.log(' Firebase config is valid!');
