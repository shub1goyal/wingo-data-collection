import time
import requests
from supabase import createClient

# --- CONFIGURATION ---
SUPABASE_URL = "https://amhuejwptegjwohwfluk.supabase.co"
SUPABASE_KEY = "sb_publishable_7xsYTB6aSvii6Wu2kbFV2A_a8T37Ys7"
API_URL = "https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json"

# Initialize Supabase
supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

def fetch_and_save():
    print(f"[{time.strftime('%H:%M:%S')}] Syncing data...")
    try:
        # 1. Fetch JSON directly
        response = requests.get(API_URL, timeout=10)
        data = response.json()
        
        # 2. Extract items
        items = data.get('data', {}).get('list', [])
        if not items:
            print("No data found in API response.")
            return

        # 3. Sanitize for Supabase
        sanitized = []
        for item in items:
            sanitized.append({
                "issue": str(item.get('issue')),
                "color": str(item.get('color', 'UNKNOWN')),
                "timestamp": int(item.get('timestamp', time.time() * 1000))
            })

        # 4. Upsert (Handles duplicates automatically using 'issue' as unique key)
        supabase.table("wingo_history").upsert(sanitized, on_conflict="issue").execute()
        print(f"Done! Synced {len(sanitized)} rounds.")
        
    except Exception as e:
        print(f"Error occurred: {e}")

if __name__ == "__main__":
    print("-----------------------------------------")
    print("🔥 WinGo Simple Local Collector (30s Loop)")
    print("Keep this terminal open for live sync.")
    print("-----------------------------------------")
    
    while True:
        fetch_and_save()
        time.sleep(30) # Change to any frequency you like
