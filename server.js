import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncAndMailNew } from './send-all-passes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API route handlers
app.all('/api/users', async (req, res) => {
  try {
    const mod = await import('./api/users.js');
    await mod.default(req, res);
  } catch (err) {
    console.error('API /users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.all('/api/verify', async (req, res) => {
  try {
    const mod = await import('./api/verify.js');
    await mod.default(req, res);
  } catch (err) {
    console.error('API /verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.all('/api/qr', async (req, res) => {
  try {
    const mod = await import('./api/qr.js');
    await mod.default(req, res);
  } catch (err) {
    console.error('API /qr error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve frontend static assets from dist/
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback all navigation routes to index.html for SPA
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kick to Tech server running on port ${PORT}`);
  // Automatically check Google Sheet and email new participants every 30 seconds
  syncAndMailNew();
  setInterval(syncAndMailNew, 30000);
});
