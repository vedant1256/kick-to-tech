# Kick to Tech — Verify.ID & Refreshment Access System

A modern QR verification, automated seating allocation, and refreshment redemption system built for the Kick to Tech Hackathon.

## 🚀 Features

- **Automated Seating Allocation**: Dynamically assigns participants to labs based on capacity:
  1. **CC lab** (120 capacity) — `001` to `120`
  2. **HPCC lab** (66 capacity) — `001` to `066`
  3. **ERP lab** (60 capacity) — `001` to `060`
  4. **SS1 lab** (40 capacity) — `001` to `040`
- **One-Time QR Refreshment Passes**: Cryptographically signed HMAC-SHA256 QR passes prevent forgery and restrict users to a single refreshment redemption.
- **Automated Email Dispatch**: Sends branded welcome emails containing participant seating details and an inline QR pass. Integrates seamlessly with Google Apps Script (`GmailApp`) and Resend.
- **Double-Scan Prevention**: Instant synchronous camera locking eliminates race conditions and duplicate decodes at high camera frame rates.
- **Real-Time Google Sheets Sync**: Two-way synchronization with Google Sheets for attendee rosters and scan logs.

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, Lucide Icons, jsQR, qrcode, JSZip
- **Backend / APIs**: Node.js Connect middleware (`/api/users`, `/api/verify`, `/api/qr`)
- **Integrations**: Google Sheets, Google Apps Script, Resend API

## 📦 Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vedant1256/kick-to-tech.git
   cd kick-to-tech
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your secrets:
   ```bash
   cp .env.example .env
   ```

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.
