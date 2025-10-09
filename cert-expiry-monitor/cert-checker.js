const { URL } = require('url');
const tls = require('tls');

function parseSubjectAltName(sanString = '') {
  if (!sanString) return [];
  return sanString
    .split(',')
    .map((entry) => entry.trim())
    .map((entry) => entry.replace(/^DNS:/i, ''))
    .filter(Boolean);
}

function determineStatus(daysUntilExpiry) {
  if (Number.isNaN(daysUntilExpiry)) {
    return 'error';
  }
  if (daysUntilExpiry < 0) {
    return 'expired';
  }
  if (daysUntilExpiry <= 30) {
    return 'expiring_soon';
  }
  return 'valid';
}

async function checkCertificate(targetUrl) {
  if (!targetUrl) {
    throw new Error('URL is required');
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (error) {
    throw new Error('Invalid URL');
  }

  const hostname = parsed.hostname;
  const port = parsed.port ? Number(parsed.port) : 443;

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are supported');
  }

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          if (!cert || Object.keys(cert).length === 0) {
            throw new Error('No certificate information available');
          }

          const validTo = new Date(cert.valid_to);
          const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
          const now = new Date();
          const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));
          const sans = parseSubjectAltName(cert.subjectaltname);
          const status = determineStatus(daysUntilExpiry);

          resolve({
            hostname,
            port,
            valid: status !== 'expired' && status !== 'error',
            validFrom: validFrom ? validFrom.toISOString() : null,
            validTo: validTo.toISOString(),
            daysUntilExpiry,
            issuer: cert.issuer && cert.issuer.O ? cert.issuer.O : cert.issuer?.CN || 'Unknown',
            subject: cert.subject,
            sans,
            status
          });
        } catch (err) {
          reject(err);
        } finally {
          socket.end();
        }
      }
    );

    socket.setTimeout(10000, () => {
      socket.destroy();
      reject(new Error('TLS connection timed out'));
    });

    socket.on('error', (error) => {
      reject(new Error(`TLS connection failed: ${error.message}`));
    });
  });
}

module.exports = { checkCertificate };
