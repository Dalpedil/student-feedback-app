require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Dedicated URL endpoint for students: http://localhost:3000/student
app.get('/student', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

// Configure Nodemailer using your .env credentials
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  }
});

app.post('/submit-feedback', async (req, res) => {
  const { indexNo, studentName, weeks } = req.body;

  let tableRows = '';
  for (let i = 1; i <= 5; i++) {
    const entry = weeks ? weeks[i] : null;
    if (entry) {
      tableRows += `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">Week ${i} (${entry.date})</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${entry.mode}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${entry.comment}</td>
        </tr>
      `;
    }
  }

  const mailOptions = {
    from: `"Student Feedback System" <${process.env.SMTP_EMAIL}>`,
    to: process.env.RECIPIENT_EMAIL,
    subject: `Weekly Feedback Report: ${indexNo} - ${studentName}`,
    html: `
      <h2>Student Weekly Feedback Report</h2>
      <p><strong>Student Index No:</strong> ${indexNo}</p>
      <p><strong>Student Name:</strong> ${studentName}</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Week (Date)</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Contacted Mode</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Comments</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send(`
      <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
        <h2 style="color: green;">Feedback for ${studentName} (${indexNo}) has been submitted and emailed!</h2>
        <a href="/student" style="color: #007bff; text-decoration: none;">Submit Another</a>
      </div>
    `);
  } catch (error) {
    console.error('Mail delivery error:', error);
    res.status(500).send(`
      <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
        <h2 style="color: red;">Failed to send email. Check credentials and server logs.</h2>
        <a href="/student" style="color: #007bff; text-decoration: none;">Try Again</a>
      </div>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));