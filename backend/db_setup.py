import sqlite3
import os
from config import Config

def setup_database():
    schema_path = os.path.join(os.path.dirname(__file__), '..', 'database', 'schema.sql')
    
    with open(schema_path, 'r') as f:
        schema_sql = f.read()

    conn = sqlite3.connect(Config.SQLITE_DB)
    cursor = conn.cursor()
    
    try:
        cursor.executescript(schema_sql)
        conn.commit()
        print("SQLite database successfully created and seeded!")
    except Exception as e:
        print(f"Error setting up database: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    setup_database()
