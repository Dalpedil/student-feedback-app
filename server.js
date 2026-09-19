// Feedback Submission Route
app.post('/submit-feedback', ensureAuthenticated, async (req, res) => {
  const { indexNo, studentName, weeks } = req.body;
  const loggedInEmail = req.user?.emails?.[0]?.value || 'Unknown Email';
  const loggedInName = req.user?.displayName || 'Unknown User';

  // Normalize weeks into a clean array regardless of indexing
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
      to: ['diland@gmail.com'],
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
