import urllib.request
import json
import sys

BASE = "http://localhost:5000/api"

def make_req(url, method='GET', data=None):
    req = urllib.request.Request(url, method=method)
    if data:
        req.add_header('Content-Type', 'application/json')
        body = json.dumps(data).encode('utf-8')
    else:
        body = None
    try:
        with urllib.request.urlopen(req, data=body) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

try:
    print("--- 1. Set Up ---")
    status, reg = make_req(f"{BASE}/auth/register", method='POST', data={"username": "advanced_user", "password": "pwd", "role": "student"})
    user_id = reg['user']['id'] if status == 201 else 1 # Fallback to 1 if already exists

    status, menu = make_req(f"{BASE}/menu/")
    item_id = menu[0]['id']
    
    print(f"\n--- 2. Testing Favorites ---")
    status, res = make_req(f"{BASE}/interactions/favorites/toggle", method='POST', data={"user_id": user_id, "menu_item_id": item_id})
    print(f"Favorited item {item_id}: {res['status']}")

    status, menu_user = make_req(f"{BASE}/menu/?user_id={user_id}")
    is_fav = menu_user[0]['is_favorite']
    print(f"Fetch Menu returns is_favorite: {is_fav}")
    if not is_fav:
        print("FAIL: Item should be favorited.")
        sys.exit(1)

    print("\n--- 3. Testing Reviews ---")
    # Place an order to review it
    order_data = {"user_id": user_id, "items": [{"menu_item_id": item_id, "quantity": 1, "price": 99}], "pickup_time": "12:00"}
    status, order = make_req(f"{BASE}/orders/", method='POST', data=order_data)
    order_id = order['order_id']
    
    # Needs to be completed to be realistically reviewed, but API doesn't strictly check status in interactions.py
    status, rev = make_req(f"{BASE}/interactions/reviews", method='POST', data={
        "user_id": user_id, "menu_item_id": item_id, "order_id": order_id, "rating": 5, "comment": "Amazing!"
    })
    print(f"Submit Review: Status {status}, {rev}")
    
    status, menu_after = make_req(f"{BASE}/menu/")
    item_updated = menu_after[0]
    print(f"Aggregate Rating: {item_updated['average_rating']} ({item_updated['review_count']} reviews)")
    if item_updated['review_count'] == 0:
        print("FAIL: Review not tallied.")
        sys.exit(1)
        
    print("\n--- 4. Success ---")
except Exception as e:
    print("Error:", e)
    sys.exit(1)
