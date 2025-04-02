console.log('Starting the app...');
const express = require('express');
const cors = require('cors');
const { TwitterApi } = require('twitter-api-v2');
const dotenv = require('dotenv');
const { ethers } = require('ethers');

dotenv.config();

const app = express();
const port = 3000;

app.use(cors()); // Allow frontend to communicate with backend

// Initialize Twitter client
const twitterClient = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Blockchain setup
const provider = new ethers.providers.JsonRpcProvider('https://testnet-rpc.monad.xyz'); // Corrected line
const contractAddress = "0x1fA8743516535BD2966B2cEC12Cf0f82E3E5566d";
const contractABI = [
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "twitterHandle",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "balance",
				"type": "uint256"
			}
		],
		"name": "LeaderboardUpdated",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "twitterHandle",
				"type": "string"
			}
		],
		"name": "setTwitterHandle",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "twitterHandle",
				"type": "string"
			}
		],
		"name": "TwitterHandleSet",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "updateLeaderboard",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getLeaderboard",
		"outputs": [
			{
				"components": [
					{
						"internalType": "address",
						"name": "user",
						"type": "address"
					},
					{
						"internalType": "string",
						"name": "twitterHandle",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "balance",
						"type": "uint256"
					}
				],
				"internalType": "struct MONsterBoard.LeaderboardEntry[]",
				"name": "",
				"type": "tuple[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			}
		],
		"name": "getUserRank",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "leaderboard",
		"outputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "twitterHandle",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "balance",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "leaderboardRefreshInterval",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "userBalances",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "userLastClaimed",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "userTwitterHandles",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];
const contract = new ethers.Contract(contractAddress, contractABI, provider);

// Root route
app.get('/', (req, res) => {
    res.send('Welcome to the Twitter OAuth App! Please connect your Twitter account.');
});

// Twitter OAuth flow
app.get('/twitter-login', async (req, res) => {
    try {
        const { url } = await twitterClient.generateAuthLink(
            "https://monsterboard.onrender.com/twitter-callback",
            { linkMode: 'authorize' }
        );
        res.redirect(url);
    } catch (error) {
        console.error("Error generating Twitter auth link:", error);
        res.status(500).send("Error starting Twitter authentication: ${error.message}");
    }
});

// Twitter callback
app.get('/twitter-callback', async (req, res) => {
    const { oauth_token, oauth_verifier } = req.query;

    if (!oauth_token || !oauth_verifier) {
        return res.status(400).send('Missing oauth_token or oauth_verifier');
    }

    try {
        const { client: loggedInClient } = await twitterClient.loginWithOAuth1(oauth_token, oauth_verifier);
        const user = await loggedInClient.v2.me();
        const twitterHandle = user.username;

        res.redirect(`https://monsterboard.onrender.com/?twitterHandle=${twitterHandle}`);
    } catch (error) {
        console.error('Error during Twitter OAuth callback:', error);
        res.status(500).send('Error during Twitter authentication');
    }
});

// Fetch MON balance
app.get('/get-balance/:wallet', async (req, res) => {
    try {
        const walletAddress = req.params.wallet;
        const balance = await contract.balanceOf(walletAddress);
        res.json({ wallet: walletAddress, balance: balance.toString() });
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).send('Error fetching balance');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on https://monsterboard.onrender.com`);
});
