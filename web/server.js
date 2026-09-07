const http = require('http');
const fs = require('fs');
const path = require('path');

const INITIAL_PORT = parseInt(process.env.PORT || '3001', 10);
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // Handle /api/stats endpoint
  if (reqPath === '/api/stats') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      totalSignups: 24,
      maxSpots: 100,
      spotsRemaining: 76,
      percentClaimed: 24,
      isLaunchReady: false,
      isSoldOut: false
    }));
    return;
  }

  // Handle /api/signup endpoint
  if (reqPath === '/api/signup') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      success: true,
      message: 'Spot reserved successfully.',
      stats: {
        totalSignups: 25,
        maxSpots: 100,
        spotsRemaining: 75,
        percentClaimed: 25
      }
    }));
    return;
  }

  // Handle /api/checkout/create-order endpoint
  if (reqPath === '/api/checkout/create-order') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      order_id: 'order_mock_' + Date.now(),
      amount: 2400,
      currency: 'USD',
      mock: true
    }));
    return;
  }

  // Handle /api/verify-payment endpoint
  if (reqPath === '/api/verify-payment') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      success: true,
      verified: true,
      status: 'ACTIVE'
    }));
    return;
  }

  // Handle /api/email verification endpoints
  if (reqPath.startsWith('/api/email/')) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      success: true,
      verified: true
    }));
    return;
  }

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });
      res.end(content);
    }
  });
});

function startServer(port) {
  server.listen(port, () => {
    console.log(`ZeroFeed Web Portal running at http://localhost:${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, attempting port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(INITIAL_PORT);
