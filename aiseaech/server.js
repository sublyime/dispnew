const express = require('express');
// Use native fetch in Node 18+
const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)));
const app = express();
const port = 3000;

app.get('/trends', async (req, res) => {
    try {
        const response = await fetch('https://trends.google.com/trends/hottrends/atom/feed?pn=p1');
        const xmlText = await response.text();
        res.header('Access-Control-Allow-Origin', '*');
        res.send(xmlText);
    } catch (error) {
        res.status(500).send('Error fetching trends');
    }
});

app.listen(port, () => {
    console.log(`Proxy server running at http://localhost:${port}`);
});