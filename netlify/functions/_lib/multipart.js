const Busboy = require('busboy');

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const files = [];
    const headers = event.headers || {};
    const busboy = Busboy({ headers: { 'content-type': headers['content-type'] || headers['Content-Type'] || '' } });
    busboy.on('field', (name, value) => {
      if (fields[name]) fields[name] = Array.isArray(fields[name]) ? [...fields[name], value] : [fields[name], value];
      else fields[name] = value;
    });
    busboy.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', c => chunks.push(c));
      stream.on('limit', () => reject(new Error('Uploaded file is too large.')));
      stream.on('end', () => files.push({ fieldname: name, filename: info.filename, mimeType: info.mimeType, buffer: Buffer.concat(chunks) }));
    });
    busboy.on('error', reject);
    busboy.on('finish', () => resolve({ fields, files }));
    busboy.end(Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8'));
  });
}
module.exports = { parseMultipart };
