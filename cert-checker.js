const tls = require('tls');
const { URL } = require('url');
const logger = require('./logger');
const { query } = require('./db');

// Cache for TLS timeout setting
let tlsTimeout = 10000;
let lastSettingsFetch = 0;
const SETTINGS_CACHE_MS = 60000; // Cache for 1 minute

/**
 * Get TLS timeout from system settings
 */
async function getTlsTimeout() {
  const now = Date.now();
  if (now - lastSettingsFetch > SETTINGS_CACHE_MS) {
    try {
      const { rows } = await query("SELECT value FROM system_settings WHERE key = 'tls.timeout'");
      if (rows.length > 0) {
        tlsTimeout = parseInt(rows[0].value) || 10000;
      }
      lastSettingsFetch = now;
    } catch (error) {
      logger.error('Failed to fetch TLS timeout setting', { error: error.message });
    }
  }
  return tlsTimeout;
}

/**
 * Check SSL certificate for a given URL
 * @param {string} urlString - The URL to check
 * @returns {Promise<Object>} Certificate details
 */
async function checkCertificate(urlString) {
  const timeout = await getTlsTimeout();

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
        timeout: timeout
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

      socket.setTimeout(timeout);

    } catch (err) {
      logger.error('Certificate check failed', { error: err.message, url: urlString });
      reject(err);
    }
  });
}

module.exports = { checkCertificate };
