const admin = require('firebase-admin');
const serviceAccount = require('/app/src/credentials/firebase-credentials.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();

module.exports = { admin, db };