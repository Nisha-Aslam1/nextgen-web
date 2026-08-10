const Busboy = require('busboy');

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const files = [];
    const busboy = Busboy({ headers: req.headers });
    busboy.on('field', (name, value) => {
      if (fields[name]) fields[name] = Array.isArray(fields[name]) ? [...fields[name], value] : [fields[name], value];
      else fields[name] = value;
    });
    busboy.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => files.push({ fieldname: name, filename: info.filename, mimeType: info.mimeType, buffer: Buffer.concat(chunks) }));
    });
    busboy.on('error', reject);
    busboy.on('finish', () => resolve({ fields, files }));
    req.pipe(busboy);
  });
}

module.exports = { parseMultipart };
