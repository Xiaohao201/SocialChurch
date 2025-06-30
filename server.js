require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const cors = require('cors');

const app = express();
const port = 3001;

// Your Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error('Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in your .env file');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

// Enable CORS for your React app
app.use(cors({
  origin: 'http://localhost:5173' 
}));

// Endpoint to fetch TURN credentials
app.get('/api/get-turn-credentials', async (req, res) => {
  try {
    // Ask Twilio for a new set of temporary credentials
    const token = await client.tokens.create();
    // Send the credentials back to the frontend
    res.json(token.iceServers);
  } catch (error) {
    console.error('Error fetching TURN credentials from Twilio:', error);
    res.status(500).send('Failed to fetch TURN credentials');
  }
});

app.listen(port, () => {
  console.log(`Twilio token server listening on port ${port}`);
}); 