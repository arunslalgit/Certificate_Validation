const tls = require('tls');
const { URL } = require('url');
const logger = require('./logger');

/**
 * Check SSL certificate for a given URL
 * @param {string} urlString - The URL to check
 * @returns {Promise<Object>} Certificate details
 */
async function checkCertificate(urlString) {
  return new Promise((resolve, reject) => {
    try {
      // Parse URL
      const parsedUrl = new URL(urlString);
      const hostname = parsedUrl.hostname;
      const port = parsedUrl.port || 443;

      logger.info(`Checking certificate for ${hostname}:${port}`);

      const options = {
        host: hostname,
        port: port,
        servername: hostname, // SNI support
        rejectUnauthorized: false, // Accept self-signed and invalid certs
        timeout: 10000
      };

      const socket = tls.connect(options, () => {
        try {
          const cert = socket.getPeerCertificate(true);

          if (!cert || Object.keys(cert).length === 0) {
            socket.destroy();
            return reject(new Error('No certificate found'));
          }

          // Parse dates
          const validFrom = new Date(cert.valid_from);
          const validTo = new Date(cert.valid_to);
          const now = new Date();

          // Calculate days until expiry
          const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

          // Determine status
          let status = 'valid';
          if (daysUntilExpiry < 0) {
            status = 'expired';
          } else if (daysUntilExpiry <= 30) {
            status = 'expiring_soon';
          }

          // Extract Subject Alternate Names (SANs)
          let sans = [];
          if (cert.subjectaltname) {
            sans = cert.subjectaltname
              .split(',')
              .map(s => s.trim())
              .filter(s => s);
          }

          // Extract issuer
          const issuer = cert.issuer ?
            `${cert.issuer.O || ''} ${cert.issuer.CN || ''}`.trim() :
            'Unknown';

          // Extract subject
          const subject = cert.subject ?
            `${cert.subject.CN || hostname}` :
            hostname;

          const result = {
            hostname,
            valid: now >= validFrom && now <= validTo,
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
            daysUntilExpiry,
            issuer,
            subject,
            sans,
            status,
            serialNumber: cert.serialNumber,
            fingerprint: cert.fingerprint
          };

          socket.destroy();
          resolve(result);

        } catch (err) {
          socket.destroy();
          reject(err);
        }
      });

      socket.on('error', (err) => {
        logger.error(`Certificate check error for ${hostname}`, { error: err.message });
        reject(new Error(`Connection failed: ${err.message}`));
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });

      socket.setTimeout(10000);

    } catch (err) {
      logger.error('Certificate check failed', { error: err.message, url: urlString });
      reject(err);
    }
  });
}

module.exports = { checkCertificate };
