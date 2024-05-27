const express = require("express");
const mysql = require("mysql2");
let bodyParser = require('body-parser');
const cors = require("cors");
const multer = require('multer');
const { admin, db, bucket } = require('./firebase');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());


const storage = multer.memoryStorage();
const upload = multer({ storage });

//firebase
app.post('/properties', upload.array('photos', 5), async (req, res) => {
    const property = req.body;
    const photos = req.files;
    const {
      title,
      description,
      address,
      price,
      contact,
      email,
      type,
      no_of_bath,
      no_of_bed,
      square_feet,
      amenities,
      metro,
      bus_stand,
      hospital,
      school,
      market,
      others,
      owner,
    } = property;
    let photoUrls = [];
  
    for (const photo of photos) {
      const blob = bucket.file(`${Date.now()}-${photo.originalname}`);
      const downloadToken = uuidv4(); // Generate a unique download token
  
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: photo.mimetype,
          metadata: {
            firebaseStorageDownloadTokens: downloadToken
          }
        }
      });
  
      blobStream.on('error', (err) => {
        console.error('Error uploading photo to Firebase Storage:', err);
        return res.status(500).send('Error uploading photo to Firebase Storage');
      });
  
      blobStream.on('finish', async () => {
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(blob.name)}?alt=media&token=${downloadToken}`;
        photoUrls.push(publicUrl);
        if (photoUrls.length === photos.length) {
          // Save property details to Firestore
          try {
            const docRef = await db.collection('properties').add({
              title,
              description,
              address,
              price,
              contact,
              email,
              type,
              no_of_bath,
              no_of_bed,
              square_feet,
              amenities,
              metro,
              bus_stand,
              hospital,
              school,
              market,
              others,
              photos: photoUrls,
              owner,
              likes: [],
              liked: 0
            });
  
            const propertyId = docRef.id;
  
            // Update the user document
            const userDocRef = db.collection('users').doc(owner);
            const userDoc = await userDocRef.get();
  
            if (userDoc.exists) {
              const userData = userDoc.data();
              const userProperties = userData.properties || [];
  
              await userDocRef.update({
                properties: [...userProperties, propertyId]
              });
            } else {
              // If the user does not exist, handle this case
              console.error('User not found:', owner);
              return res.status(404).send('User not found');
            }
  
            res.status(201).json({ id: propertyId, ...property, photos: photoUrls });
          } catch (err) {
            console.error('Error saving property to Firestore:', err);
            res.status(500).send('Error saving property to Firestore');
          }
        }
      });
  
      blobStream.end(photo.buffer);
    }
  });

  //enqyuiry-lik
  app.post('/enquired-properties', async (req, res) => {
    const { userId } = req.body;
    console.log(userId);
  
    if (!userId) {
      return res.status(400).json({ message: 'Missing user ID' });
    }
  
    try {
      // Retrieve the user's document
      const userDoc = await db.collection('users').doc(userId).get();
  
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const user = userDoc.data();
      const enquiredPropertyIds = user.enquiry || [];
  
      if (enquiredPropertyIds.length === 0) {
        return res.status(200).json([]);
      }
  
      // Fetch the details of each enquired property
      const properties = [];
      for (const propertyId of enquiredPropertyIds) {
        const propertyDoc = await db.collection('properties').doc(propertyId).get();
        if (propertyDoc.exists) {
          properties.push({ id: propertyDoc.id, ...propertyDoc.data() });
        }
      }
  
      res.status(200).json(properties);
      console.log(properties);
    } catch (error) {
      console.error('Error fetching enquired properties:', error);
      res.status(500).json({ message: 'Failed to fetch enquired properties' });
    }
  });
  //myprop
  app.post('/user-properties', async (req, res) => {
    const { userId } = req.body;
    console.log(userId)
  
    if (!userId) {
      return res.status(400).json({ message: 'Missing user ID' });
    }
  
    try {
      // Retrieve the user's document
      const userDoc = await db.collection('users').doc(userId).get();
  
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const user = userDoc.data();
      const userPropertyIds = user.properties || [];
  
      if (userPropertyIds.length === 0) {
        return res.status(200).json([]);
      }
  
      // Fetch the details of each property owned by the user
      const properties = [];
      for (const propertyId of userPropertyIds) {
        const propertyDoc = await db.collection('properties').doc(propertyId).get();
        if (propertyDoc.exists) {
          properties.push({ id: propertyDoc.id, ...propertyDoc.data() });
        }
      }
  
      res.status(200).json(properties);
    } catch (error) {
      console.error('Error fetching user properties:', error);
      res.status(500).json({ message: 'Failed to fetch user properties' });
    }
  });
  

  //liked props
  app.post('/liked-properties', async (req, res) => {
    const { userId } = req.body;
    console.log(userId);
  
    if (!userId) {
      return res.status(400).json({ message: 'Missing user ID' });
    }
  
    try {
      // Retrieve the user's document
      const userDoc = await db.collection('users').doc(userId).get();
  
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const user = userDoc.data();
      const likedPropertyIds = user.likes || [];
  
      if (likedPropertyIds.length === 0) {
        return res.status(200).json([]);
      }
  
      // Fetch the details of each liked property
      const properties = [];
      for (const propertyId of likedPropertyIds) {
        const propertyDoc = await db.collection('properties').doc(propertyId).get();
        if (propertyDoc.exists) {
          properties.push({ id: propertyDoc.id, ...propertyDoc.data() });
        }
      }
  
      res.status(200).json(properties);
    } catch (error) {
      console.error('Error fetching liked properties:', error);
      res.status(500).json({ message: 'Failed to fetch liked properties' });
    }
  });
  
//retreiving data 
app.get('/properties', async (req, res) => {
    try {
      const propertiesSnapshot = await db.collection('properties').get();
      const properties = propertiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      res.status(200).json(properties);
    } catch (err) {
      console.error('Error retrieving properties:', err);
      res.status(500).send('Error retrieving properties.');
    }
  });


  // Endpoint to handle likes
  app.post('/properties/:id/like', async (req, res) => {
    const propertyId = req.params.id;
    const userId = req.body.userId; // Get the user ID from the request body
    console.log(userId)
    console.log(propertyId)
  
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
  
    try {
      const userRef = db.collection('users').doc(userId);
      const propertyRef = db.collection('properties').doc(propertyId);
  
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      const user = userDoc.data();
      const likedProperties = user.likes || [];
  
      if (likedProperties.includes(propertyId)) {
        return res.status(400).json({ message: 'Property already liked' });
      }
  
      // Update the user's liked properties
      await userRef.update({
        likes: admin.firestore.FieldValue.arrayUnion(propertyId)
      });
  
      // Increment the property's like count
      await propertyRef.update({
        likes: admin.firestore.FieldValue.increment(1)
      });
  
      res.status(200).json({ message: 'Property liked successfully' });
    } catch (err) {
      console.error('Error liking property:', err);
      res.status(500).send('Error liking property.');
    }
  });

  //email
  app.post('/enquiry', async (req, res) => {
    const { ownerEmail, senderEmail, id, propertyId } = req.body;
    console.log(ownerEmail, senderEmail, id, propertyId, "Enquiry");
  
    if (!ownerEmail || !senderEmail || !propertyId || !id) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
  
    try {
      // Retrieve the owner's user document
      const userQuery = db.collection('users').where('email', '==', ownerEmail).limit(1);
      const userSnapshot = await userQuery.get();
  
      if (userSnapshot.empty) {
        return res.status(404).json({ message: 'Owner not found' });
      }
  
      const ownerDoc = userSnapshot.docs[0];
      const ownerData = ownerDoc.data();
  
      // Append the property ID to the sender's enquiries list
      const senderDocRef = db.collection('users').doc(id);
      const senderDoc = await senderDocRef.get();
  
      if (!senderDoc.exists) {
        return res.status(404).json({ message: 'Sender not found' });
      }
  
      const senderData = senderDoc.data();
      const userEnquiries = senderData.enquiry || [];
      userEnquiries.push(propertyId);
  
      await senderDocRef.update({
        enquiry: userEnquiries
      });
  
      // Set up nodemailer transporter
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'nishanthsrinivasan60@gmail.com', // Your email address
          pass: 'hcip htbq ykeh cnqv', // Your email password
        },
      });
  
      // Set up email data
      const mailOptions = {
        from: senderEmail, // Sender address
        to: ownerEmail, // Receiver address
        subject: 'Property Enquiry', // Subject line
        text: `Hello,
  
  You have received an enquiry for your property listed as ${propertyId}.
  
  Enquirer details:
  Name: ${senderData.name}
  Email: ${senderEmail}
  
  Best regards,
  Your Website`, // Plain text body
      };
  
      // Send email
      await transporter.sendMail(mailOptions);
  
      res.status(200).json({ message: 'Enquiry sent successfully' });
    } catch (error) {
      console.error('Error sending enquiry:', error);
      res.status(500).json({ message: 'Failed to send enquiry' });
    }
  });
  app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from the backend!' });
  });
  
  
  //deleete
  app.delete('/user-properties/:userId/:propertyId', async (req, res) => {
    const { userId, propertyId } = req.params;
  
    const userRef = db.collection('users').doc(userId);
    const propertyRef = db.collection('properties').doc(propertyId);
  
    try {
      // Start a batch
      const batch = db.batch();
  
      // Delete the property document from Firestore
      batch.delete(propertyRef);
  
      // Remove the property ID from the user's properties array
      batch.update(userRef, {
        properties: admin.firestore.FieldValue.arrayRemove(propertyId)
      });
  
      // Commit the batch
      await batch.commit();
  
      res.status(200).send({ message: 'Property deleted successfully' });
    } catch (error) {
      res.status(500).send({ error: 'Error deleting property' });
    }
  });
// const db = mysql.createConnection({
//     user: 'root',
//     host: 'localhost',
//     password: 'password',
//     database: 'Rentify',
// });



//Register end point
// app.post('/datas', (req, res) => {
//     const data = req.body.data;
//     const sql = `INSERT INTO Rentify.User (name, email, phno, password, username) VALUES (?, ?, ?, ?, ?)`;
//     db.query(sql, [data.name, data.email, data.phoneNumber, data.password, data.username], (err, result) => {
//         if (err) {
//             console.error('Error executing query:', err.stack);
//             res.status(500).send('Error inserting data into the database.');
//             return;
//         }
//         console.log('Data inserted successfully:', result);
//         res.status(200).json({ message: 'Data received and inserted successfully' });
//     });
// });
app.post('/data', async (req, res) => {
    const data = req.body.data;
  
    // Validate data
    if (!data.name || !data.email || !data.phoneNumber || !data.password || !data.username) {
      return res.status(400).json({ message: 'All fields are required' });
    }
  
    try {
      // Add data to Firestore
      const userId = uuidv4();

      // Add data to Firestore with custom user ID
      await db.collection('users').doc(userId).set({
        name: data.name,
        email: data.email,
        phoneNumber: data.phoneNumber,
        password: data.password,
        username: data.username,
        likes:[],
        enquiry:[],
        property:[]
      });
      console.log('Data inserted successfully:', userId);
      res.status(200).json({ message: 'Data received and inserted successfully', id: userId });
    } catch (err) {
      console.error('Error inserting data into Firestore:', err);
      res.status(500).send('Error inserting data into Firestore.');
    }
  });

//login endpoint
// app.post('/login', (req, res) => {
//     const { username, password } = req.body;
//     const sql = 'SELECT * FROM Rentify.User WHERE username = ? AND password = ?';
    
//     db.query(sql, [username, password], (err, results) => {
//         if (err) {
//             console.error('Error executing query:', err.stack);
//             res.status(500).send('Error checking credentials.');
//             return;
//         }

//         if (results.length > 0) {
//             res.status(200).json({ message: 'Login successful' });
//         } else {
//             res.status(401).json({ message: 'Invalid username or password' });
//         }
//     });
// });
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
  
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
  
    try {
      const userSnapshot = await db.collection('users')
                                   .where('username', '==', username)
                                   .where('password', '==', password)
                                   .get();
  
      if (!userSnapshot.empty) {
        const user = userSnapshot.docs[0].data();
        const userId = userSnapshot.docs[0].id; // Get the user ID
    
        // Return user ID and other details if necessary
        res.status(200).json({ userId, username: user.username, email: user.email });
      } else {
        res.status(401).json({ message: 'Invalid username or password' });
      }
    } catch (err) {
      console.error('Error checking credentials:', err);
      res.status(500).send('Error checking credentials.');
    }
  });


//register land
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//       cb(null, 'uploads/');
//     },
//     filename: (req, file, cb) => {
//       cb(null, `${Date.now()}-${file.originalname}`);
//     }
//   });
  
//   const upload = multer({ storage });
  
//   app.post('/properties', upload.array('photos', 5), (req, res) => {
//     const property = req.body;
//     property.photos = req.files.map(file => file.path);
//     // Here you can save property to your database
//     res.status(201).json(property);
//   });

// app.post("/data",async(req,res)=>{
//     const data = req.body;
//     await User.add(data);
//     res.send({msg:"Added Succesfully"});

// })
  
const Port = process.env.PORT || 3000;
app.listen(Port, () => {
    console.log("Server running on port 8081");
});
