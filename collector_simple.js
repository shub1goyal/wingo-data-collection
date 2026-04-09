import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY are required in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TARGET_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
};

const PROXIES = [
  (url) => url,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

async function fetchWithRetry() {
  for (let proxy of PROXIES) {
    try {
      const url = proxy(TARGET_URL);
      console.log(`Fetching via: ${url.substring(0, 50)}...`);
      const res = await axios.get(url, { headers: HEADERS, timeout: 5000 });
      let data = res.data;
      if (typeof data === 'string') data = JSON.parse(data);
      
      const items = data.data?.list || data.list || data.data || [];
      if (Array.isArray(items) && items.length > 0) return items;
    } catch (e) {
      console.warn(`Proxy failed: ${e.message}`);
    }
  }
  return [];
}

async function run() {
  console.log(`[${new Date().toISOString()}] Starting collection...`);
  const rawItems = await fetchWithRetry();
  
  if (rawItems.length === 0) {
    console.log('No data found.');
    return;
  }

  const sanitized = rawItems.map(item => ({
    issue: String(item.issue || item.issueNumber || item.period),
    color: String(item.color || item.resultColor || 'UNKNOWN'),
    timestamp: Number(item.timestamp || item.time || Date.now())
  })).filter(i => i.issue !== 'undefined');

  console.log(`Found ${sanitized.length} issues. Upserting to Supabase...`);

  const { error } = await supabase
    .from('wingo_history')
    .upsert(sanitized, { onConflict: 'issue' });

  if (error) {
    console.error('Supabase Error (Upsert):', error.message);
  } else {
    console.log('Success! Data updated.');
    
    // [ROLLING DATA CLEANUP] Delete data older than 48 hours
    const fortyEightHoursAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
    console.log(`Cleaning up data older than: ${new Date(fortyEightHoursAgo).toISOString()}`);
    
    const { error: deleteError } = await supabase
      .from('wingo_history')
      .delete()
      .lt('timestamp', fortyEightHoursAgo);
      
    if (deleteError) {
      console.error('Supabase Error (Cleanup):', deleteError.message);
    } else {
      console.log('Cleanup successful: Data limited to latest 2 days.');
    }
  }
}

run();
