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
    print("--- Testing Registration ---")
    status, data = make_req(f"{BASE}/auth/register", method='POST', data={"username": "test_student", "password": "password123", "role": "student"})
    user_id = data['user']['id']
    
    print("\n--- Testing Menu & Stock ---")
    status, menu = make_req(f"{BASE}/menu/")
    item = menu[0]
    print(f"Item: {item['name']}, Stock: {item['stock']}")

    print("\n--- Testing Advanced Order Placement ---")
    order_data = {
        "user_id": user_id,
        "items": [{"menu_item_id": item['id'], "quantity": 1, "price": item['price']}],
        "pickup_time": "14:30",
        "special_instructions": "Extra cheese please"
    }
    status, order_res = make_req(f"{BASE}/orders/", method='POST', data=order_data)
    print("Order status:", status)
    print("Response:", order_res)
    
    print("\n--- Testing Stock Deduction ---")
    status, menu_after = make_req(f"{BASE}/menu/")
    item_after = menu_after[0]
    print(f"Old Stock: {item['stock']}, New Stock: {item_after['stock']}")
    if item['stock'] - 1 != item_after['stock']:
        print("STOCK DEDUCTION FAILED!")

    print("\n--- Testing Over-ordering Safeguard ---")
    order_data_over = {
        "user_id": user_id,
        "items": [{"menu_item_id": item['id'], "quantity": 1000, "price": item['price']}],
    }
    status, over_res = make_req(f"{BASE}/orders/", method='POST', data=order_data_over)
    print("Order status (should be 400):", status)
    print("Response:", over_res)

    print("\n--- Success ---")

except Exception as e:
    print("Error during test:", e)
    sys.exit(1)
