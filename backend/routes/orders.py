from flask import Blueprint, request, jsonify, g
from services.prediction_service import get_demand_prediction
import secrets

orders_bp = Blueprint('orders', __name__)

@orders_bp.route('/', methods=['POST'])
def place_order():
    data = request.json
    user_id = data.get('user_id')
    items = data.get('items') 
    
    if not user_id or not items:
        return jsonify({"error": "Invalid order data"}), 400
        
    payment_method = data.get('payment_method', 'wallet')
    
    subtotal = sum(float(item['price']) * int(item['quantity']) for item in items)
    
    cursor = g.db.cursor()
    
    discount_code = data.get('discount_code', '')
    discount_amount = 0
    if discount_code:
        cursor.execute("SELECT discount_percent FROM promocodes WHERE code = ? AND active = 1", (discount_code.upper(),))
        promo = cursor.fetchone()
        if promo:
            discount_amount = subtotal * (float(promo['discount_percent']) / 100.0)
            
    total_price = (subtotal - discount_amount) * 1.05 # Add 5% GST
    
    try:
        # Verify stock for all items
        for item in items:
            cursor.execute("SELECT stock, name FROM menu_items WHERE id = ?", (item['menu_item_id'],))
            menu_row = cursor.fetchone()
            if not menu_row or int(menu_row['stock']) < int(item['quantity']):
                return jsonify({"error": f"Insufficient stock for {menu_row['name'] if menu_row else 'item'}"}), 400

        if payment_method == 'wallet':
            cursor.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
            user_row = cursor.fetchone()
            if not user_row:
                return jsonify({"error": "User not found"}), 404
                
            current_balance = float(user_row['balance'])
            if current_balance < total_price:
                return jsonify({"error": f"Insufficient balance. Wallet: ₹{current_balance:.2f}, Order Total: ₹{total_price:.2f}"}), 400
                
            # Deduct balance
            new_balance = current_balance - total_price
            cursor.execute("UPDATE users SET balance = ? WHERE id = ?", (new_balance, user_id))

        order_number = f"ORD-{secrets.token_hex(4).upper()}"
        special_instructions = data.get('special_instructions', '')
        pickup_time = data.get('pickup_time', '')
        cursor.execute("INSERT INTO orders (order_number, user_id, status, total_price, special_instructions, pickup_time, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)",
                       (order_number, user_id, 'pending', total_price, special_instructions, pickup_time, payment_method))
        order_id = cursor.lastrowid
        
        for item in items:
            cursor.execute("UPDATE menu_items SET stock = stock - ? WHERE id = ?", (item['quantity'], item['menu_item_id']))
            cursor.execute("INSERT INTO order_items (order_id, menu_item_id, quantity) VALUES (?, ?, ?)",
                           (order_id, item['menu_item_id'], item['quantity']))
        
        # Low Stock Automation
        cursor.execute("UPDATE menu_items SET available = 0 WHERE stock <= 0")
        
        g.db.commit()
        return jsonify({"message": "Order placed successfully", "order_id": order_id}), 201
    except Exception as e:
        g.db.rollback()
        return jsonify({"error": str(e)}), 500

@orders_bp.route('/promo', methods=['POST'])
def check_promo():
    code = request.json.get('code', '')
    cursor = g.db.cursor()
    cursor.execute("SELECT discount_percent FROM promocodes WHERE code = ? AND active = 1", (code.upper(),))
    res = cursor.fetchone()
    if res:
        return jsonify({"valid": True, "discount_percent": res['discount_percent']})
    return jsonify({"valid": False, "error": "Invalid or expired promo code"}), 400

@orders_bp.route('/promos', methods=['GET'])
def list_promos():
    cursor = g.db.cursor()
    cursor.execute("SELECT * FROM promocodes ORDER BY id DESC")
    return jsonify([dict(r) for r in cursor.fetchall()])

@orders_bp.route('/promos', methods=['POST'])
def create_promo():
    data = request.json
    code = data.get('code', '').strip().upper()
    pct = data.get('discount_percent')
    if not code or not pct:
        return jsonify({"error": "Code and discount_percent required"}), 400
    cursor = g.db.cursor()
    try:
        cursor.execute("INSERT INTO promocodes (code, discount_percent) VALUES (?, ?)", (code, pct))
        g.db.commit()
        return jsonify({"message": f"Promo {code} created"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@orders_bp.route('/promos/<int:promo_id>', methods=['PUT'])
def toggle_promo(promo_id):
    data = request.json
    cursor = g.db.cursor()
    cursor.execute("UPDATE promocodes SET active = ? WHERE id = ?", (1 if data.get('active') else 0, promo_id))
    g.db.commit()
    return jsonify({"message": "Updated"})


@orders_bp.route('/<int:order_id>/review', methods=['POST'])
def add_review(order_id):
    data = request.json
    cursor = g.db.cursor()
    try:
        cursor.execute("INSERT INTO reviews (order_id, user_id, rating, comment) VALUES (?, ?, ?, ?)",
                       (order_id, data.get('user_id'), data.get('rating'), data.get('comment', '')))
        g.db.commit()
        return jsonify({"message": "Review submitted successfully"}), 201
    except Exception as e:
        g.db.rollback()
        return jsonify({"error": str(e)}), 500

@orders_bp.route('/student/<int:user_id>', methods=['GET'])
def get_student_orders(user_id):
    cursor = g.db.cursor()
    cursor.execute("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    orders = cursor.fetchall()
    
    results = []
    for order in orders:
        o_dict = dict(order)
        cursor.execute("""
            SELECT oi.menu_item_id, oi.quantity, m.name, m.price 
            FROM order_items oi 
            JOIN menu_items m ON oi.menu_item_id = m.id 
            WHERE oi.order_id = ?
        """, (o_dict['id'],))
        o_dict['items'] = [list(i) for i in cursor.fetchall()]
        results.append(o_dict)
        
    return jsonify(results), 200

@orders_bp.route('/live', methods=['GET'])
def get_live_orders():
    cursor = g.db.cursor()
    cursor.execute("SELECT o.*, u.username FROM orders o JOIN users u ON o.user_id = u.id WHERE o.status != 'completed' ORDER BY o.created_at ASC")
    orders = cursor.fetchall()
    
    results = []
    for order in orders:
        o_dict = dict(order)
        cursor.execute("""
            SELECT oi.quantity, m.name 
            FROM order_items oi 
            JOIN menu_items m ON oi.menu_item_id = m.id 
            WHERE oi.order_id = ?
        """, (o_dict['id'],))
        o_dict['items'] = [list(i) for i in cursor.fetchall()]
        results.append(o_dict)
        
    return jsonify(results), 200

@orders_bp.route('/<int:order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    data = request.json
    status = data.get('status')
    if status not in ['pending', 'preparing', 'ready', 'completed']:
        return jsonify({"error": "Invalid status"}), 400
        
    cursor = g.db.cursor()
    try:
        cursor.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))
        g.db.commit()
        return jsonify({"message": "Status updated"}), 200
    except Exception as e:
        g.db.rollback()
        return jsonify({"error": str(e)}), 500

@orders_bp.route('/predictions', methods=['GET'])
def predictions():
    prediction_results = get_demand_prediction(g.db)
    return jsonify({"prediction": prediction_results}), 200

@orders_bp.route('/analytics', methods=['GET'])
def get_analytics():
    cursor = g.db.cursor()
    cursor.execute("""
        SELECT COUNT(id) as total_orders, 
               IFNULL(SUM(total_price), 0) as total_revenue,
               IFNULL(SUM(CASE WHEN payment_method = 'online' THEN total_price ELSE 0 END), 0) as online_revenue,
               IFNULL(SUM(CASE WHEN payment_method != 'online' THEN total_price ELSE 0 END), 0) as other_revenue
        FROM orders
        WHERE DATE(created_at) = DATE('now')
    """)
    stats = dict(cursor.fetchone())
    
    cursor.execute("""
        SELECT m.name, SUM(oi.quantity) as qty
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN menu_items m ON oi.menu_item_id = m.id
        WHERE DATE(o.created_at) = DATE('now')
        GROUP BY m.id
        ORDER BY qty DESC LIMIT 1
    """)
    top_item = cursor.fetchone()
    stats['top_item'] = top_item['name'] if top_item else 'None'
    
    cursor.execute("""
        SELECT DATE(created_at) as date, SUM(total_price) as revenue 
        FROM orders 
        WHERE created_at >= date('now', '-6 days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    """)
    stats['chart_data'] = {row['date']: row['revenue'] for row in cursor.fetchall()}
    
    return jsonify(stats), 200

@orders_bp.route('/export', methods=['GET'])
def export_csv():
    import csv, io
    cursor = g.db.cursor()
    cursor.execute("SELECT order_number, total_price, status, created_at FROM orders ORDER BY created_at DESC")
    orders = cursor.fetchall()
    
    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(["Order Number", "Total Price (INR)", "Status", "Date"])
    for o in orders:
        cw.writerow([o['order_number'], round(o['total_price'], 2), o['status'], o['created_at']])
        
    output = si.getvalue()
    return output, 200, {
        "Content-Disposition": "attachment; filename=financial_audit.csv",
        "Content-type": "text/csv"
    }
