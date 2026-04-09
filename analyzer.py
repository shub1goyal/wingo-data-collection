import os
import time
from datetime import datetime
from supabase import createClient, Client

# --- CONFIGURATION ---
SUPABASE_URL = "https://amhuejwptegjwohwfluk.supabase.co"
SUPABASE_KEY = "sb_publishable_7xsYTB6aSvii6Wu2kbFV2A_a8T37Ys7" # Public Anon Key

# Connect to Supabase
supabase: Client = createClient(SUPABASE_URL, SUPABASE_KEY)

def fetch_data(limit=1000):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching latest {limit} rounds from Supabase...")
    try:
        response = supabase.table("wingo_history").select("*").order("issue", desc=True).limit(limit).execute()
        return response.data
    except Exception as e:
        print(f"Error fetching data: {e}")
        return []

def evaluate_patterns(data):
    if not data:
        return
    
    # Simple Length 3 & 4 logic
    colors = [d['color'] for d in data]
    colors.reverse() # Oldest first for sequence matching
    
    print(f"Analyzing {len(colors)} rounds for 3 & 4 length patterns...")
    
    # We'll just print a summary of the most frequent patterns for now
    patterns_found = {}
    
    for length in [3, 4]:
        for i in range(len(colors) - length):
            seq = tuple(colors[i:i+length])
            outcome = colors[i+length]
            
            # Simplified: Normalize violet
            norm_seq = tuple(['red' if 'red' in c or 'violet' == c else 'green' for c in seq])
            norm_outcome = 'red' if 'red' in outcome or 'violet' == outcome else 'green'
            
            pattern_id = (norm_seq, norm_outcome)
            if pattern_id not in patterns_found:
                patterns_found[pattern_id] = {'wins': 0, 'total': 0}
            
            patterns_found[pattern_id]['total'] += 1
            if norm_outcome in norm_seq[-1]: # Simplistic "Continue" logic check as example
                 patterns_found[pattern_id]['wins'] += 1

    # Sort and show top 5
    print("\n--- TOP PATTERNS (LOCAL PYTHON ANALYZER) ---")
    results = []
    for (seq, bet), stats in patterns_found.items():
        if stats['total'] > 10:
            wr = (stats['wins'] / stats['total']) * 100
            results.append((seq, bet, wr, stats['total']))
    
    results.sort(key=lambda x: x[2], reverse=True)
    
    for seq, bet, wr, count in results[:10]:
        seq_str = " -> ".join([s.upper()[0] for s in seq])
        print(f"[{seq_str}] Bet: {bet.upper()} | WinRate: {wr:.1f}% | Occurrences: {count}")

if __name__ == "__main__":
    print("WinGo Local Python Analyzer Started")
    data = fetch_data(1500)
    evaluate_patterns(data)
    print("\nAnalysis Complete. Run again whenever you want fresh results.")
