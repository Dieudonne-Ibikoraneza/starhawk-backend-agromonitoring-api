require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

async function fix() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  await client.connect();
  
  // Try to find the correct DB (usually 'test' for mongoose if not in URI, but let's check collections)
  let db = client.db('test');
  let cols = await db.listCollections().toArray();
  if (cols.length === 0) {
    db = client.db('starhawk');
    cols = await db.listCollections().toArray();
  }
  
  console.log("Using DB:", db.databaseName);
  console.log("Collections:", cols.map(c => c.name));

  // 1. Update Assessment
  try {
    const resA = await db.collection('assessments').updateOne(
      { _id: new ObjectId("6a1e856682de7c8ed744a37f") },
      { $set: { insurerId: new ObjectId("6945a011d0d770a025d72a2a") } }
    );
    console.log("Updated Assessment (ObjectId):", resA.modifiedCount);
    
    if (resA.modifiedCount === 0) {
      // Try string ID
      const resA2 = await db.collection('assessments').updateOne(
        { _id: "6a1e856682de7c8ed744a37f" },
        { $set: { insurerId: "6945a011d0d770a025d72a2a" } }
      );
      console.log("Updated Assessment (String):", resA2.modifiedCount);
    }
  } catch(e) { console.error(e) }

  // 2. Update Farm if the ID was actually a Farm ID
  try {
    const resF = await db.collection('farms').updateOne(
      { _id: new ObjectId("6a1e856682de7c8ed744a37f") },
      { $set: { insurerId: new ObjectId("6945a011d0d770a025d72a2a") } }
    );
    console.log("Updated Farm (ObjectId):", resF.modifiedCount);
    if (resF.modifiedCount === 0) {
        // also check string
        const resF2 = await db.collection('farms').updateOne(
          { _id: "6a1e856682de7c8ed744a37f" },
          { $set: { insurerId: "6945a011d0d770a025d72a2a" } }
        );
        console.log("Updated Farm (String):", resF2.modifiedCount);
    }
  } catch(e) { console.error(e) }

  // 3. Reset Julien's Password
  try {
    const hashed = await bcrypt.hash("i9@c^8SiBsSH", 10);
    const resU = await db.collection('users').updateOne(
      { phoneNumber: "0788416135" },
      { $set: { password: hashed } }
    );
    console.log("Updated Julien's password:", resU.modifiedCount);
  } catch(e) { console.error(e) }

  await client.close();
}

fix().catch(console.error);
