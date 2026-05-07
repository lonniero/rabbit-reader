import { calcTransits } from './api.js?v=14';
import { generateChartSVG } from './chartRenderer.js?v=14';
import { lonToSign } from './chartHelpers.js?v=14';

let appData = null;

const els = {
  loading: document.getElementById('loading'),
  loadingText: document.getElementById('loading-text'),
  listView: document.getElementById('view-list'),
  mandalaView: document.getElementById('view-mandala'),
  combinedView: document.getElementById('view-combined'),
  listContent: document.getElementById('transit-list'),
  mandalaChart: document.getElementById('chart-mandala'),
  combinedChart: document.getElementById('chart-combined'),
  navBtns: document.querySelectorAll('.nav-btn')
};

async function init() {
  try {
    els.loadingText.innerText = 'Locating...';
    const coords = await getLocation();
    
    els.loadingText.innerText = 'Calculating...';
    
    // We request the transits for the 'default' profile
    // If no profile exists, the backend might fail, but let's assume 'default' works 
    // or we can pass a dummy profileId if the backend allows on-the-fly.
    appData = await calcTransits({
      profileId: 'default',
      currentLat: coords.lat,
      currentLon: coords.lon,
      date: new Date().toISOString()
    });

    renderAll();
    els.loading.style.display = 'none';

  } catch (err) {
    els.loadingText.innerText = `Error: ${err.message}`;
    console.error(err);
  }
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 40.7128, lon: -74.0060 }); // Default NYC
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => {
        console.warn('Geolocation failed', err);
        resolve({ lat: 40.7128, lon: -74.0060 });
      },
      { timeout: 5000 }
    );
  });
}

function renderAll() {
  renderList();
  renderMandala();
  renderCombined();
}

function renderList() {
  const transits = appData.transits.transits; // Array of transit planets
  
  const now = new Date();
  const dateOpts = { day: 'numeric', month: 'short', year: 'numeric' };
  const timeOpts = { hour: '2-digit', minute: '2-digit', hour12: false };
  const dateStr = now.toLocaleDateString('en-GB', dateOpts);
  const timeStr = now.toLocaleTimeString('en-GB', timeOpts);

  let html = `
    <div class="cp-header">
      <div class="cp-title">Current Planets</div>
      <div class="cp-subtitle">${dateStr}, ${timeStr} Local</div>
    </div>
    <div class="cp-table">
  `;

  transits.forEach(p => {
    // Format latitude
    const latDeg = Math.floor(Math.abs(p.latitude));
    const latMin = Math.floor((Math.abs(p.latitude) - latDeg) * 60);
    const latDir = p.latitude >= 0 ? 'n' : 's';
    const latStr = `${latDeg}${latDir}${latMin.toString().padStart(2, '0')}`;

    // Format retrograde
    const retroStr = p.retrograde ? 'r' : '';
    const minSecStr = `${p.minute}'${p.second.toString().padStart(2, '0')}"${retroStr}`;
    
    // Astrodienst-like sign colors
    const signColor = getSignColor(p.signIndex);

    html += `
      <div class="cp-row">
        <div class="cp-glyph">${p.symbol}</div>
        <div class="cp-name">${p.name}</div>
        <div class="cp-deg">${p.degree}</div>
        <div class="cp-sign" style="color: ${signColor};">${p.signSymbol}</div>
        <div class="cp-minsec">${minSecStr}</div>
        <div class="cp-lat">${latStr}</div>
      </div>
    `;
  });
  
  html += `</div>`;
  els.listContent.innerHTML = html;
}

function getSignColor(index) {
  const element = index % 4;
  if (element === 0) return '#ef4444'; // Fire (Aries, Leo, Sag) -> Red
  if (element === 1) return '#22c55e'; // Earth (Taurus, Virgo, Cap) -> Green
  if (element === 2) return '#f59e0b'; // Air (Gemini, Libra, Aq) -> Orange
  if (element === 3) return '#3b82f6'; // Water (Cancer, Scorpio, Pisces) -> Blue
  return '#fff';
}

function renderMandala() {
  // For the transit mandala, we treat transits as the natal chart
  // so they are drawn on the inner ring. We pass no transits data.
  const chartData = {
    planets: appData.transits.transits,
    houses: appData.transits.transitHouses
  };
  const svg = generateChartSVG(chartData, null);
  els.mandalaChart.innerHTML = svg;
}

function renderCombined() {
  // For combined, natal chart is inner, transits are outer
  const svg = generateChartSVG(appData.natal, appData.transits);
  els.combinedChart.innerHTML = svg;
}

// Navigation
window.switchView = function(viewId) {
  // Update buttons
  els.navBtns.forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[onclick="switchView('${viewId}')"]`).classList.add('active');
  
  // Update views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}

// Start
init();
