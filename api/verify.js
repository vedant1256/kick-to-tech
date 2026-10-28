import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { google } from 'googleapis';

const json = (res, status, body) => res.status(status).json(body);
const canonical = ({ id, name, mobile, email }) => `<kick to tech>|id=${id}|name=${name}|mobile=${mobile || ''}${email ? `|email=${email}` : ''}`;

const isSigned = (payload, signature) => {
  const secret = process.env.QR_SIGNING_SECRET || 'kick-to-tech-secret-key-2026-verify';
  if (!signature || !payload) return false;
  const unsigned = payload.replace(/\|sig=[^|]*$/, '');
  const expected = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  const bufExpected = Buffer.from(expected);
  const bufSig = Buffer.from(signature);
  if (bufExpected.length !== bufSig.length) return false;
  return crypto.timingSafeEqual(bufExpected, bufSig);
};

function getScans() {
  try {
    const filePath = path.resolve(process.cwd(), 'src', 'scans.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function saveScans(scans) {
  try {
    const filePath = path.resolve(process.cwd(), 'src', 'scans.json');
    fs.writeFileSync(filePath, JSON.stringify(scans, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save scans:', e);
  }
}

function getSheetConfig() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (!raw || !process.env.GOOGLE_SHEET_ID) return null;
  const credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return { sheets: google.sheets({ version: 'v4', auth }), spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${process.env.GOOGLE_SCAN_TAB || 'Scans'}!A:D` };
}

async function sendMail(user, scannedAt) {
  const recipient = process.env.TEST_EMAIL_TO || user.email;
  if (!recipient) return { sent: false, status: 'no-recipient' };

  const subject = 'Kick to Tech Hackathon — Refreshment pass redeemed';
  const text = `Hi ${user.name},\n\nYour Kick to Tech Refreshment QR pass was scanned and verified successfully.\n\nName: ${user.name}\nID: ${user.id}\n${user.seat ? `Seating: ${user.seat}\n` : ''}Mobile: ${user.mobile || 'Not available'}\nVerified at: ${scannedAt}\n\nYour refreshment pass has been redeemed (valid for one scan only).\n\n— Kick to Tech`;
  const html = `<div style="font-family:Arial,sans-serif;background:#f4f6f1;padding:32px;color:#151817"><div style="max-width:560px;margin:auto;background:#fff;padding:32px;border-top:8px solid #c8ff3d"><p style="font-size:12px;letter-spacing:2px;color:#6c756d;font-weight:bold">KICK TO TECH HACKATHON</p><h1 style="font-size:28px;margin:16px 0">Refreshment pass redeemed</h1><p>Hi ${user.name}, your Refreshment QR pass was verified and redeemed successfully.</p><div style="border:1px solid #d9ddd7;padding:18px;margin:24px 0"><p><b>Name:</b> ${user.name}</p><p><b>ID:</b> ${user.id}</p>${user.seat ? `<p><b>Seating:</b> <span style="font-family:monospace;color:#1e40af;font-weight:bold">${user.seat}</span></p>` : ''}<p><b>Mobile:</b> ${user.mobile || 'Not available'}</p><p><b>Redeemed at:</b> ${scannedAt}</p></div><p style="color:#6c756d">This QR was valid for one refreshment scan only and has now been redeemed.</p><p style="color:#7da900;font-weight:bold">— Kick to Tech</p></div></div>`;

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzUj2WBFyRkAE_7ivpFKPlM7SSjOW8PcC2_yP_tfPmYBRpIoMJWpKtxQMuKTSCax59H/exec';
  if (scriptUrl) {
    try {
      const gsRes = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recipient, subject, text, html }),
        redirect: 'follow'
      });
      const gsData = await gsRes.json().catch(() => ({}));
      if (gsData?.sent) return { sent: true, provider: 'google-apps-script' };
    } catch (err) {
      console.warn('Apps Script scan mail warning:', err.message);
    }
  }

  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey) return { sent: false, status: 'not-configured' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Kick to Tech <onboarding@resend.dev>', to: [recipient],
      subject,
      text,
      html
    })
  });
  return { sent: response.ok, status: response.status };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const user = req.body || {};
    if (user.action === 'reset') {
      saveScans([]);
      return json(res, 200, { success: true, message: 'Scan history reset successfully.' });
    }
    if (!user.id || !user.name || !isSigned(user.payload, user.signature)) {
      return json(res, 403, { error: 'This QR was not generated by Kick to Tech Verify.ID.' });
    }

    // 1. Strict One-Time Scan Check: check persistent server storage
    const scans = getScans();
    const prior = scans.find(s => String(s.id) === String(user.id) || (s.signature && s.signature === user.signature));
    if (prior) {
      return json(res, 200, {
        status: 'already-scanned',
        message: 'This ID has already been scanned and verified. Second scan is strictly rejected.',
        scannedAt: prior.scannedAt
      });
    }

    // 2. Check Google Sheets if configured
    const config = getSheetConfig();
    if (config) {
      try {
        const existing = await config.sheets.spreadsheets.values.get({ spreadsheetId: config.spreadsheetId, range: config.range });
        const rows = existing.data.values || [];
        const sheetPrior = rows.slice(1).find(row => String(row[0]) === String(user.id));
        if (sheetPrior) {
          return json(res, 200, {
            status: 'already-scanned',
            message: 'This ID has already been scanned and verified. Second scan is strictly rejected.',
            scannedAt: sheetPrior[3] || sheetPrior[1] || null
          });
        }
      } catch (sheetErr) {
        console.warn('Sheets scan check warning:', sheetErr.message);
      }
    }

    // 3. Mark as scanned IMMEDIATELY to prevent race conditions
    const scannedAt = new Date().toISOString();
    const newScanRecord = {
      id: String(user.id),
      name: String(user.name),
      email: String(user.email || ''),
      mobile: String(user.mobile || ''),
      scannedAt,
      signature: user.signature
    };
    scans.push(newScanRecord);
    saveScans(scans);

    // 4. Record to Google Sheets if configured
    if (config) {
      try {
        await config.sheets.spreadsheets.values.append({
          spreadsheetId: config.spreadsheetId,
          range: config.range,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [[String(user.id), String(user.name), String(user.email || ''), scannedAt]] }
        });
      } catch (sheetAppendErr) {
        console.warn('Sheets append warning:', sheetAppendErr.message);
      }
    }

    // 5. Sync scan to Google Apps Script if configured
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzUj2WBFyRkAE_7ivpFKPlM7SSjOW8PcC2_yP_tfPmYBRpIoMJWpKtxQMuKTSCax59H/exec';
    if (scriptUrl) {
      fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', ...newScanRecord }),
        redirect: 'follow'
      }).catch(() => {});
    }

    // 6. Send one-time confirmation email
    const mail = await sendMail(user, scannedAt);
    return json(res, 200, { status: 'verified', scannedAt, emailSent: mail.sent });
  } catch (error) {
    console.error('verify api error', error);
    return json(res, 500, { error: 'Unable to record this verification.' });
  }
}
