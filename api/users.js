import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

const json = (res, status, body) => res.status(status).json(body);
const canonical = ({ id, name, mobile, email }) => `<kick to tech>|id=${id}|name=${name}|mobile=${mobile || ''}${email ? `|email=${email}` : ''}`;

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzUj2WBFyRkAE_7ivpFKPlM7SSjOW8PcC2_yP_tfPmYBRpIoMJWpKtxQMuKTSCax59H/exec';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SMTP_USER = process.env.SMTP_USER || 'vj639143@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'bwpigvvyexzjovil';

let smtpTransporter = null;
if (SMTP_PASS) {
  smtpTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

function getSeatingArrangement(index) {
  const LABS = [
    { name: 'CC lab', capacity: 120 },
    { name: 'HPCC lab', capacity: 66 },
    { name: 'ERP lab', capacity: 60 },
    { name: 'SS1 lab', capacity: 40 }
  ];

  let currentCapacitySum = 0;
  for (const lab of LABS) {
    if (index < currentCapacitySum + lab.capacity) {
      const pc = index - currentCapacitySum + 1;
      const pcStr = String(pc).padStart(3, '0');
      return {
        lab: lab.name,
        pc: pcStr,
        text: `seat number : ${lab.name} , PC number : ${pcStr}`
      };
    }
    currentCapacitySum += lab.capacity;
  }

  const overflowPc = index - currentCapacitySum + 41;
  const pcStr = String(overflowPc).padStart(3, '0');
  return {
    lab: 'SS1 lab',
    pc: pcStr,
    text: `seat number : SS1 lab , PC number : ${pcStr}`
  };
}

function getEmailedRecords() {
  try {
    const filePath = path.resolve(process.cwd(), 'src', 'emailed.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function saveEmailedRecord(record) {
  try {
    const filePath = path.resolve(process.cwd(), 'src', 'emailed.json');
    const records = getEmailedRecords();
    records.push(record);
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save emailed record:', e);
  }
}

async function sendUserWelcomeEmail(user) {
  if (!user.email || !user.email.includes('@')) {
    return { sent: false, reason: 'No valid email provided' };
  }

  try {
    const secret = process.env.QR_SIGNING_SECRET || 'kick-to-tech-secret-key-2026-verify';
    const rawPayload = canonical(user);
    const signature = crypto.createHmac('sha256', secret).update(rawPayload).digest('base64url');
    const signedPayload = `${rawPayload}|sig=${signature}`;

    const qrBuffer = await QRCode.toBuffer(signedPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400
    });
    const qrBase64 = qrBuffer.toString('base64');
    const recipient = user.email.trim();
    const seatText = user.seat || 'seat number : CC lab , PC number : 001';

    const subject = `Kick to Tech — Your Refreshment QR Pass & Seating (#${String(user.id).padStart(3, '0')})`;
    const textContent = `Hi ${user.name},\n\nYou have been registered for Kick to Tech.\n\nMember ID: #${String(user.id).padStart(3, '0')}\nFull Name: ${user.name}\nMobile: +91 ${user.mobile}\nEmail: ${user.email}\nSeating Arrangement: ${seatText}\n\nPlease find your official one-time REFRESHMENT QR code attached.\nShow this QR code at the refreshment counter to claim your refreshments.\n\nNote: This QR code is valid for single one-time refreshment access only.\n\n— Kick to Tech Team`;

    const htmlContent = `
<div style="font-family:Arial,sans-serif;background:#f4f6f1;padding:32px 16px;color:#151817">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border-top:8px solid #c8ff3d;box-shadow:0 4px 20px rgba(0,0,0,0.06)">
    <div style="background:#151817;padding:36px 32px;text-align:center;border-bottom:4px solid #c8ff3d">
      <h1 style="color:#ffffff;margin:0 0 6px 0;font-size:36px;letter-spacing:3px;font-weight:900;text-transform:uppercase">
        KICK TO TECH
      </h1>
      <p style="color:#c8ff3d;margin:0;font-size:14px;letter-spacing:3px;font-weight:bold;text-transform:uppercase">
        HACKATHON • REFRESHMENT PASS
      </p>
    </div>
    <div style="padding:32px">
      <p style="font-size:11px;letter-spacing:2px;color:#6c756d;font-weight:bold;margin:0 0 8px;text-transform:uppercase">ONE-TIME REFRESHMENT PASS</p>
      <h1 style="font-size:26px;color:#151817;margin:0 0 16px;font-weight:700">Welcome, ${user.name}!</h1>
      <p style="color:#4a524a;line-height:1.6;font-size:15px;margin:0 0 20px">
        You have been registered for Kick to Tech. Below is your assigned laboratory seating arrangement and your official QR code for <strong>refreshments</strong>.
      </p>

      <div style="background:#eef4ff;border:1px solid #bfdbfe;border-left:5px solid #2563eb;padding:16px 20px;border-radius:6px;margin-bottom:24px">
        <p style="margin:0 0 4px 0;font-size:11px;font-weight:bold;color:#1e40af;letter-spacing:1.5px;text-transform:uppercase">SEATING ARRANGEMENT</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#1e3a8a;font-family:'Courier New',Courier,monospace">
          ${seatText}
        </p>
      </div>

      <div style="text-align:center;background:#f9fbf7;padding:24px;border:1px solid #e4e8e1;border-radius:8px;margin-bottom:24px">
        <img src="cid:refreshmentqr@kicktotech" alt="Refreshment QR Code" style="width:240px;height:240px;display:block;margin:0 auto 12px;border-radius:6px;border:1px solid #d9ddd7" />
        <span style="font-size:12px;color:#6c756d;font-weight:600;letter-spacing:1px">SCAN ONLY AT REFRESHMENT COUNTER</span>
      </div>

      <div style="background:#ffffff;border:1px solid #e4e8e1;border-radius:8px;padding:18px;margin-bottom:24px">
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr><td style="color:#6c756d;padding:6px 0;width:120px;font-weight:600">Member ID:</td><td style="color:#151817;font-weight:700">#${String(user.id).padStart(3, '0')}</td></tr>
          <tr><td style="color:#6c756d;padding:6px 0;font-weight:600">Full Name:</td><td style="color:#151817;font-weight:600">${user.name}</td></tr>
          <tr><td style="color:#6c756d;padding:6px 0;font-weight:600">Seating:</td><td style="color:#1e40af;font-weight:700;font-family:monospace">${seatText}</td></tr>
          <tr><td style="color:#6c756d;padding:6px 0;font-weight:600">Mobile:</td><td style="color:#151817">+91 ${user.mobile}</td></tr>
          <tr><td style="color:#6c756d;padding:6px 0;font-weight:600">Email:</td><td style="color:#151817">${user.email}</td></tr>
        </table>
      </div>

      <div style="background:#f0fae6;border-left:4px solid #7da900;padding:12px 16px;border-radius:4px;margin-bottom:16px">
        <p style="margin:0;font-size:13px;color:#2c4004;line-height:1.5">
          🍿 <strong>Refreshment Notice:</strong> This QR code is strictly for your refreshment access. It is valid for a single scan only and will expire immediately once scanned.
        </p>
      </div>
    </div>
    <div style="background:#f4f6f1;padding:16px 32px;font-size:12px;color:#7c857d;text-align:center;border-top:1px solid #e4e8e1">
      KICK TO TECH REFRESHMENT & SEATING SYSTEM • BUILD WHAT'S NEXT
    </div>
  </div>
</div>
`;

    // 1. Direct Gmail SMTP (if App Password configured)
    if (smtpTransporter) {
      try {
        await smtpTransporter.sendMail({
          from: `"Kick To Tech" <${SMTP_USER}>`,
          to: recipient,
          subject,
          text: textContent,
          html: htmlContent,
          attachments: [
            {
              filename: 'refreshment-qr.png',
              content: qrBuffer,
              cid: 'refreshmentqr@kicktotech'
            }
          ]
        });
        saveEmailedRecord({ id: user.id, name: user.name, email: recipient, seat: seatText, sentAt: new Date().toISOString() });
        return { sent: true, provider: 'smtp-gmail', seat: seatText };
      } catch (smtpErr) {
        console.warn('Gmail SMTP error, falling back to Apps Script:', smtpErr.message);
      }
    }

    // 2. Fallback: Google Apps Script Web App
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL;
    if (scriptUrl) {
      try {
        const gsRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'addUser',
            id: user.id,
            name: user.name,
            mobile: user.mobile,
            email: recipient,
            seat: seatText,
            subject,
            text: textContent,
            html: htmlContent,
            qrBase64
          }),
          redirect: 'follow'
        });
        const gsData = await gsRes.json().catch(() => ({}));
        if (gsData?.sent) {
          saveEmailedRecord({ id: user.id, name: user.name, email: recipient, seat: seatText, sentAt: new Date().toISOString() });
          return { sent: true, provider: 'google-apps-script', seat: seatText };
        }
      } catch (gsErr) {
        console.warn('Google Apps Script mail warning:', gsErr.message);
      }
    }

    // 2. Secondary fallback: Resend
    const apiKey = process.env.RESEND_API_KEY || RESEND_API_KEY;
    if (apiKey) {
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'Kick to Tech <onboarding@resend.dev>';
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipient],
          subject,
          text: textContent,
          html: htmlContent,
          attachments: [
            {
              filename: `verify-id-${user.id}.png`,
              content: qrBase64,
              content_id: 'qrcode'
            }
          ]
        })
      });

      const resData = await response.json().catch(() => ({}));
      if (response.ok) {
        saveEmailedRecord({ id: user.id, name: user.name, email: recipient, seat: seatText, sentAt: new Date().toISOString() });
        return { sent: true, id: resData.id, provider: 'resend', seat: seatText };
      }
      return { sent: false, error: resData?.message || 'Email delivery failed' };
    }

    return { sent: false, error: 'No email delivery provider configured' };
  } catch (err) {
    console.error('sendUserWelcomeEmail error:', err);
    return { sent: false, error: err.message };
  }
}

function getLocalPeople() {
  try {
    const filePath = path.resolve(process.cwd(), 'src', 'people.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function saveLocalPeople(people) {
  const filePath = path.resolve(process.cwd(), 'src', 'people.json');
  fs.writeFileSync(filePath, JSON.stringify(people, null, 2), 'utf8');
}

function getConfig() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (!raw || !process.env.GOOGLE_SHEET_ID) return null;
  const credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return { sheets: google.sheets({ version: 'v4', auth }), spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${process.env.GOOGLE_SHEET_TAB || 'Sheet1'}!A:E` };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const config = getConfig();
    if (!config) {
      if (req.method === 'GET') {
        const scriptUrl = process.env.GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL;
        if (scriptUrl) {
          try {
            const gsRes = await fetch(scriptUrl, { method: 'GET', redirect: 'follow' });
            const gsData = await gsRes.json().catch(() => ({}));
            if (Array.isArray(gsData?.users) && gsData.users.length) {
              const mappedUsers = gsData.users.map((u, idx) => {
                const rawName = String(u.name || '');
                const rawMobile = String(u.mobile || '');
                const rawSeat = String(u.seat || '');
                const realName = /[a-zA-Z]/.test(rawMobile) ? rawMobile : rawName;
                const realMobile = /^[+0-9]/.test(rawSeat) ? rawSeat : rawMobile;
                const seating = getSeatingArrangement(idx);
                return {
                  id: String(u.id || `KTT${String(idx + 1).padStart(2, '0')}`),
                  name: realName,
                  mobile: realMobile,
                  email: String(u.email || '').trim(),
                  seat: seating.text,
                  lab: seating.lab,
                  pc: seating.pc,
                  appId: rawName
                };
              });
              saveLocalPeople(mappedUsers);
              return json(res, 200, { users: mappedUsers, columns: ['id', 'name', 'mobile', 'email', 'seat'] });
            }
          } catch (gsErr) {
            console.warn('Apps Script GET error, falling back to local:', gsErr.message);
          }
        }
        const users = getLocalPeople();
        return json(res, 200, { users, columns: ['id', 'name', 'mobile', 'email', 'seat'] });
      }
      if (req.method === 'POST') {
        const { id, name, mobile, email } = req.body || {};
        if (!String(id || '').trim() || !String(name || '').trim() || !String(mobile || '').trim()) {
          return json(res, 400, { error: 'ID, name, and mobile are required.' });
        }

        const cleanEmail = String(email || '').trim().toLowerCase();
        const users = getLocalPeople();
        const emailedRecords = getEmailedRecords();

        // One email rule: Has this email address already received an email pass?
        const emailAlreadyMailed = (cleanEmail && cleanEmail.includes('@')) && (
          emailedRecords.some(r => r.email && r.email.trim().toLowerCase() === cleanEmail) ||
          users.some(u => u.email && u.email.trim().toLowerCase() === cleanEmail)
        );

        // Calculate seating arrangement based on sequence index
        const seating = getSeatingArrangement(users.length);

        const newUser = {
          id: String(id).trim(),
          name: String(name).trim(),
          mobile: String(mobile).trim(),
          email: String(email || '').trim(),
          seat: seating.text,
          lab: seating.lab,
          pc: seating.pc
        };
        users.push(newUser);
        saveLocalPeople(users);

        let mailResult;
        if (emailAlreadyMailed) {
          mailResult = { sent: false, skipped: true, reason: 'This email address has already received a refreshment pass. No duplicate email sent.' };
        } else {
          mailResult = await sendUserWelcomeEmail(newUser);
        }

        return json(res, 201, { user: newUser, mail: mailResult });
      }
      return json(res, 405, { error: 'Method not allowed.' });
    }

    if (req.method === 'GET') {
      const result = await config.sheets.spreadsheets.values.get({ spreadsheetId: config.spreadsheetId, range: config.range });
      const [header, ...rows] = result.data.values || [];
      const users = rows.filter(row => row[0] && row[1] && row[2]).map((row, idx) => {
        const seatInfo = row[4] || getSeatingArrangement(idx).text;
        return {
          id: String(row[0]),
          name: String(row[1]),
          mobile: String(row[2]),
          email: String(row[3] || ''),
          seat: seatInfo
        };
      });
      return json(res, 200, { users, columns: header || ['id', 'name', 'mobile', 'email', 'seat'] });
    }

    if (req.method === 'POST') {
      const { id, name, mobile, email } = req.body || {};
      if (!String(id || '').trim() || !String(name || '').trim() || !String(mobile || '').trim()) return json(res, 400, { error: 'ID, name, and mobile are required.' });
      const existing = await config.sheets.spreadsheets.values.get({ spreadsheetId: config.spreadsheetId, range: config.range });
      const totalRows = (existing.data.values || []).length;
      const seating = getSeatingArrangement(Math.max(0, totalRows - 1));

      await config.sheets.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: config.range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [[String(id).trim(), String(name).trim(), String(mobile).trim(), String(email || '').trim(), seating.text]] }
      });
      const newUser = { id: String(id).trim(), name: String(name).trim(), mobile: String(mobile).trim(), email: String(email || '').trim(), seat: seating.text };
      const mailResult = await sendUserWelcomeEmail(newUser);
      return json(res, 201, { user: newUser, mail: mailResult });
    }

    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('users api error', error);
    return json(res, 500, { error: 'Unable to access the private user data store.' });
  }
}
