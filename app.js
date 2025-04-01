console.log('Starting the app...');
const express = require('express');
const cors = require('cors');
const { TwitterApi } = require('twitter-api-v2');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3000;

app.use(cors()); // Allow frontend to communicate with backend

// Initialize Twitter client with your app's credentials
const twitterClient = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Root route for the homepage
app.get('/', (req, res) => {
    res.send('Welcome to the Twitter OAuth App! Please connect your Twitter account.');
});

// Route to start Twitter OAuth flow
app.get('/twitter-login', async (req, res) => {
    try {
        const { url, oauth_token, oauth_token_secret } = await twitterClient.generateAuthLink("http://localhost:3000/twitter-callback");
        res.redirect(url);
    } catch (error) {
        console.error("Error generating Twitter auth link:", error);
        res.status(500).send("Error starting Twitter authentication");
    }
});

// Twitter OAuth callback route
app.get('/twitter-callback', async (req, res) => {
    const { oauth_token, oauth_verifier } = req.query;

    if (!oauth_token || !oauth_verifier) {
        return res.status(400).send('Missing oauth_token or oauth_verifier');
    }

    try {
        // Exchange oauth_token and oauth_verifier for access token
        const { client: loggedInClient, accessToken, accessSecret } = await twitterClient.loginWithOAuth1(oauth_token, oauth_verifier);
        
        // Get user details (including username)
        const user = await loggedInClient.v2.me();
        const twitterHandle = user.username;  // This is the Twitter handle

        // Redirect the user back to your frontend, passing the Twitter handle
        res.redirect(`http://localhost:3000?twitterHandle=${twitterHandle}`);
    } catch (error) {
        console.error('Error during Twitter OAuth callback:', error);
        res.status(500).send('Error during Twitter authentication');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
