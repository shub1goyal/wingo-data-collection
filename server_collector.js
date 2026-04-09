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

// Collector Logic
async function syncData() {
    const now = new Date().toISOString();
    console.log(`[${now}] Starting Sync...`);
    try {
        const response = await axios.get(API_URL, { timeout: 10000 });
        const data = response.data;
        const items = data.data?.list || [];

        if (items.length === 0) {
            console.log("No new data found.");
            return;
        }

        const sanitized = items.map(item => ({
            issue: String(item.issue),
            color: String(item.color || 'UNKNOWN'),
            timestamp: Number(item.timestamp || Date.now())
        }));

        const { error } = await supabase
            .from('wingo_history')
            .upsert(sanitized, { onConflict: 'issue' });

        if (error) console.error("Supabase Error:", error.message);
        else console.log(`Sync Successful: ${sanitized.length} rounds.`);
        
    } catch (e) {
        console.error("Fetch Error:", e.message);
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

