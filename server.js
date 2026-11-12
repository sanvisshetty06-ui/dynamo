// server.js - QuickBite Canteen Backend Server & REST API
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const db = require('./database.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

/**
 * Standard CORS and JSON response helper
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

/**
 * Read request JSON body safely
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Serve static frontend files
 */
function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(content);
  });
}

// Create HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  try {
    // ---------------- API ROUTES ----------------

    // 1. GET /api/menu - Get menu items (optional: ?category=Meals)
    if (pathname === '/api/menu' && method === 'GET') {
      const category = parsedUrl.searchParams.get('category') || null;
      const items = db.getMenuItems(category);
      sendJson(res, 200, { success: true, count: items.length, data: items });
      return;
    }

    // 2. POST /api/orders - Place a new pre-order
    if (pathname === '/api/orders' && method === 'POST') {
      const body = await readJsonBody(req);
      const { 
        studentName, 
        studentId, 
        pickupTime, 
        items,
        paymentMethod,
        paymentStatus,
        discountCode,
        discountAmount 
      } = body;

      if (!studentName || !studentId || !pickupTime || !items || !items.length) {
        sendJson(res, 400, {
          success: false,
          error: 'Please provide studentName, studentId, pickupTime, and a non-empty items array.'
        });
        return;
      }

      const order = db.createOrder({ 
        studentName, 
        studentId, 
        pickupTime, 
        items,
        paymentMethod: paymentMethod || 'UPI',
        paymentStatus: paymentStatus || 'Paid',
        discountCode: discountCode || '',
        discountAmount: discountAmount || 0
      });
      sendJson(res, 201, {
        success: true,
        message: 'Pre-order placed successfully!',
        order
      });
      return;
    }

    // 2b. POST /api/coupons/validate - Validate promo code
    if (pathname === '/api/coupons/validate' && method === 'POST') {
      const body = await readJsonBody(req);
      const code = (body.code || '').trim().toUpperCase();
      const cartTotal = Number(body.cartTotal) || 0;

      let valid = false;
      let discount = 0;
      let message = 'Invalid promo code.';

      if (code === 'CAMPUS20') {
        valid = true;
        discount = Math.round(cartTotal * 0.20);
        message = `20% Campus Discount applied! You saved ₹${discount}`;
      } else if (code === 'QUICKBITE') {
        if (cartTotal >= 80) {
          valid = true;
          discount = 25;
          message = `₹25 QuickBite discount applied!`;
        } else {
          message = `Promo code QUICKBITE requires a minimum order of ₹80.`;
        }
      } else if (code === 'STUDENT10') {
        valid = true;
        discount = Math.round(cartTotal * 0.10);
        message = `10% Student Discount applied! You saved ₹${discount}`;
      }

      if (valid) {
        sendJson(res, 200, {
          success: true,
          valid: true,
          code,
          discountAmount: discount,
          newTotal: Math.max(0, cartTotal - discount),
          message
        });
      } else {
        sendJson(res, 400, { success: false, valid: false, message });
      }
      return;
    }

    // 2c. POST /api/orders/:token/cancel - Cancel order (Feature 3)
    if (pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/) && method === 'POST') {
      const match = pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/);
      const token = decodeURIComponent(match[1]).trim();
      const cancelled = db.cancelOrder(token);
      sendJson(res, 200, { success: true, message: 'Order cancelled successfully', order: cancelled });
      return;
    }

    // 2d. Reviews endpoints (Feature 4)
    if (pathname === '/api/reviews' && method === 'GET') {
      const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 10;
      const reviews = db.getReviews(limit);
      sendJson(res, 200, { success: true, data: reviews });
      return;
    }

    if (pathname === '/api/reviews' && method === 'POST') {
      const body = await readJsonBody(req);
      const review = db.addReview(body);
      sendJson(res, 201, { success: true, message: 'Thank you for your rating!', review });
      return;
    }

    // 3. GET /api/orders - List recent orders
    if (pathname === '/api/orders' && method === 'GET') {
      const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 20;
      const orders = db.getAllOrders(limit);
      sendJson(res, 200, { success: true, count: orders.length, data: orders });
      return;
    }

    // 4. GET /api/orders/:token - Search order by token
    if (pathname.startsWith('/api/orders/') && method === 'GET') {
      const token = decodeURIComponent(pathname.replace('/api/orders/', '')).trim();
      const order = db.getOrderByToken(token);
      if (!order) {
        sendJson(res, 404, { success: false, error: `Order with token "${token}" was not found.` });
        return;
      }
      sendJson(res, 200, { success: true, order });
      return;
    }

    // 5. PATCH or POST /api/orders/:id/status - Update order status
    if (pathname.match(/^\/api\/orders\/([^/]+)\/status$/) && (method === 'PATCH' || method === 'POST')) {
      const match = pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
      const idOrToken = decodeURIComponent(match[1]).trim();
      const body = await readJsonBody(req);
      const { status } = body;

      if (!status) {
        sendJson(res, 400, { success: false, error: 'Status is required.' });
        return;
      }

      const updated = db.updateOrderStatus(idOrToken, status);
      sendJson(res, 200, { success: true, message: `Status updated to ${status}`, order: updated });
      return;
    }

    // 6. GET /api/queue - Live queue status
    if (pathname === '/api/queue' && method === 'GET') {
      const queue = db.getQueueSummary();
      sendJson(res, 200, { success: true, data: queue });
      return;
    }

    // ---------------- STATIC FILE SERVING ----------------
    if (pathname === '/' || pathname === '/index.html') {
      serveStaticFile(res, path.join(PUBLIC_DIR, 'index.html'));
      return;
    }

    // Serve other assets in public folder safely
    const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));
    if (safePath.startsWith(PUBLIC_DIR) && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      serveStaticFile(res, safePath);
      return;
    }

    // Default 404 for unknown endpoints
    sendJson(res, 404, { success: false, error: 'Route not found' });

  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { success: false, error: err.message || 'Internal server error' });
  }
});

// Start listening with automatic port fallback if port is in use
function listenOnAvailablePort(startPort, maxAttempts = 10) {
  let currentPort = Number(startPort);
  let attempts = 0;

  function tryListen() {
    // One-time error handler for this attempt
    const errorHandler = (err) => {
      if (err.code === 'EADDRINUSE') {
        attempts++;
        if (attempts >= maxAttempts) {
          console.error(`\n❌ Could not find an available port after ${maxAttempts} attempts starting from ${startPort}.`);
          process.exit(1);
        }
        console.warn(`⚠️  Port ${currentPort} is currently in use.`);
        currentPort++;
        console.log(`🔄 Trying next port: http://localhost:${currentPort}...`);
        setTimeout(tryListen, 250);
      } else {
        console.error('Fatal server error:', err);
        process.exit(1);
      }
    };

    server.once('error', errorHandler);

    server.listen(currentPort, () => {
      // Remove the error handler once successfully listening
      server.removeListener('error', errorHandler);
      console.log(`\n========================================================`);
      console.log(`🍔 QuickBite Canteen Server running successfully!`);
      console.log(`👉 Open in browser: http://localhost:${currentPort}`);
      console.log(`📁 Database: ${path.join(__dirname, 'canteen.db')}`);
      console.log(`📡 API Endpoints:`);
      console.log(`   - Menu:   http://localhost:${currentPort}/api/menu`);
      console.log(`   - Orders: http://localhost:${currentPort}/api/orders`);
      console.log(`   - Queue:  http://localhost:${currentPort}/api/queue`);
      console.log(`========================================================\n`);
    });
  }

  tryListen();
}

if (require.main === module) {
  listenOnAvailablePort(PORT);
}

module.exports = { server, PORT };
