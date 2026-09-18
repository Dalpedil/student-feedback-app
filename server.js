require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Resend } = require('resend');
const path = require('path');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// Setup Express Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'feedback-secure-session-key',
  resave: false,
  saveUninitialized: false
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Configure Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || "/auth/google/callback"
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

// Landing / Login Page
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/student');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Root URL redirects unauthenticated users to /login, logged-in users to /student
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/student');
  } else {
    res.redirect('/login');
  }
});

// Google Auth Trigger Route
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google Auth Callback Route
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

// Protected Student Application Page
app.get('/student', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Protected Feedback Submission
app.post('/submit-feedback', ensureAuthenticated, async (req, res) => {
  const { indexNo, studentName, weeks } = req.body;

  // Extract authenticated Google account details
  const loggedInEmail = req.user?.emails?.[0]?.value || 'Unknown Email';
  const loggedInName = req.user?.displayName || 'Unknown User';

  let tableRows = '';
  for (let i = 1; i <= 5; i++) {
    const entry = weeks ? weeks[i] : null;
    if (entry) {
      tableRows += `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Week ${i}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${entry.mode}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${entry.comment}</td>
        </tr>
      `;
    }
  }

  const htmlContent = `
    <h2>Student Weekly Feedback Report</h2>
    <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 20px;" />
    
    <div style="background-color: #e8f0fe; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #1a73e8;">
      <p style="margin: 0; font-size: 15px;"><strong>Submitted by (Google Account):</strong> ${loggedInEmail}</p>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #555;"><strong>Google Name:</strong> ${loggedInName}</p>
    </div>

    <p><strong>Student Index No:</strong> ${indexNo}</p>
    <p><strong>Student Name:</strong> ${studentName}</p>
    
    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Week</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Contacted Mode</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Comments</th>
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
      subject: `Weekly Feedback: ${indexNo} - ${studentName} (via ${loggedInEmail})`,
      html: htmlContent
    });

    res.status(200).send(`
      <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
        <h2 style="color: green;">Feedback for ${studentName} (${indexNo}) has been submitted and emailed!</h2>
        <p style="color: #666;">Recorded under Google Account: <strong>${loggedInEmail}</strong></p>
        <p><a href="/student" style="color: #007bff; text-decoration: none;">Submit Another</a> | <a href="/logout" style="color: #dc3545; text-decoration: none;">Logout</a></p>
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
