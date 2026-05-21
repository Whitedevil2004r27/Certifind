require('dotenv').config();
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
  const originalLookup = dns.lookup;
  dns.lookup = function(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (hostname && hostname.endsWith('neon.tech')) {
      dns.resolve(hostname, (err, addresses) => {
        if (err || !addresses || !addresses.length) {
          return originalLookup(hostname, options, callback);
        }
        callback(null, addresses[0], 4);
      });
    } else {
      originalLookup(hostname, options, callback);
    }
  };
  console.log('🌐 DNS Lookup monkey-patched to bypass local resolution issues for neon.tech');
} catch (e) {
  console.warn('⚠️ Failed to configure DNS monkey-patch:', e);
}
const express = require('express');
const cors = require('cors');

const coursesRouter = require('./routes/courses');
const platformsRouter = require('./routes/platforms');
const bookmarksRouter = require('./routes/bookmarks');

const app = express();
const PORT = process.env.PORT || 5000;

// Restrict CORS to known origins
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3002')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, same-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin '${origin}' not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Main App Routes
app.use('/api/courses', coursesRouter);
app.use('/api/platforms', platformsRouter);
app.use('/api/bookmarks', bookmarksRouter);



app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'CertiFind API is running perfectly.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
