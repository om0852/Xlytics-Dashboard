const express = require('express');
const session = require('express-session');
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const cors = require('cors');
require('dotenv').config();

const app = express();

// Allow React app to access the backend
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Twitter Strategy
passport.use(new TwitterStrategy({
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackURL: process.env.CALLBACK_URL
}, (token, tokenSecret, profile, cb) => {
  profile.token = token;
  profile.tokenSecret = tokenSecret;
  return cb(null, profile);
}));

// Start Auth
app.get('/auth/twitter', passport.authenticate('twitter'));

// Callback
app.get('/auth/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

// User Info
app.get('/api/user', (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Not Authenticated" });
  res.json(req.user);
});

// Tweet Data Example
app.get('/api/tweets', async (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Not Authenticated" });

  const { TwitterApi } = require('twitter-api-v2');

  const client = new TwitterApi({
    appKey: process.env.TWITTER_CONSUMER_KEY,
    appSecret: process.env.TWITTER_CONSUMER_SECRET,
    accessToken: req.user.token,
    accessSecret: req.user.tokenSecret
  });

  try {
    const tweets = await client.v2.userTimeline(req.user.id, {
      'tweet.fields': ['public_metrics', 'created_at'],
      max_results: 10
    });
    res.json(tweets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Twitter API error' });
  }
});

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
