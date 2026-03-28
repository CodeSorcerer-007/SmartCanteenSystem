from flask import Flask, jsonify, request, g
from flask_cors import CORS
import sqlite3
from config import Config
from routes.auth import auth_bp
from routes.menu import menu_bp
from routes.orders import orders_bp
from routes.interactions import interactions_bp

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

def get_db_connection():
    conn = sqlite3.connect(app.config['SQLITE_DB'])
    conn.row_factory = sqlite3.Row
    return conn

@app.before_request
def before_request():
    if request.method == 'OPTIONS':
        return
    try:
        g.db = get_db_connection()
        g.db.execute('PRAGMA foreign_keys = ON')
    except Exception as err:
        return jsonify({"error": f"SQLite Database connection failed: {err}"}), 500

@app.teardown_request
def teardown_request(exception):
    db = getattr(g, 'db', None)
    if db is not None:
        db.close()

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(menu_bp, url_prefix='/api/menu')
app.register_blueprint(orders_bp, url_prefix='/api/orders')
app.register_blueprint(interactions_bp, url_prefix='/api/interactions')

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5001)
