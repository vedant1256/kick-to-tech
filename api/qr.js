import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const json = (res, status, body) => res.status(status).json(body);
const canonical = ({ id, name, mobile, email }) => `<kick to tech>|id=${id}|name=${name}|mobile=${mobile || ''}${email ? `|email=${email}` : ''}`;

function getPeople() {
  try {
    const filePath = path.resolve(process.cwd(), 'src', 'people.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  if (!process.env.QR_SIGNING_SECRET) return json(res, 503, { error: 'QR signing is not configured.' });
  const { id } = req.body || {};
  const people = getPeople();
  const user = people.find(person => String(person.id) === String(id));
  if (!user) return json(res, 404, { error: 'User not found.' });
  const payload = canonical(user);
  const signature = crypto.createHmac('sha256', process.env.QR_SIGNING_SECRET).update(payload).digest('base64url');
  return json(res, 200, { payload: `${payload}|sig=${signature}` });
}
