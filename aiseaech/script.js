const TRENDS_URL = 'http://localhost:3000/trends';

const chatWindow = document.getElementById('chat-window');
const refreshBtn = document.getElementById('refresh-btn');

refreshBtn.addEventListener('click', loadTrends);

// Load trends on page load
document.addEventListener('DOMContentLoaded', loadTrends);

function loadTrends() {
    chatWindow.innerHTML = '<div class="message bot-message">Loading trending searches...</div>';
    
    fetchTrends();
}

async function fetchTrends() {
    try {
        const response = await fetch(TRENDS_URL);

        if (!response.ok) {
            throw new Error('Failed to fetch trends');
        }

        const xmlText = await response.text();
        const trends = parseTrends(xmlText);
        displayTrends(trends);
    } catch (error) {
        chatWindow.innerHTML = '<div class="message bot-message">Sorry, there was an error loading trends.</div>';
        console.error(error);
    }
}

function parseTrends(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const items = xmlDoc.getElementsByTagName('item');
    const trends = [];

    for (let i = 0; i < items.length; i++) {
        const title = items[i].getElementsByTagName('title')[0]?.textContent || '';
        const description = items[i].getElementsByTagName('description')[0]?.textContent || '';
        trends.push({ title, description });
    }

    return trends;
}

function displayTrends(trends) {
    chatWindow.innerHTML = '';

    if (trends.length === 0) {
        chatWindow.innerHTML = '<div class="message bot-message">No trending searches found.</div>';
        return;
    }

    trends.forEach(trend => {
        const trendDiv = document.createElement('div');
        trendDiv.className = 'message bot-message';
        trendDiv.innerHTML = `<strong>${trend.title}</strong><br>${trend.description}`;
        chatWindow.appendChild(trendDiv);
    });
}