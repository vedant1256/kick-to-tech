import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import QRCode from 'qrcode';

const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzUj2WBFyRkAE_7ivpFKPlM7SSjOW8PcC2_yP_tfPmYBRpIoMJWpKtxQMuKTSCax59H/exec';
const SECRET = process.env.QR_SIGNING_SECRET || 'kick-to-tech-secret-key-2026-verify';

const canonical = ({ id, name, mobile, email }) => `<kick to tech>|id=${id}|name=${name}|mobile=${mobile || ''}${email ? `|email=${email}` : ''}`;

function getEmailedRecords() {
  try {
    const filePath = path.resolve(process.cwd(), 'src', 'emailed.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function saveEmailedRecords(records) {
  try {
    const filePath = path.resolve(process.cwd(), 'src', 'emailed.json');
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save emailed records:', e);
  }
}

async function sendEmailForUser(user, targetEmail = null) {
  const recipient = (targetEmail || user.email).trim();
  const seatText = user.seat || 'seat number : CC lab , PC number : 001';

  const rawPayload = canonical(user);
  const signature = crypto.createHmac('sha256', SECRET).update(rawPayload).digest('base64url');
  const signedPayload = `${rawPayload}|sig=${signature}`;

  const qrBuffer = await QRCode.toBuffer(signedPayload, { errorCorrectionLevel: 'M', margin: 2, width: 400 });
  const qrBase64 = qrBuffer.toString('base64');

  const subject = `Kick to Tech — Your Refreshment QR Pass & Seating (#${String(user.id).padStart(3, '0')})`;
  const textContent = `Hi ${user.name},\n\nYou have been registered for Kick to Tech.\n\nMember ID: #${String(user.id).padStart(3, '0')}\nFull Name: ${user.name}\nMobile: +91 ${user.mobile}\nEmail: ${user.email}\nSeating Arrangement: ${seatText}\n\nPlease find your official one-time REFRESHMENT QR code attached.\nShow this QR code at the refreshment counter to claim your refreshments.\n\nNote: This QR code is valid for single one-time refreshment access only.\n\n— Kick to Tech Team`;

  const htmlContent = `
<div style="font-family:Arial,sans-serif;background:#f4f6f1;padding:32px 16px;color:#151817">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border-top:8px solid #c8ff3d;box-shadow:0 4px 20px rgba(0,0,0,0.06)">
    <div style="background:#151817;padding:24px 32px">
      <h2 style="color:#ffffff;margin:0;font-size:20px;letter-spacing:1px;font-weight:700">
        KICK TO TECH <span style="color:#c8ff3d">REFRESHMENT PASS</span>
      </h2>
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
        <img src="data:image/png;base64,${qrBase64}" alt="Refreshment QR Code" style="width:240px;height:240px;display:block;margin:0 auto 12px;border-radius:6px;border:1px solid #d9ddd7" />
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

  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: recipient,
      subject,
      text: textContent,
      html: htmlContent
    }),
    redirect: 'follow'
  });

  const data = await res.json().catch(() => ({}));
  return data?.sent || false;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const testIdx = args.indexOf('--test-to');
  const testEmail = testIdx !== -1 ? args[testIdx + 1] : null;

  const people = JSON.parse(fs.readFileSync('./src/people.json', 'utf8'));
  const emailedRecords = getEmailedRecords();
  const emailedSet = new Set(emailedRecords.map(r => r.email.toLowerCase().trim()));

  console.log(`📋 Total attendees in roster: ${people.length}`);
  console.log(`✉️ Previously emailed count: ${emailedSet.size}`);

  if (testEmail) {
    console.log(`🧪 SENDING TEST EMAIL to: ${testEmail}`);
    const sampleUser = people[0];
    console.log(`Using sample participant: ${sampleUser.name} (${sampleUser.id}, ${sampleUser.seat})`);
    const sent = await sendEmailForUser(sampleUser, testEmail);
    console.log(sent ? `✅ Test email successfully delivered to ${testEmail}!` : `❌ Failed to deliver test email.`);
    return;
  }

  let sentCount = 0;
  let skippedCount = 0;
  const newRecords = [...emailedRecords];

  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const emailKey = (p.email || '').toLowerCase().trim();

    if (!emailKey || !emailKey.includes('@')) {
      console.log(`⚠️ [SKIP - NO EMAIL] ${p.id} (${p.name})`);
      continue;
    }

    if (emailedSet.has(emailKey)) {
      console.log(`⏩ [SKIP DUPLICATE] ${p.id} (${p.name}) — Email already sent to ${p.email}`);
      skippedCount++;
      continue;
    }

    if (isDryRun) {
      console.log(`[DRY-RUN WOULD SEND ${sentCount + 1}] ${p.id} (${p.name}) -> ${p.email} | ${p.seat}`);
      emailedSet.add(emailKey);
      sentCount++;
      continue;
    }

    try {
      process.stdout.write(`📤 Sending [${sentCount + 1}] to ${p.name} <${p.email}> (${p.seat})... `);
      const ok = await sendEmailForUser(p);
      if (ok) {
        emailedSet.add(emailKey);
        newRecords.push({ id: p.id, name: p.name, email: p.email, seat: p.seat, sentAt: new Date().toISOString() });
        saveEmailedRecords(newRecords);
        sentCount++;
        console.log('✅ SENT');
      } else {
        console.log('❌ FAILED (Google limit or error)');
      }
      // 800ms cooldown between emails to prevent rate limiting
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
    }
  }

  console.log('\n======================================');
  console.log(`🎉 Batch dispatch complete!`);
  console.log(`✅ Total unique emails sent: ${sentCount}`);
  console.log(`⏩ Duplicate occurrences skipped: ${skippedCount}`);
  console.log('======================================');
}

main().catch(console.error);
