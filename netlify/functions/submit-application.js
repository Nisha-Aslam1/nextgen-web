const crypto = require('crypto');
const { parseMultipart } = require('./_lib/multipart');
const { BUCKET, getSupabase, json, sanitizeApplication, validateApplication } = require('./_lib/config');

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const { fields, files } = await parseMultipart(event);
    const row = sanitizeApplication(fields);
    const errors = validateApplication(row, true);
    const payment = files.find(f => f.fieldname === 'paymentScreenshot' && f.buffer.length);
    if (!payment) errors.paymentScreenshot = 'Payment screenshot is required.';
    if (payment) {
      if (!ALLOWED_TYPES.has(payment.mimeType)) errors.paymentScreenshot = 'Only JPG, PNG, WEBP, or PDF files are allowed.';
      if (payment.buffer.length > MAX_FILE_SIZE) errors.paymentScreenshot = 'File size must be 5 MB or less.';
    }
    if (Object.keys(errors).length) return json(400, { error: 'Please fix the highlighted fields.', errors });

    const supabase = getSupabase();
    const reference = `NG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const uploadedFiles = [];
    for (const file of files.filter(f => f.buffer.length)) {
      if (!ALLOWED_TYPES.has(file.mimeType) || file.buffer.length > MAX_FILE_SIZE) continue;
      const path = `${reference}/${file.fieldname}-${crypto.randomUUID()}.${EXT[file.mimeType]}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file.buffer, { contentType: file.mimeType, upsert: false });
      if (error) throw new Error('Upload failed');
      uploadedFiles.push({ field: file.fieldname, path, mimeType: file.mimeType, size: file.buffer.length });
    }

    const { error } = await supabase.from('applications').insert({ ...row, reference_code: reference, status: 'Pending', files: uploadedFiles });
    if (error) throw new Error('Insert failed');
    return json(200, { ok: true, reference });
  } catch (error) {
    console.error(error);
    return json(500, { error: 'Your registration could not be saved. Please try again.' });
  }
};
