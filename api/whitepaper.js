// POST /api/whitepaper
// Captures a whitepaper lead, adds it to the Resend audience, and emails the
// paper. Requires two Vercel environment variables:
//   RESEND_API_KEY      your Resend API key
//   RESEND_AUDIENCE_ID  the audience the contact is added to (optional)
// Optional:
//   LEAD_NOTIFY_TO      address that gets a notification for each download
//   MAIL_FROM           verified sender, e.g. "SignlLabs <hello@signllabs.ai>"

const PAPER_URL = 'https://signllabs.ai/the-answer-economy-signllabs-2026.pdf';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const email = String((body && body.email) || '').trim().toLowerCase();
  const name = String((body && body.name) || '').trim();
  const company = String((body && body.company) || '').trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Nothing configured yet: do not fail the visitor, just say so.
    console.warn('RESEND_API_KEY missing; lead not stored:', email);
    return res.status(202).json({ ok: true, stored: false });
  }

  const from = process.env.MAIL_FROM || 'SignlLabs <hello@signllabs.ai>';
  const audience = process.env.RESEND_AUDIENCE_ID;
  const notify = process.env.LEAD_NOTIFY_TO;
  const auth = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const first = name.split(' ')[0] || '';
  const last = name.split(' ').slice(1).join(' ');
  const jobs = [];

  if (audience) {
    jobs.push(fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ email, first_name: first, last_name: last, unsubscribed: false }),
    }));
  }

  jobs.push(fetch('https://api.resend.com/emails', {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      from, to: [email],
      subject: 'The Answer Economy — your copy',
      html: `<p>${first ? first + ',' : 'Hello,'}</p>
<p>Here is your copy of <strong>The Answer Economy: How AI Decides Which Brands to Recommend</strong>.</p>
<p><a href="${PAPER_URL}">Download the paper (PDF)</a></p>
<p>Every figure in it is timestamped, because the answer engines change monthly. If you want to know
where your own brand sits across ChatGPT, Gemini, Claude, Copilot and Perplexity, reply to this note
and we will run a baseline.</p>
<p>— SignlLabs, the AI Signaling practice of GCW<br><a href="https://signllabs.ai">signllabs.ai</a></p>`,
    }),
  }));

  if (notify) {
    jobs.push(fetch('https://api.resend.com/emails', {
      method: 'POST', headers: auth,
      body: JSON.stringify({
        from, to: [notify],
        subject: `Whitepaper download: ${email}`,
        text: `Name: ${name || '(none)'}\nEmail: ${email}\nCompany: ${company || '(none)'}\nPaper: The Answer Economy 2026`,
      }),
    }));
  }

  try {
    const results = await Promise.allSettled(jobs);
    const failed = results.filter((r) => r.status === 'rejected' || (r.value && !r.value.ok));
    if (failed.length) console.error('resend partial failure', failed.length, 'of', results.length);
    return res.status(200).json({ ok: true, stored: true });
  } catch (err) {
    console.error('whitepaper handler error', err);
    // The page delivers the PDF regardless; never block the download.
    return res.status(202).json({ ok: true, stored: false });
  }
}
