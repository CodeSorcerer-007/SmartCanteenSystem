@echo off
echo Starting Smart Canteen Backend on Port 5001...
cd backend
if not exist venv (
    echo Virtual environment not found! Creating one...
    python -m venv venv
    .\venv\Scripts\pip install flask flask-cors
)
.\venv\Scripts\python app.py
pause
