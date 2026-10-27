import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  if (!process.env.QR_SIGNING_SECRET) {
    process.env.QR_SIGNING_SECRET = 'kick-to-tech-secret-key-2026-verify';
  }

  return {
    plugins: [
      react(),
      {
        name: 'api-serverless-routes',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url || !req.url.startsWith('/api/')) {
              return next();
            }

            const urlPath = req.url.split('?')[0];

            res.status = function (code) {
              this.statusCode = code;
              return this;
            };

            res.json = function (data) {
              this.setHeader('Content-Type', 'application/json');
              this.end(JSON.stringify(data));
              return this;
            };

            if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
              const chunks = [];
              for await (const chunk of req) {
                chunks.push(chunk);
              }
              const rawBody = Buffer.concat(chunks).toString('utf8');
              try {
                req.body = rawBody ? JSON.parse(rawBody) : {};
              } catch {
                req.body = {};
              }
            } else {
              req.body = {};
            }

            try {
              const ts = Date.now();
              if (urlPath === '/api/qr') {
                const { default: handler } = await import(new URL(`./api/qr.js?t=${ts}`, import.meta.url).href);
                return await handler(req, res);
              }
              if (urlPath === '/api/verify') {
                const { default: handler } = await import(new URL(`./api/verify.js?t=${ts}`, import.meta.url).href);
                return await handler(req, res);
              }
              if (urlPath === '/api/users') {
                const { default: handler } = await import(new URL(`./api/users.js?t=${ts}`, import.meta.url).href);
                return await handler(req, res);
              }
            } catch (err) {
              console.error('API Error:', err);
              return res.status(500).json({ error: err.message });
            }

            next();
          });
        }
      }
    ]
  };
});
