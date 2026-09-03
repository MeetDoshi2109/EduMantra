const crypto = require('crypto');

/**
 * Request ID Middleware
 * Ensures every HTTP request has a unique trace ID attached to req.id and response headers.
 */
module.exports = function requestId(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const id = incomingId && typeof incomingId === 'string' && incomingId.length <= 64
    ? incomingId
    : crypto.randomUUID();

  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
};
