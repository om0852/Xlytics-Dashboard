const express = require("express");
const { TwitterApi } = require("twitter-api-v2");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Store temporary auth state & verifier (in-memory or DB in prod)
const stateStore = new Map();

// Twitter OAuth2 client
const twitterClient = new TwitterApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
});
app.get("/", (req, res) => {
  res.json("yes i am running");
});
// Step 1: Start login and redirect to Twitter
app.get("/auth/twitter", async (req, res) => {
  const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
    process.env.CALLBACK_URL,
    { scope: ["tweet.read", "users.read", "offline.access"] }
  );

  stateStore.set(state, codeVerifier);
  res.redirect(url);
});
app.get("/api/followers", async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: "Missing token" });

  try {
    const userClient = new TwitterApi(token);
    const user = await userClient.v2.me();

    const followers = await userClient.v2.following(user.data.id, {
      asPaginator: true,
      max_results: 10, // max 1000 with elevated access
      "user.fields": ["name", "username", "profile_image_url"],
    });

    res.json({ followers: followers.data });
  } catch (err) {
    console.error("Fetch followers error:", err);
    res.status(500).json({ error: "Failed to fetch followers" });
  }
});

// Step 2: Twitter redirects back here
app.get("/auth/twitter/callback", async (req, res) => {
  const { state, code } = req.query;
  const codeVerifier = stateStore.get(state);
  if (!codeVerifier) return res.status(400).send("Invalid state");

  try {
    const {
      client: loggedClient,
      accessToken,
      refreshToken,
    } = await twitterClient.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: process.env.CALLBACK_URL,
    });

    const user = await loggedClient.v2.me({
      "user.fields": ["public_metrics","most_recent_tweet_id"],
    });
console.log(user)
    const username = user.data.username;
    const followers = user.data.public_metrics.following_count;

    // ✅ Redirect to local React frontend
    res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?token=${accessToken}&username=${username}&followers=${followers}`
    );
  } catch (err) {
    console.error("Auth failed:", err);
    res.status(500).send("Authentication failed");
  }
});
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
