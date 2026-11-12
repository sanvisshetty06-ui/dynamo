// database.js - SQLite Database Manager for QuickBite Canteen
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// Database file path
const DB_PATH = path.join(__dirname, 'canteen.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for better concurrency and foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize tables, migrations, and seed initial menu if empty
 */
function initializeDatabase() {
  // 1. Menu Items Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      emoji TEXT NOT NULL,
      description TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 2. Orders Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      student_name TEXT NOT NULL,
      student_id TEXT NOT NULL,
      pickup_time TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Received',
      queue_number INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Migration: Add payment and discount columns if missing
  const orderColumns = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
  if (!orderColumns.includes('payment_method')) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'Cash';");
  }
  if (!orderColumns.includes('payment_status')) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'Pending';");
  }
  if (!orderColumns.includes('discount_code')) {
    db.exec("ALTER TABLE orders ADD COLUMN discount_code TEXT DEFAULT '';");
  }
  if (!orderColumns.includes('discount_amount')) {
    db.exec("ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0;");
  }

  // 3. Order Items Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      item_total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES menu_items(id)
    );
  `);

  // 4. Reviews & Ratings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL,
      student_name TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Create indexes for fast lookup
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
  `);

  // Seed menu items if empty
  const countRow = db.prepare('SELECT COUNT(*) AS count FROM menu_items').get();
  if (!countRow || countRow.count === 0) {
    seedMenuItems();
  }

  // Seed sample reviews if empty
  const reviewCount = db.prepare('SELECT COUNT(*) AS count FROM reviews').get();
  if (!reviewCount || reviewCount.count === 0) {
    seedReviews();
  }
}

/**
 * Seed initial canteen items from the catalog
 */
function seedMenuItems() {
  const initialItems = [
    { name: "South Indian Meals", category: "Meals", price: 80, emoji: "🍛", description: "A filling traditional South Indian meal with rice, sambar, rasam, and poriyal." },
    { name: "North Indian Meals", category: "Meals", price: 100, emoji: "🥘", description: "Delicious North Indian-style meal with roti, dal, sabzi, and jeera rice." },
    { name: "Veg Biryani", category: "Meals", price: 70, emoji: "🍚", description: "Flavourful spiced vegetable biryani served with chilled raita." },
    { name: "Curd Rice", category: "Meals", price: 40, emoji: "🥣", description: "Cooling seasoned curd rice, perfect comfort lunch." },
    { name: "Orange Juice", category: "Juices", price: 40, emoji: "🍊", description: "Freshly squeezed vitamin-rich orange juice." },
    { name: "Mango Juice", category: "Juices", price: 50, emoji: "🥭", description: "Sweet and luscious Alphonso mango cooler." },
    { name: "Watermelon Juice", category: "Juices", price: 35, emoji: "🍉", description: "Hydrating fresh watermelon cooler." },
    { name: "Fresh Lime Juice", category: "Juices", price: 25, emoji: "🍋", description: "Refreshing sweet and salty lime drink." },
    { name: "Pani Puri", category: "Chats", price: 30, emoji: "🧆", description: "Crispy hollow puris served with tangy mint and tamarind water." },
    { name: "Masala Puri", category: "Chats", price: 35, emoji: "🌶️", description: "Crushed puris topped with hot spicy pea gravy and onions." },
    { name: "Sev Puri", category: "Chats", price: 40, emoji: "🥙", description: "Crunchy puris topped with potato masala, sweet chutneys, and crisp sev." },
    { name: "Dahi Puri", category: "Chats", price: 40, emoji: "🍲", description: "Puris filled with sweet creamy yoghurt, chutneys, and savoury spices." }
  ];

  const insert = db.prepare(`
    INSERT INTO menu_items (name, category, price, emoji, description)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const item of initialItems) {
    insert.run(item.name, item.category, item.price, item.emoji, item.description);
  }
}

/**
 * Seed initial reviews
 */
function seedReviews() {
  const initialReviews = [
    { token: "QB-3586", studentName: "Priya S.", productId: 1, productName: "South Indian Meals", rating: 5, comment: "Hot and fresh meals, authentic sambar taste!" },
    { token: "QB-2220", studentName: "Aarav P.", productId: 9, productName: "Pani Puri", rating: 5, comment: "Crispy puris and the spicy mint water is superb." },
    { token: "QB-3040", studentName: "Sanya G.", productId: 6, productName: "Mango Juice", rating: 4, comment: "Very refreshing and thick fresh mango pulp." },
    { token: "QB-5476", studentName: "Rahul K.", productId: 2, productName: "North Indian Meals", rating: 5, comment: "Generous portions and warm rotis. Best lunch on campus!" }
  ];

  const insert = db.prepare(`
    INSERT INTO reviews (token, student_name, product_id, product_name, rating, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const r of initialReviews) {
    insert.run(r.token, r.studentName, r.productId, r.productName, r.rating, r.comment);
  }
}

// ----------------- QUERY FUNCTIONS ----------------- //

/**
 * Fetch all available menu items with live review ratings
 */
function getMenuItems(category = null) {
  let query = 'SELECT * FROM menu_items WHERE available = 1';
  let params = [];
  if (category && category !== 'All') {
    query += ' AND category = ?';
    params.push(category);
  }
  query += ' ORDER BY id ASC';

  const items = db.prepare(query).all(...params);
  const ratings = getProductRatings();

  return items.map(item => ({
    ...item,
    avgRating: ratings[item.id]?.avgRating || 4.8,
    reviewCount: ratings[item.id]?.reviewCount || 6
  }));
}

/**
 * Fetch a single menu item by ID
 */
function getMenuItemById(id) {
  const stmt = db.prepare('SELECT * FROM menu_items WHERE id = ?');
  return stmt.get(id);
}

/**
 * Create a new pre-order with items, payment, and discount inside a transaction
 */
function createOrder({ 
  studentName, 
  studentId, 
  pickupTime, 
  items, 
  paymentMethod = 'UPI', 
  paymentStatus = 'Paid',
  discountCode = '',
  discountAmount = 0 
}) {
  if (!studentName || !studentId || !pickupTime || !Array.isArray(items) || items.length === 0) {
    throw new Error('Invalid order payload: missing required fields or empty cart.');
  }

  // Validate items and calculate accurate subtotal based on database prices
  let subtotal = 0;
  const verifiedItems = [];

  for (const item of items) {
    const product = getMenuItemById(item.id);
    if (!product) {
      throw new Error(`Menu item with ID ${item.id} not found.`);
    }
    const qty = parseInt(item.quantity, 10);
    if (!qty || qty <= 0) {
      throw new Error(`Invalid quantity for item ${product.name}.`);
    }
    const itemTotal = product.price * qty;
    subtotal += itemTotal;
    verifiedItems.push({
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity: qty,
      itemTotal
    });
  }

  // Validate discount code & apply discount
  let validDiscount = 0;
  let appliedCode = '';
  if (discountCode) {
    const code = discountCode.trim().toUpperCase();
    if (code === 'CAMPUS20') {
      validDiscount = Math.round(subtotal * 0.20);
      appliedCode = 'CAMPUS20 (20% Off)';
    } else if (code === 'QUICKBITE') {
      validDiscount = subtotal >= 80 ? 25 : 0;
      appliedCode = 'QUICKBITE (₹25 Off)';
    } else if (code === 'STUDENT10') {
      validDiscount = Math.round(subtotal * 0.10);
      appliedCode = 'STUDENT10 (10% Off)';
    }
  }

  const finalTotal = Math.max(0, subtotal - validDiscount);

  // Generate unique token: QB followed by random 4-digit number (e.g. QB-4921)
  const tokenNumber = Math.floor(1000 + Math.random() * 9000);
  const token = `QB-${tokenNumber}`;

  // Calculate queue number: count of active uncompleted orders today + 1
  const queueCount = db.prepare(`
    SELECT COUNT(*) as count FROM orders 
    WHERE status IN ('Received', 'Preparing', 'Ready for Pickup')
  `).get().count;
  const queueNumber = queueCount + 1;

  // Insert order and order items in a transaction
  db.exec('BEGIN TRANSACTION;');
  try {
    const orderStmt = db.prepare(`
      INSERT INTO orders (
        token, student_name, student_id, pickup_time, total_amount, 
        status, queue_number, payment_method, payment_status, discount_code, discount_amount
      )
      VALUES (?, ?, ?, ?, ?, 'Received', ?, ?, ?, ?, ?)
    `);
    const result = orderStmt.run(
      token, studentName, studentId, pickupTime, finalTotal,
      queueNumber, paymentMethod, paymentStatus, appliedCode, validDiscount
    );
    const orderId = result.lastInsertRowid;

    const itemStmt = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, price, quantity, item_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const v of verifiedItems) {
      itemStmt.run(orderId, v.productId, v.productName, v.price, v.quantity, v.itemTotal);
    }

    db.exec('COMMIT;');

    return getOrderByToken(token);
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

/**
 * Fetch full order details by token including items
 */
function getOrderByToken(token) {
  const orderStmt = db.prepare(`
    SELECT * FROM orders WHERE token = ?
  `);
  const order = orderStmt.get(token);
  if (!order) return null;

  const itemsStmt = db.prepare(`
    SELECT oi.id, oi.product_id, oi.product_name, oi.price, oi.quantity, oi.item_total, m.emoji
    FROM order_items oi
    LEFT JOIN menu_items m ON oi.product_id = m.id
    WHERE oi.order_id = ?
  `);
  order.items = itemsStmt.all(order.id);

  // Compute how many orders are ahead in queue
  if (['Received', 'Preparing'].includes(order.status)) {
    const aheadStmt = db.prepare(`
      SELECT COUNT(*) as ahead FROM orders
      WHERE status IN ('Received', 'Preparing') AND id < ?
    `);
    order.orders_ahead = aheadStmt.get(order.id).ahead;
  } else {
    order.orders_ahead = 0;
  }

  return order;
}

/**
 * Fetch all orders (with limit)
 */
function getAllOrders(limit = 20) {
  const stmt = db.prepare(`
    SELECT * FROM orders ORDER BY id DESC LIMIT ?
  `);
  const orders = stmt.all(limit);
  for (const o of orders) {
    const itemsStmt = db.prepare(`
      SELECT product_name, quantity, item_total FROM order_items WHERE order_id = ?
    `);
    o.items = itemsStmt.all(o.id);
  }
  return orders;
}

/**
 * Update order status ('Received', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled')
 */
function updateOrderStatus(id, newStatus) {
  const validStatuses = ['Received', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Allowed: ${validStatuses.join(', ')}`);
  }

  const stmt = db.prepare(`
    UPDATE orders 
    SET status = ?, updated_at = datetime('now', 'localtime') 
    WHERE id = ? OR token = ?
  `);
  stmt.run(newStatus, id, id);
  return getOrderByToken(id) || db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
}

/**
 * Cancel an order if it's still Received (Student Cancel Feature)
 */
function cancelOrder(token) {
  const order = getOrderByToken(token);
  if (!order) {
    throw new Error(`Order with token ${token} not found.`);
  }
  if (order.status === 'Completed') {
    throw new Error('Order is already completed and cannot be cancelled.');
  }
  if (order.status === 'Cancelled') {
    throw new Error('Order is already cancelled.');
  }

  return updateOrderStatus(token, 'Cancelled');
}

/**
 * Add a rating & review
 */
function addReview({ token, studentName, productId, rating, comment }) {
  if (!token || !rating || !productId) {
    throw new Error('Token, rating, and product are required for a review.');
  }
  const product = getMenuItemById(productId);
  const productName = product ? product.name : 'Canteen Dish';

  const stmt = db.prepare(`
    INSERT INTO reviews (token, student_name, product_id, product_name, rating, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(token, studentName || 'Student', productId, productName, parseInt(rating, 10), comment || 'Delicious!');
  return { id: res.lastInsertRowid, token, productName, rating, comment };
}

/**
 * Get recent student reviews
 */
function getReviews(limit = 10) {
  const stmt = db.prepare(`
    SELECT * FROM reviews ORDER BY id DESC LIMIT ?
  `);
  return stmt.all(limit);
}

/**
 * Get map of product average ratings
 */
function getProductRatings() {
  const rows = db.prepare(`
    SELECT product_id, ROUND(AVG(rating), 1) as avgRating, COUNT(*) as reviewCount
    FROM reviews
    GROUP BY product_id
  `).all();

  const map = {};
  for (const r of rows) {
    map[r.product_id] = { avgRating: r.avgRating, reviewCount: r.reviewCount };
  }
  return map;
}

/**
 * Get queue metrics summary
 */
function getQueueSummary() {
  const counts = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'Received' THEN 1 ELSE 0 END) as received,
      SUM(CASE WHEN status = 'Preparing' THEN 1 ELSE 0 END) as preparing,
      SUM(CASE WHEN status = 'Ready for Pickup' THEN 1 ELSE 0 END) as ready,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
      COUNT(*) as total
    FROM orders
  `).get();

  const activeTokens = db.prepare(`
    SELECT token, status, queue_number, student_name, pickup_time
    FROM orders
    WHERE status IN ('Received', 'Preparing', 'Ready for Pickup')
    ORDER BY id ASC
    LIMIT 10
  `).all();

  return {
    metrics: {
      received: counts.received || 0,
      preparing: counts.preparing || 0,
      ready: counts.ready || 0,
      completed: counts.completed || 0,
      cancelled: counts.cancelled || 0,
      total: counts.total || 0
    },
    activeOrders: activeTokens
  };
}

// Initialize immediately
initializeDatabase();

module.exports = {
  db,
  getMenuItems,
  getMenuItemById,
  createOrder,
  getOrderByToken,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  addReview,
  getReviews,
  getProductRatings,
  getQueueSummary
};
