import express from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY environment variables.");
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

const API_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json';

const PROXIES = [
    (url) => url, // Direct
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

async function fetchWithRetry() {
    for (let proxy of PROXIES) {
        try {
            const url = proxy(API_URL);
            console.log(`Fetching via: ${url.substring(0, 50)}...`);
            const res = await axios.get(url, { 
                timeout: 8000, 
                headers: { 'User-Agent': 'Mozilla/5.0' } 
            });
            let data = res.data;
            if (typeof data === 'string') data = JSON.parse(data);
            const items = data.data?.list || data.list || [];
            if (Array.isArray(items) && items.length > 0) return items;
        } catch (e) {
            console.warn(`Proxy failed: ${e.message}`);
        }
    }
    return [];
}

// Collector Logic
async function syncData() {
    const now = new Date().toISOString();
    console.log(`[${now}] Starting Sync...`);
    try {
        const items = await fetchWithRetry();

        if (items.length === 0) {
            console.log("No data found from any proxy.");
            return;
        }

        const sanitized = items.map(item => {
            const issueVal = item.issue || item.issueNumber || item.period;
            return {
                issue: issueVal ? String(issueVal) : 'undefined',
                color: String(item.color || item.resultColor || 'UNKNOWN'),
                timestamp: Number(item.timestamp || item.time || Date.now())
            };
        }).filter(item => item.issue !== 'undefined');

        if (sanitized.length === 0) {
            console.log("No valid rounds to sync (all issues undefined).");
            return;
        }

        // Remove duplicates WITHIN the same request to prevent Supabase ON CONFLICT error
        const uniqueItems = Array.from(new Map(sanitized.map(item => [item.issue, item])).values());


        const { error } = await supabase
            .from('wingo_history')
            .upsert(uniqueItems, { onConflict: 'issue' });

        if (error) console.error("Supabase Error:", error.message);
        else console.log(`Sync Successful: ${uniqueItems.length} unique rounds.`);

        
    } catch (e) {
        console.error("Critical Sync Error:", e.message);
    }
}


// 24/7 Loop: Run every 30 seconds
setInterval(syncData, 30000);

// Basic Health Check
app.get('/', (req, res) => {
    res.send({ status: 'online', message: 'WinGo 24/7 Collector is active.' });
});

app.listen(port, () => {
    console.log(`Collector server listening on port ${port}`);
    syncData();
});

