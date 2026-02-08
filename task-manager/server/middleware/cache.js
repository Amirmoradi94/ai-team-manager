/**
 * Cache middleware for HTTP responses
 */

// Cache static resources for 1 year
const cacheStatic = (req, res, next) => {
  if (req.method === 'GET') {
    // Cache static assets for 1 year
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
};

// Cache API responses for a short time
const cacheAPI = (duration = 300) => {
  return (req, res, next) => {
    if (req.method === 'GET') {
      // Cache GET requests for specified duration (default 5 minutes)
      res.set('Cache-Control', `public, max-age=${duration}`);
      res.set('Vary', 'Authorization'); // Vary cache by auth header
    } else {
      // Don't cache non-GET requests
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
  };
};

// Don't cache authenticated requests
const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

module.exports = {
  cacheStatic,
  cacheAPI,
  noCache,
};
