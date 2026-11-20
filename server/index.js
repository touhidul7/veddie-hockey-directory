const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const app = express();
app.disable('x-powered-by');
app.use((req,res,next)=>{
  req.requestId=require('node:crypto').randomUUID();
  res.set('X-Request-ID',req.requestId).set('X-Content-Type-Options','nosniff').set('Referrer-Policy','strict-origin-when-cross-origin').set('X-Frame-Options','DENY');
  if(req.path.startsWith('/api/admin'))res.set('Cache-Control','no-store');
  next();
});
const PORT = process.env.PORT || 3001;

// CORS setup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token']
}));

// Body parsing with sane payload limits (Acceptance A22)
app.use(require('./middleware/rateLimit').submissionRateLimit);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`[${req.method}] ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await require('./db/database').getDb().get('SELECT count(*) FROM rinkcircuit.schema_migrations');
  } catch {
    return res.status(503).json({ status: 'unavailable', service: 'RinkCircuit API', database: 'unavailable' });
  }
  res.json({
    status: 'healthy',
    service: 'RinkCircuit API',
    database: 'postgresql',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/jobs/email', require('./routes/emailJobs'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/leagues', require('./routes/leagues'));
app.use('/api/events', require('./routes/events'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/interests', require('./routes/interests'));
app.use('/api/email-verifications', require('./routes/verifications'));
app.use('/api/listing-requests', require('./routes/listingRequests'));
app.use('/api/admin', require('./routes/admin'));

// Read-only database diagnostics. Full tests run in an isolated schema via npm test.
app.get('/api/admin-tests/run', require('./middleware/adminSession').requireAdmin, async (req, res) => {
  const {getDb} = require('./db/database');
  const tables = [...require('./db/tables.json'), 'admin_sessions'];
  const rows = await getDb().all("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'rinkcircuit'");
  const results = tables.map(name => ({id:name,title:name,passed:rows.some(row => row.tablename===name && row.rowsecurity),details:'Table exists with row-level security enabled'}));
  const passed=results.filter(row=>row.passed).length;
  res.json({total:results.length,passed,allPassed:passed===results.length,results});
});

app.use(require('./routes/seo').router);

// Serve frontend build in production
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {

  app.use(require('./routes/seo').html);
  app.use(express.static(distPath,{index:false}));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.status(404).set('X-Robots-Tag','noindex').type('text/plain').send('Not found');
  });
}

// Global safe error handler (Acceptance A04, A22)
app.use((err, req, res, next) => {
  console.error('[API Error]:', err.code || err.name);
  res.status(err.status || 500).json({
    error: err.status && err.status < 500 ? err.message : 'An unexpected server error occurred.',
    code: err.status&&err.status<500?(err.code||'INVALID_REQUEST'):'INTERNAL_ERROR',request_id:req.requestId
  });
});

if (require.main === module) {
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(PORT, HOST, () => {
    const ips = getLocalIpAddresses();
    console.log(`\n🏒 RinkCircuit Server is LIVE!`);
    console.log(`   ➜  Local:   http://localhost:${PORT}`);
    if (ips.length > 0) {
      ips.forEach(ip => {
        console.log(`   ➜  Network: http://${ip}:${PORT}`);
      });
      console.log(`   💡 Share the Network link with any phone/PC on your Wi-Fi!`);
    }
    console.log('');
  });
}

module.exports = app;
