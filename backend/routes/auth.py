from flask import Blueprint, request, jsonify, g
import hashlib

auth_bp = Blueprint('auth', __name__)

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'student')

    if role == 'admin' or (username and username.lower() == 'admin'):
        return jsonify({"error": "Admin registration is not allowed"}), 403

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    password_hash = hash_password(password)
    
    cursor = g.db.cursor()
    try:
        cursor.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", 
                       (username, password_hash, role))
        g.db.commit()
        user_id = cursor.lastrowid
        return jsonify({"message": "User registered successfully", "user": {"id": user_id, "username": username, "role": role, "balance": 500.0}}), 201
    except Exception as e:
        g.db.rollback()
        return jsonify({"error": "Username may already exist"}), 400

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if username == 'Admin' and password == 'admin@123':
        return jsonify({"message": "Login successful", "user": {"id": 0, "username": "Admin", "role": "admin", "balance": 0.0}}), 200

    if username == 'Kitchen' and password == 'kitchen@123':
        return jsonify({"message": "Login successful", "user": {"id": -1, "username": "Kitchen", "role": "kitchen", "balance": 0.0}}), 200

    if username.lower() == 'admin' or username.lower() == 'kitchen':
        return jsonify({"error": "Invalid credentials"}), 401

    password_hash = hash_password(password)
    
    cursor = g.db.cursor()
    cursor.execute("SELECT id, username, role, balance FROM users WHERE username = ? AND password_hash = ?", 
                   (username, password_hash))
    user = cursor.fetchone()

    if user and user['role'] != 'admin':
        return jsonify({"message": "Login successful", "user": dict(user)}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

@auth_bp.route('/wallet/<int:user_id>', methods=['GET'])
def get_wallet(user_id):
    cursor = g.db.cursor()
    cursor.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if user:
        return jsonify({"balance": user['balance']}), 200
    return jsonify({"error": "User not found"}), 404

@auth_bp.route('/wallet/topup', methods=['POST'])
def topup_wallet():
    data = request.json
    user_id = data.get('user_id')
    amount = float(data.get('amount', 0))
    if amount <= 0:
        return jsonify({"error": "Invalid amount"}), 400
        
    cursor = g.db.cursor()
    try:
        cursor.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (amount, user_id))
        g.db.commit()
        
        cursor.execute("SELECT balance FROM users WHERE id = ?", (user_id,))
        new_balance = cursor.fetchone()['balance']
        return jsonify({"message": "Top up successful", "balance": new_balance}), 200
    except Exception as e:
        g.db.rollback()
        return jsonify({"error": str(e)}), 500
