import os

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'super-secret-canteen-key')
    SQLITE_DB = os.path.join(os.path.dirname(__file__), 'canteen.db')
