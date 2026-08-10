const crypto = require('crypto');
const { parseMultipart } = require('./_lib/multipart');
const { BUCKET, getSupabase, method, sanitizeApplication, send, validateApplication } = require('./_lib/config');
const { ensureApplicationStorageAndDatabase, insertApplicationWithPostgres } = require('./_lib/setup');

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return resolve(req.body);
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function dataUrlToFile(dataUrl) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  return { fieldname: 'paymentScreenshot', filename: 'payment-screenshot', mimeType, buffer, truncated: false };
}

async function parseSubmission(req) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.toLowerCase().includes('application/json')) {
    const raw = await readRawBody(req);
    const fields = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
    const paymentFile = dataUrlToFile(fields.paymentScreenshotData);
    delete fields.paymentScreenshotData;
    return { fields, files: paymentFile ? [paymentFile] : [] };
  }
  return parseMultipart(req, { fileSize: MAX_FILE_SIZE });
}

async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  let supabase;
  let uploadedFiles = [];
  try {
    const { fields, files } = await parseSubmission(req);
    const row = sanitizeApplication(fields);
    const errors = validateApplication(row, true);
    const payment = files.find(file => file.fieldname === 'paymentScreenshot' && file.buffer.length);
    if (!payment) errors.paymentScreenshot = 'Payment screenshot is required.';
    if (payment) {
      if (!ALLOWED_TYPES.has(payment.mimeType)) errors.paymentScreenshot = 'Only JPG, PNG, WEBP, or PDF files are allowed.';
      if (payment.truncated || payment.buffer.length > MAX_FILE_SIZE) errors.paymentScreenshot = 'File size must be 5 MB or less.';
    }
    if (Object.keys(errors).length) return send(res, 400, { error: 'Please fix the highlighted fields.', errors });

    supabase = getSupabase();
    await ensureApplicationStorageAndDatabase(supabase);
    const reference = `NG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    for (const file of files.filter(f => f.buffer.length)) {
      if (!ALLOWED_TYPES.has(file.mimeType) || file.truncated || file.buffer.length > MAX_FILE_SIZE) continue;
      const path = `${reference}/${file.fieldname}-${crypto.randomUUID()}.${EXT[file.mimeType]}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file.buffer, { contentType: file.mimeType, upsert: false });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      uploadedFiles.push({ field: file.fieldname, path, mimeType: file.mimeType, size: file.buffer.length });
    }
    const applicationRow = { ...row, reference_code: reference, status: 'Pending', files: uploadedFiles };
    const { error } = await supabase.from('applications').insert(applicationRow);
    if (error) {
      console.error('Supabase REST insert failed, trying Postgres fallback:', error);
      try {
        await insertApplicationWithPostgres(applicationRow);
      } catch (fallbackError) {
        if (uploadedFiles.length) await supabase.storage.from(BUCKET).remove(uploadedFiles.map(file => file.path));
        throw new Error(`Insert failed: ${fallbackError.message}`);
      }
    }
    return send(res, 200, { ok: true, reference });
  } catch (error) {
    console.error('submit-application failed:', error);
    const setupProblem = /Missing SUPABASE|Missing POSTGRES|setup failed|Upload failed|Insert failed|Expected multipart|Multipart request|JSON/.test(error.message || '');
    return send(res, 500, { error: setupProblem ? 'Registration backend is not fully configured yet. Please contact the team and ask them to check Supabase table/storage setup.' : 'Your registration could not be saved. Please try again.' });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
