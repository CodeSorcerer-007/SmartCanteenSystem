@echo off
echo Starting Smart Canteen Frontend on Port 5500...
echo This will be reachable from your phone at http://192.168.29.3:5500/frontend/index.html
cd frontend
python -m http.server 5500
pause
