import sqlite3, os

db = os.path.join(os.path.dirname(__file__), 'canteen.db')
conn = sqlite3.connect(db)
c = conn.cursor()

# Fix reviews table - add menu_item_id if missing
try:
    c.execute('ALTER TABLE reviews ADD COLUMN menu_item_id INTEGER')
    print('Added menu_item_id to reviews')
except Exception as e:
    print('reviews.menu_item_id:', e)

# Add promocodes table
c.execute('''CREATE TABLE IF NOT EXISTS promocodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL,
    active BOOLEAN DEFAULT 1
)''')
c.execute("INSERT OR IGNORE INTO promocodes (code, discount_percent) VALUES ('WELCOME10', 10)")
c.execute("INSERT OR IGNORE INTO promocodes (code, discount_percent) VALUES ('STUDENT20', 20)")
c.execute("INSERT OR IGNORE INTO promocodes (code, discount_percent) VALUES ('FRIDAY15', 15)")
print('Promocodes table ready with 3 codes')

conn.commit()
conn.close()
print('DB fix complete.')
