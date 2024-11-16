const express = require('express');
const cors = require('cors');
const Utility = require("./Utility/FirebaseUtility")
const bodyParser = require('body-parser');
const multer = require('multer');
const Stripe = require('stripe');
const stripe = Stripe('xxxxxxxxxxxxxxx');







const app = express();

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage(); 
const upload = multer({ storage });


const port = 3400;

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

let sellerTotalsStorage = {};

app.post('/create-checkout-session', async (req, res) => {
  const { cartItems, currentUser } = req.body; 
  console.log("Cart items:", cartItems);
  console.log("Current User:", currentUser);

  const sellerTotals = {};

  cartItems.forEach(item => {
    const { price, quantity, uploadedBy } = item; 

    const itemTotal = price * quantity;

    if (sellerTotals[uploadedBy]) {
      sellerTotals[uploadedBy] += itemTotal; 
    } else {
      sellerTotals[uploadedBy] = itemTotal; 
    }
  });

  sellerTotalsStorage[currentUser] = {
    sellerTotals: sellerTotals,
    buyer: currentUser, 
    cartItems: cartItems 
  };

  const totalPrice = Object.values(sellerTotals).reduce((acc, curr) => acc + curr, 0);

  try {
    const lineItems = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Cart Products', 
          },
          unit_amount: totalPrice * 100, 
        },
        quantity: 1, 
      },
    ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `http://localhost:3400/success?user=${currentUser}`, 
      cancel_url: `http://localhost:3400/cancel?user=${currentUser}`,
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/success', async (req, res) => {
  const currentUser = req.query.user; 
  const sellerData = sellerTotalsStorage[currentUser]; 

  if (sellerData) {
    console.log("Payment successful! Seller totals:", sellerData.sellerTotals);
    console.log("Buyer information:", sellerData.buyer);
    var buyer = sellerData.buyer;

    await Utility.updateBalances(sellerData.buyer, sellerData.sellerTotals);

    await Promise.all(
      Object.entries(sellerData.sellerTotals).map(async ([sellerUsername]) => {
        const cartItems = sellerData.cartItems || [];

        const soldProducts = cartItems.filter(item => item.uploadedBy === sellerUsername);

        await Promise.all(
          soldProducts.map(async (item) => {
            const productName = item.productName;
            const purchasedQuantity = item.quantity; 
            
            await Utility.updateOrDeleteProduct(sellerUsername, productName, purchasedQuantity);
            await Utility.sendDeliveryInfo(sellerUsername,productName,  purchasedQuantity, buyer)
          })
        );
      })
    );

    delete sellerTotalsStorage[currentUser];
  } else {
    console.log("No seller data found for user:", currentUser);
  }

  res.send('Payment successful! Thank you for your purchase. We have sent your address to the seller(s)');
 
});



app.get('/cancel', (req, res) => {
  const currentUser = req.query.user; 
  if (currentUser) {
    delete sellerTotalsStorage[currentUser]; 
    console.log(`Payment canceled for user: ${currentUser}. Seller totals removed.`);
  }

  res.send('Payment canceled. Please try again.');
});


app.get('/signUp', async (req, res) => {
  const inputUserCredentials = req.query;

   const firstName = inputUserCredentials.firstName;

   const lastName = inputUserCredentials.lastName;

   const username = inputUserCredentials.username;

   const email = inputUserCredentials.email;

   const address = inputUserCredentials.address

   const password = inputUserCredentials.password;
 

try{
 
  var resp=  await Utility.createUser(username, email, firstName, lastName, address, password)
 //var resp=  await signup.createUser("iu4rbbppp", "ubcoooveu2bv@gmail.com", "bifbcw", "irb32eib", "uy4rv2uy4rucu")

  if(resp==="username taken"){
    res.send('username is taken')
  }else if(resp=== "email taken"){
    res.send("email taken")
  }else{
    res.send("success!")
  }
}catch(error){
  res.send( error);
}
 
});

app.use(bodyParser.json());

app.post('/uploadProduct', upload.array('photos', 10), async (req, res) => {  
  try {
    const { username, productName, description, price, quantity } = req.body;  
    const photoFiles = req.files;  

    await Utility.uploadProduct(username, productName, description, parseFloat(price), photoFiles, parseInt(quantity));
    res.send(`Product ${productName} uploaded successfully by ${username}.`);
  } catch (error) {
    res.status(500).send(`Error uploading product: ${error.message}`);
  }
});

app.get('/deleteProduct', async (req, res) => {
  try {
    const username = req.query.username
    const productName = req.query.productName
    console.log(username, productName)

    await Utility.deleteProduct(username, productName);
    res.send(`Product ${productName} deleted successfully for user ${username}.`);
  } catch (error) {
    res.status(500).send(`Error deleting product: ${error.message}`);
  }
});

app.get('/updateKarma', async (req, res) => {
  try {
    const { username, delta } = req.query;

    await Utility.updateUserKarma(username, parseInt(delta));
    res.send(`User ${username} karma updated by ${delta}.`);
  } catch (error) {
    res.status(500).send(`Error updating user karma: ${error.message}`);
  }
});


app.get('/getUserKarma', async (req, res) => {
  try {
    const { username } = req.query;
    const karma = await Utility.getUserKarma(username); 
    res.json({ karma });  
  } catch (error) {
    res.status(500).send(`Error fetching user karma: ${error.message}`);
  }
});


app.get('/getUserBalance', async (req, res) => {
  try {
    const { username } = req.query;
    const balance = await Utility.getUserBalance(username); 
    res.json({ balance });  
  } catch (error) {
    res.status(500).send(`Error fetching user balance: ${error.message}`);
  }
});

app.get('/getUserProducts', async (req, res) => {
  try {
    const { username } = req.query;
    const products = await Utility.getUserProducts(username);
    res.json({ products });  
  } catch (error) {
    res.status(500).send(`Error fetching user products: ${error.message}`);
  }
});


app.get('/getUserName', async (req, res) => {
  try {
    const inputUserCredentials = req.query;

    const email = inputUserCredentials.username;
 
    console.log(email, "email here")
    const uname = await Utility.getUnameFromEmail(email); 
    res.json({ uname });  
  } catch (error) {
    res.status(500).send(`Error fetching user name: ${error.message}`);
  }
});

app.get('/products', async (req, res) => {
  try {
    const products = await Utility.getAllProducts();

    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

app.post('/send-message', async (req, res) => {
  const { sender, receiver, message } = req.body;

  try {
    await Utility.sendMessage(sender, receiver, message); 
    res.json({ status: 'Message sent' }); 
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ status: 'Failed to send message' });
  }
});


app.get('/get-messages', async (req, res) => {
  const { user1, user2 } = req.query;

  try {
    Utility.getAllChatMessages(user1, user2, (messages) => {
      res.json(messages);
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});


app.get('/user-chats', (req, res) => {
  const { username } = req.query;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  Utility.getUserChats(username, (chats) => {
    res.json(chats);
  });
});


app.post('/like-product', async (req, res) => {
  const { username, productId , whoUploaded} = req.body;
  console.log(productId, "prodid")
  try {
    await Utility.likeProduct(username, productId, whoUploaded);
    res.status(200).send('Product liked successfully');
  } catch (error) {
    res.status(500).send('Error liking product');
  }
});

app.post('/dislike-product', async (req, res) => {
  const { username, productId, whoUploaded } = req.body;
  try {
    await Utility.dislikeProduct(username, productId,whoUploaded);
    res.status(200).send('Product disliked successfully');
  } catch (error) {
    res.status(500).send('Error disliking product');
  }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);

  
});
