"""
Test the user discovery API endpoint
"""
import requests
import json

API_BASE = "http://localhost:8000"

# You'll need to replace this with a valid JWT token from your browser's localStorage
# Open browser console and run: localStorage.getItem('auth_token')
TOKEN = "YOUR_TOKEN_HERE"

def test_get_all_users():
    headers = {
        'Authorization': f'Bearer {TOKEN}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(f'{API_BASE}/api/users/all', headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

if __name__ == "__main__":
    print("Testing GET /api/users/all endpoint...")
    print("Note: Update TOKEN variable with your actual auth token")
    # test_get_all_users()
    print("\nUsers should now be visible in the Discover People section of your feed!")
    print("If you still don't see users:")
    print("1. Refresh the page")
    print("2. Check browser console for errors")
    print("3. Check backend logs for the DEBUG messages")
