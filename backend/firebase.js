const admin = require('firebase-admin');
const serviceAccount = require('./rentify-3431e-firebase-adminsdk-4osn9-353d85bcf4.json'); // Replace with the path to your service account file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://rentify-3431e.appspot.com' // Replace with your Firebase storage bucket URL
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true }); 
const bucket = admin.storage().bucket();

module.exports = { admin, db, bucket };
