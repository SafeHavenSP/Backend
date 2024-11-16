var admin = require("firebase-admin");

var serviceAccount = require("./key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'xxxxxxxxxxxxxxxxxxxxxxxxx', 
  storageBucket: 'xxxxxxxxxxxxxxxxxxxxxxxx'
});


const auth = admin.auth();
const db = admin.firestore();
const realtimeDB = admin.database(); 



module.exports={
  auth,
  db,
  admin,
  realtimeDB
}
