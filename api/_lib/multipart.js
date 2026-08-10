const Busboy = require('busboy');
const { Readable } = require('stream');

function feedBusboy(busboy, req) {
  if (Buffer.isBuffer(req.body)) {
    Readable.from(req.body).pipe(busboy);
    return;
  }
  if (typeof req.body === 'string') {
    Readable.from(Buffer.from(req.body, 'utf8')).pipe(busboy);
    return;
  }
  req.pipe(busboy);
}

function parseMultipart(req, options = {}) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      reject(new Error('Expected multipart/form-data request.'));
      return;
    }

    const fields = {};
    const files = [];
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: options.fileSize || 5 * 1024 * 1024,
        files: options.files || 5,
        fields: options.fields || 80
      }
    });

    busboy.on('field', (name, value) => {
      if (fields[name]) fields[name] = Array.isArray(fields[name]) ? [...fields[name], value] : [fields[name], value];
      else fields[name] = value;
    });

    busboy.on('file', (name, stream, info) => {
      const chunks = [];
      let truncated = false;
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('limit', () => { truncated = true; });
      stream.on('error', reject);
      stream.on('end', () => files.push({
        fieldname: name,
        filename: info.filename,
        mimeType: info.mimeType,
        truncated,
        buffer: Buffer.concat(chunks)
      }));
    });

    busboy.on('error', reject);
    busboy.on('finish', () => resolve({ fields, files }));
    feedBusboy(busboy, req);
  });
}

module.exports = { parseMultipart };
