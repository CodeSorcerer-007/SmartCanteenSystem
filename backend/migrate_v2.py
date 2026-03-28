import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'canteen.db')

def migrate():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create Promocodes table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS promocodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount_percent INTEGER NOT NULL,
        active BOOLEAN DEFAULT 1
    )
    ''')

    # Seed an initial promo code
    cursor.execute("INSERT OR IGNORE INTO promocodes (code, discount_percent) VALUES ('WELCOME10', 10)")

    # Create Reviews table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        user_id INTEGER,
        rating INTEGER,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Update users table if needed (SQLite doesn't strictly enforce enums, so 'kitchen' role can just be inserted)
    # We will just add a default kitchen user
    try:
        from werkzeug.security import generate_password_hash
        kitchen_pw = generate_password_hash('kitchen123')
        cursor.execute("INSERT OR IGNORE INTO users (username, password, role) VALUES ('kitchen_staff', ?, 'kitchen')", (kitchen_pw,))
    except Exception as e:
        print("Could not create kitchen user:", e)

    conn.commit()
    conn.close()
    print("Database Migration V2 Complete. Added Promocodes and Reviews.")

if __name__ == '__main__':
    migrate()
