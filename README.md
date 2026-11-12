# QuickBite | Smart Canteen Backend Database & Pre-Order System

A complete full-stack web application with SQLite database integration, pre-ordering, live queue management, UPI payments, discount coupons, order cancellations, student reviews, and real-time audio alerts. Built with Node.js and embedded SQLite (`canteen.db`) using native `node:sqlite` (zero external npm dependencies required).

---

## 🌟 Complete Feature List

1. **Persistent Relational Database (`canteen.db`)**:
   - ACID-compliant SQLite database storing menu items, orders, order items, and student reviews.
   - Foreign keys, indexes, and Write-Ahead Logging (WAL) for high concurrency.

2. **Dynamic Menu & Live Ratings**:
   - Menu loaded dynamically from `menu_items` table.
   - Displays real-time student rating stars (e.g., `★ 5.0`) on each dish.

3. **Pre-Order & Checkout System**:
   - Real-time cart calculations and pickup time selection.
   - Saves order transactionally to SQLite, generating unique tokens (`QB-XXXX`).

4. **💳 UPI Instant QR Code & Cash Payment**:
   - Interactive UPI payment modal with dynamic QR code displaying exact payable amount.
   - Supports Google Pay, PhonePe, Paytm, and BHIM UPI, plus Cash at Counter option.

5. **🏷️ Discount & Coupon Code Engine**:
   - Real-time coupon validation (`/api/coupons/validate`).
   - Built-in codes: `CAMPUS20` (20% off), `QUICKBITE` (₹25 off), `STUDENT10` (10% off).
   - Itemized price breakdown showing Subtotal, Discount, and Net Total.

6. **⏱️ Live Order Tracker & Cancellation**:
   - Look up order status by token (`Received` ➔ `Preparing` ➔ `Ready for Pickup` ➔ `Completed`).
   - Shows real-time queue position and number of orders ahead.
   - Students can cancel pending orders directly while in `Received` status.

7. **⭐ Food Rating & Review System**:
   - Interactive 5-star rating widget in the tracker to leave meal feedback.
   - Dedicated **Student Reviews & Ratings** showcase board stored in the `reviews` table.

8. **🔔 Campus Pickup Sound Alert**:
   - Melodic 3-tone chime synthesized via browser Web Audio API.
   - Plays automatically when an order status changes to `Ready for Pickup`.
   - Includes a "🔔 Test Bell" button in the top navigation bar.

9. **👨‍🍳 Canteen Kitchen Staff Dashboard**:
   - Kitchen control table to update order statuses in real-time.

---

## 🗄️ Database Architecture (`canteen.db`)

* **`menu_items`**: id, name, category, price, emoji, description, available, created_at.
* **`orders`**: id, token, student_name, student_id, pickup_time, total_amount, status, queue_number, payment_method, payment_status, discount_code, discount_amount, created_at, updated_at.
* **`order_items`**: id, order_id (FK), product_id (FK), product_name, price, quantity, item_total.
* **`reviews`**: id, token, student_name, product_id, product_name, rating, comment, created_at.

---

## 🚀 How to Run

1. Open PowerShell in the project directory:
   ```powershell
   cd C:\Users\Sanvi\.gemini\antigravity\scratch\quickbite-canteen
   ```

2. Start the server:
   ```powershell
   node server.js
   ```

3. Open in your browser:
   👉 **`http://localhost:3000`** (or `http://localhost:3002` if port 3000 is occupied)

*(Note: Always use `http://`, not `https://`).*
