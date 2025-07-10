const express = require('express');
const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Store temporary auth state & verifier (in-memory or DB in prod)
const stateStore = new Map();

// Twitter OAuth2 client
const twitterClient = new TwitterApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
});
app.get("/",(req,res)=>{
    res.json("yes i am running")
})
// Step 1: Start login and redirect to Twitter
app.get('/auth/twitter', async (req, res) => {
  const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
    process.env.CALLBACK_URL,
    { scope: ['tweet.read', 'users.read', 'offline.access'] }
  );

  stateStore.set(state, codeVerifier);
  res.redirect(url);
});

// Step 2: Twitter redirects back here
app.get('/auth/twitter/callback', async (req, res) => {
  const { state, code } = req.query;

  const codeVerifier = stateStore.get(state);
  if (!codeVerifier) return res.status(400).send('Invalid state');

  try {
    const {
      client: loggedClient,
      accessToken,
      refreshToken,
      expiresIn,
    } = await twitterClient.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: process.env.CALLBACK_URL,
    });

    const user = await loggedClient.v2.me();

    // In production: save tokens in DB or session
    return res.json({
      user,
      accessToken,
      refreshToken,
      expiresIn,
    });
  } catch (error) {
    console.error('OAuth2 login error:', error);
    return res.status(500).json({ error: 'Twitter login failed' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
