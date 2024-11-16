const Utility = require("./FirebaseAdmin");

async function uploadProduct(username, productName, description, price, photoFiles, quantity) {
  try {
    const productId = `${username}_${productName}`;

    const photoUrls = await Promise.all(photoFiles.map(async (file, index) => {
      const bucket = Utility.admin.storage().bucket();
      const filePath = `products/${productId}/${index}_${file.originalname}`; 
      const fileRef = bucket.file(filePath);
      
      await fileRef.save(file.buffer, {
        metadata: { contentType: file.mimetype },
        public: true,
      });

      return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    }));

    const productDoc = {
      productName,
      description,
      price,
      quantity,
      photos: photoUrls, 
      uploadedBy: username,
      likedBy: [],      
      dislikedBy: [],   
      createdAt: Utility.admin.firestore.FieldValue.serverTimestamp(),
    };

    await Utility.db.collection('products').doc(productId).set(productDoc);
    console.log(`Product ${productId} uploaded successfully.`);
  } catch (error) {
    console.error('Error uploading product:', error);
    throw error;
  }
}
async function deleteProduct(username, productName) {
  try {
    const productId = `${username}_${productName}`;
    const productRef = Utility.db.collection('products').doc(productId);

    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      throw new Error(`Product ${productId} does not exist.`);
    }

    const productData = productDoc.data();
    const photoUrls = productData.photos || [];

    const bucket = Utility.admin.storage().bucket();
    await Promise.all(
      photoUrls.map(async (photoUrl) => {
        const filePath = photoUrl.replace(`https://storage.googleapis.com/${bucket.name}/`, '');

        await bucket.file(filePath).delete();
        console.log(`Deleted photo from storage: ${filePath}`);
      })
    );

    await productRef.delete();
    console.log(`Product ${productId} deleted successfully.`);
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

async function updateOrDeleteProduct(username, productName, purchasedQuantity) {
  try {
    const productId = `${username}_${productName}`;
    const productRef = Utility.db.collection('products').doc(productId);

    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      throw new Error(`Product ${productId} does not exist.`);
    }

    const productData = productDoc.data();
    const currentQuantity = productData.quantity || 0;

    const newQuantity = currentQuantity - purchasedQuantity;
    
    if (newQuantity <= 0) {
      const photoUrls = productData.photos || [];
      const bucket = Utility.admin.storage().bucket();

      await Promise.all(
        photoUrls.map(async (photoUrl) => {
          const filePath = photoUrl.replace(`https://storage.googleapis.com/${bucket.name}/`, '');
          await bucket.file(filePath).delete();
          console.log(`Deleted photo from storage: ${filePath}`);
        })
      );

      await productRef.delete();
      console.log(`Product ${productId} deleted successfully.`);
    } else {
      await productRef.update({ quantity: newQuantity });
      console.log(`Product ${productId} quantity updated to ${newQuantity}.`);
    }
  } catch (error) {
    console.error('Error updating or deleting product:', error);
    throw error;
  }
}


async function createUser(username, email, firstName, lastName,address, password) {
  try {
    var resp = await checkUserExist(username);

    if (resp == 0) {
      return "username taken";
    }

    const userRecord = await Utility.auth.createUser({
      email: email,
      password: password,
      displayName: `${firstName} ${lastName}`,
    });

    console.log('Successfully created new user:', userRecord.uid);

    const userDoc = {
      username: username,
      email: email,
      firstName: firstName,
      lastName: lastName,
      address: address,
      karma: 1,
      balance: 0  
     
    };

    await Utility.db.collection('users').doc(username).set(userDoc);

    console.log(`User ${username} added to Firestore with document ID: ${username}`);
    return userRecord;
  } catch (error) {
    console.log("there was an error, email is taken", error);
    return "email taken";
  }
}
async function getAddressByUsername(username) {
  try {
    const userDoc = await Utility.db.collection('users').doc(username).get();

    if (!userDoc.exists) {
      console.log(`No user found with username: ${username}`);
      return null; 
    }

    const userData = userDoc.data();
    const address = userData.address;
    console.log(`Address for user ${username}: ${address}`);
    
    return address;
  } catch (error) {
    console.error(`Error fetching address for username ${username}:`, error);
    return null; 
  }
}

async function updateUserKarma(username, delta) {
  try {
    const userRef = Utility.db.collection('users').doc(username);
    await userRef.update({
      karma: Utility.admin.firestore.FieldValue.increment(delta)
    });
    console.log(`User ${username} karma updated by ${delta}.`);
  } catch (error) {
    console.error('Error updating user karma:', error);
    throw error;
  }
}

async function checkUserExist(username) {
  const existingUserSnapshot = await Utility.db.collection('users').doc(username).get();

  if (existingUserSnapshot.exists) {
    console.log(`Username "${username}" is already taken.`);
    return 0;  
  }
  return 1;
}

async function getUserKarma(username) {
  try {
    const userRef = Utility.db.collection('users').doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error(`User ${username} does not exist.`);
    }

    const userData = userDoc.data();
    return userData.karma;  
  } catch (error) {
    console.error('Error fetching user karma:', error);
    throw error;
  }
}


async function getUserBalance(username) {
  try {
    const userRef = Utility.db.collection('users').doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error(`User ${username} does not exist.`);
    }

    const userData = userDoc.data();
    return userData.balance;  
  } catch (error) {
    console.error('Error fetching user karma:', error);
    throw error;
  }
}

async function getUserProducts(username) {
  try {
  
    const productsSnapshot = await Utility.db.collection('products').get();

    if (productsSnapshot.empty) {
      console.log(`No products found for user ${username}.`);
      return [];  
    }

    const userProducts = productsSnapshot.docs
      .filter(doc => doc.id.includes(username))  
      .map(doc => doc.data());  

    return userProducts;  
  } catch (error) {
    console.error('Error fetching user products:', error);
    throw error;
  }
}



const getUnameFromEmail = async (email) => {
  try {
    const usersSnapshot = await Utility.db.collection('users')
      .where('email', '==', email)  
      .limit(1)  
      .get();

    if (usersSnapshot.empty) {
      console.log(`No user found with email: ${email}`);
      return null;  
    }

    const userDoc = usersSnapshot.docs[0];  
    const username = userDoc.data().username;  

    return username; 
  } catch (error) {
    console.error('Error fetching user by email:', error);  
    throw error;  
  }
};



async function getAllProducts() {
  try {
    const productsSnapshot = await Utility.db.collection('products').get();

    if (productsSnapshot.empty) {
      console.log('No products found in the database.');
      return [];  
    }

    const products = productsSnapshot.docs.map(doc => {
      const productData = doc.data();
      return {
        id: doc.id,  
        productName: productData.productName,
        description: productData.description,
        price: productData.price,
        quantity: productData.quantity,
        photos: productData.photos,
        uploadedBy: productData.uploadedBy,
        createdAt: productData.createdAt,
      };
    });

    return products; 
  } catch (error) {
    console.error('Error fetching all products:', error);
    throw error; 
  }
}
/*
function startChat(user1, user2) {
  const chatId = [user1, user2].join('-');

  const chatRef = Utility.realtimeDB.ref(`chats/${chatId}`);

  chatRef.set({
    metadata: {
      users: [user1, user2],
      startedAt: new Date().toISOString()
    }
  });

  return chatId;
}*/
async function startChat(user1, user2) {
  const chatId = [user1, user2].sort().join('-');

  const chatRef = Utility.realtimeDB.ref(`chats/${chatId}`);

  const chatSnapshot = await chatRef.once('value');
  if (chatSnapshot.exists()) {
    console.log(`Chat between ${user1} and ${user2} already exists.`);
    return chatId; 
  }

  await chatRef.set({
    metadata: {
      users: [user1, user2],
      startedAt: new Date().toISOString()
    }
  });

  console.log(`Started a new chat between ${user1} and ${user2}`);
  return chatId;
}


async function sendMessage(sender, receiver, message) {
  const chatId1 = `${sender}-${receiver}`;
  const chatId2 = `${receiver}-${sender}`;

  const chatExists = async (chatId) => {
    const chatRef = Utility.realtimeDB.ref(`chats/${chatId}`);
    const snapshot = await chatRef.once('value');
    return snapshot.exists();
  };

  try {
    let chatId = chatId1;
    if (!(await chatExists(chatId))) {
      chatId = chatId2;
      if (!(await chatExists(chatId))) {
        console.error('No existing chat found for the provided sender and receiver');
        return;
      }
    }

    const messagesRef = Utility.realtimeDB.ref(`chats/${chatId}/messages`);

    const newMessageRef = messagesRef.push(); 

    await newMessageRef.set({
      sender: sender,
      receiver: receiver,
      message: message,
      timestamp: Date.now() 
    });

    console.log('Message sent successfully');
  } catch (error) {
    console.error('Error sending message:', error);
  }
}


function getAllChatMessages(user1, user2, onMessagesUpdate) {
  const chatId1 = `${user1}-${user2}`;
  const chatId2 = `${user2}-${user1}`;

  const chatRef1 = Utility.realtimeDB.ref(`chats/${chatId1}`);
  const chatRef2 = Utility.realtimeDB.ref(`chats/${chatId2}`);

  try {
    chatRef1.once('value', (snapshot) => {
      if (snapshot.exists()) {
        chatRef1.child('messages').once('value', (snapshot) => {
          const messages = snapshot.val() || {};
          onMessagesUpdate(messages);
        });
      } else {
        chatRef2.once('value', (snapshot) => {
          if (snapshot.exists()) {
            chatRef2.child('messages').once('value', (snapshot) => {
              const messages = snapshot.val() || {};
              onMessagesUpdate(messages);
            });
          } else {
            const newChatId = startChat(user1, user2);
            onMessagesUpdate({}); 
          }
        });
      }
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    onMessagesUpdate({ error: 'Error fetching chat messages' });
  }
}



function getUserChats(username, callback) {
  const userChats = {};

  const chatsRef = Utility.realtimeDB.ref('chats');
  
  chatsRef.once('value', (snapshot) => {
    snapshot.forEach((chatSnapshot) => {
      const chatId = chatSnapshot.key;
      const chatData = chatSnapshot.val();
      
const usersInChat = chatId.split('-');

if (usersInChat.includes(username)) {
  const oppositeUser = usersInChat.find(user => user !== username);

  const messages = chatData.messages || {};
  
  let mostRecentMessage = {};
  let mostRecentDate = 0;

  for (const messageId in messages) {
    const message = messages[messageId];
    const messageDate = new Date(message.timestamp).getTime();
    
    if (messageDate > mostRecentDate) {
      mostRecentDate = messageDate;
      mostRecentMessage = message;
    }
  }

  userChats[chatId] = {
    oppositeUser,
    mostRecentMessage: mostRecentMessage.message || '',
    date: mostRecentMessage.timestamp || ''
  };
}

    });

    callback(userChats);
  });
}

async function likeProduct(username, productId, user2) {
  try {
    const productRef = Utility.db.collection('products').doc(productId);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      throw new Error('Product does not exist.');
    }
    
    const productData = productDoc.data();
    const likedBy = productData.likedBy || [];
    const dislikedBy = productData.dislikedBy || [];
    
    if (likedBy.includes(username) || dislikedBy.includes(username)) {
      console.log(`User ${username} has already liked product ${productId}.`);
      return; 
    }

    await productRef.update({
      likedBy: Utility.admin.firestore.FieldValue.arrayUnion(username),
      dislikedBy: Utility.admin.firestore.FieldValue.arrayRemove(username) 
    });

    updateUserKarma(user2, 1);

    console.log(`User ${username} liked product ${productId}.`);
  } catch (error) {
    console.error('Error liking product:', error);
    throw error;
  }
}


async function dislikeProduct(username, productId, user2) {
  try {
    const productRef = Utility.db.collection('products').doc(productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      throw new Error('Product does not exist.');
    }

    const productData = productDoc.data();
    const likedBy = productData.likedBy || [];
    const dislikedBy = productData.dislikedBy || [];

    if (dislikedBy.includes(username) || likedBy.includes(username)) {
      console.log(`User ${username} has already disliked product ${productId}.`);
      return; 
    }

    await productRef.update({
      dislikedBy: Utility.admin.firestore.FieldValue.arrayUnion(username),
      likedBy: Utility.admin.firestore.FieldValue.arrayRemove(username) 
    });

    updateUserKarma(user2, -1);

    console.log(`User ${username} disliked product ${productId}.`);
  } catch (error) {
    console.error('Error disliking product:', error);
    throw error;
  }
}


async function updateBalances(buyerUsername, sellerTotals) {
  try {
    console.log(`Processing payment from buyer ${buyerUsername} for sellers:`, sellerTotals);

    await Promise.all(
      Object.entries(sellerTotals).map(async ([sellerUsername, totalAmount]) => {
        const sellerRef = Utility.db.collection('users').doc(sellerUsername);
        
        await sellerRef.update({
          balance: Utility.admin.firestore.FieldValue.increment(totalAmount) 
        });

        console.log(`Updated balance for seller ${sellerUsername}. Added: ${totalAmount}`);

        const address = await getAddressByUsername(buyerUsername);
        const message = `${buyerUsername} has bought your product(s), please ship it to: ${address}. The next or previous messages will display what to ship.`;

        const chatId = await startChat("SafeHavenTeam", sellerUsername);
        
        await sendMessage("SafeHavenTeam", sellerUsername, message);
      })
    );
  } catch (error) {
    console.error('Error updating balances:', error);
    throw error;
  }
}


async function sendDeliveryInfo(seller,productName,quantity,buyer){
  const address= await getAddressByUsername(buyer)
  await sendMessage("SafeHavenTeam", seller, `Ship/Deliver: ${productName} of quantity ${quantity} to ${buyer} at address ${address} `)
}


module.exports = {
  createUser,
  uploadProduct,
  deleteProduct,
  updateUserKarma,
  getUserKarma,
  getUserProducts,
  getUnameFromEmail,
  getAllProducts,
  getUserBalance,
  startChat,
  sendMessage,
  getAllChatMessages,
  getUserChats,
  likeProduct,
  dislikeProduct,
  updateBalances,
  updateOrDeleteProduct,
  getAddressByUsername,
  sendDeliveryInfo
};
