from flask import Blueprint, request, jsonify, g
import sqlite3

interactions_bp = Blueprint('interactions', __name__)

@interactions_bp.route('/favorites/toggle', methods=['POST'])
def toggle_favorite():
    data = request.json
    user_id = data.get('user_id')
    menu_item_id = data.get('menu_item_id')
    
    if not user_id or not menu_item_id:
        return jsonify({"error": "Missing parameters"}), 400

    cursor = g.db.cursor()
    try:
        cursor.execute("SELECT * FROM favorites WHERE user_id=? AND menu_item_id=?", (user_id, menu_item_id))
        if cursor.fetchone():
            cursor.execute("DELETE FROM favorites WHERE user_id=? AND menu_item_id=?", (user_id, menu_item_id))
            g.db.commit()
            return jsonify({"status": "removed"}), 200
        else:
            cursor.execute("INSERT INTO favorites (user_id, menu_item_id) VALUES (?, ?)", (user_id, menu_item_id))
            g.db.commit()
            return jsonify({"status": "added"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@interactions_bp.route('/reviews', methods=['POST'])
def add_review():
    data = request.json
    cursor = g.db.cursor()
    try:
        cursor.execute("SELECT id FROM reviews WHERE user_id=? AND order_id=? AND menu_item_id=?", 
                       (data['user_id'], data['order_id'], data['menu_item_id']))
        if cursor.fetchone():
            return jsonify({"error": "You already reviewed this item from this order."}), 400
            
        cursor.execute("INSERT INTO reviews (user_id, menu_item_id, order_id, rating, comment) VALUES (?, ?, ?, ?, ?)",
                       (data['user_id'], data['menu_item_id'], data['order_id'], data['rating'], data.get('comment', '')))
        g.db.commit()
        return jsonify({"message": "Review submitted successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400
