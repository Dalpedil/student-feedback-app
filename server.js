require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Resend } = require('resend');
const path = require('path');

const app = express();

// CRITICAL: Tells Express it is running behind Render's reverse proxy
app.enable('trust proxy');

const resend = new Resend(process.env.RESEND_API_KEY);

// Setup Express Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'feedback-secure-session-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production' // true if using https
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Configure Google Strategy with explicit absolute URL and proxy support
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || "https://student-feedback-app-cwlo.onrender.com/auth/google/callback",
    proxy: true
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));
