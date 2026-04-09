const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://amhuejwptegjwohwfluk.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_7xsYTB6aSvii6Wu2kbFV2A_a8T37Ys7';
const supabase = createClient(supabaseUrl, supabaseKey);

const API_URL = 'https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json';

// Collector Logic
async function syncData() {
    const now = new Date().toISOString();
    console.log(`[${now}] Starting Sync...`);
    try {
        const response = await axios.get(API_URL, { timeout: 10000 });
        const data = response.data;
        const items = data.data?.list || [];

        if (items.length === 0) return;

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

// Basic Health Check Endpoint for Render/UptimeRobot
app.get('/', (req, res) => {
    res.send({
        status: 'online',
        message: 'WinGo 24/7 Collector is running.',
        timestamp: new Date().toISOString()
    });
});

app.listen(port, () => {
    console.log(`Collector server listening on port ${port}`);
    // Run once immediately on start
    syncData();
});
