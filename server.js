require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Resend } = require('resend');
const path = require('path');

const app = express();
app.enable('trust proxy');

const resend = new Resend(process.env.RESEND_API_KEY);

// Setup Express Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'feedback-secure-session-key-2026',
  resave: false,
  saveUninitialized: false
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

const clientID = process.env.GOOGLE_CLIENT_ID || 'missing';
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'missing';

passport.use(new GoogleStrategy({
    clientID: clientID,
    clientSecret: clientSecret,
    callbackURL: process.env.CALLBACK_URL || "https://student-feedback-app-cwlo.onrender.com/auth/google/callback",
    proxy: true
  },
  (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
  }
));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Authentication Middleware Guard
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Login Landing Page
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/student');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Root Route Redirection
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/student');
  } else {
    res.redirect('/login');
  }
});

// Google Authentication Trigger Route
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google Authentication Callback Route
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/student');
  }
);

// Logout Route
app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

// Protected Student Application Route
app.get('/student', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

// Static Assets Middleware
app.use(express.static(path.join(__dirname, 'public')));

// Feedback Submission and Reporting Route
app.post('/submit-feedback', ensureAuthenticated, async (req, res) => {
  const { indexNo, studentName, weeks } = req.body;
  const loggedInEmail = req.user?.emails?.[0]?.value || 'Unknown Email';
  const loggedInName = req.user?.displayName || 'Unknown User';

  // Normalize weeks array handling both 0-indexed structures and object representations
  const weekEntries = Array.isArray(weeks) 
    ? weeks.filter(Boolean) 
    : Object.values(weeks || {});

  let tableRows = '';
  weekEntries.forEach((entry, idx) => {
    if (entry) {
      tableRows += `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${entry.label || 'Week ' + (idx + 1)}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${entry.mode || ''}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${entry.comment || ''}</td>
        </tr>
      `;
    }
  });

  const htmlContent = `
    <h2>Students Weekly Progress - ISRP 2026</h2>
    <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 15px;" />
    
    <div style="background-color: #f1f3f5; padding: 10px 14px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #007bff;">
      <p style="margin: 0; font-size: 14px;"><strong>Submitted by (Logged-in Account):</strong> ${loggedInEmail} (${loggedInName})</p>
    </div>

    <p><strong>Student Index No:</strong> ${indexNo}</p>
    <p><strong>Student Name:</strong> ${studentName}</p>
    
    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Week</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Contacted Mode</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Key Discussions</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;

  try {
    await resend.emails.send({
      from: 'Feedback Portal <onboarding@resend.dev>',
      to: [process.env.RECIPIENT_EMAIL || 'diland@gmail.com'],
      reply_to: loggedInEmail,
      subject: `Weekly Progress: ${indexNo} - ${studentName} (${loggedInEmail})`,
      html: htmlContent
    });

    res.status(200).send(`
      <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
        <h2 style="color: green;">Submission Successful!</h2>
        <p>Progress report for <strong>${studentName} (${indexNo})</strong> has been recorded and emailed.</p>
        <p style="margin-top: 20px;">
          <a href="/student" style="color: #007bff; text-decoration: none; font-weight: bold;">Submit Another</a> | 
          <a href="/logout" style="color: #dc3545; text-decoration: none;">Logout</a>
        </p>
      </div>
    `);
  } catch (error) {
    console.error('Resend delivery error:', error);
    res.status(500).send(`
      <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
        <h2 style="color: red;">Failed to send email. Check Resend logs and API key.</h2>
        <a href="/student" style="color: #007bff; text-decoration: none;">Try Again</a>
      </div>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
