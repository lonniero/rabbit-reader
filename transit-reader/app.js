import { calcTransits } from './api.js';
import { generateChartSVG } from './chartRenderer.js';
import { lonToSign } from './chartHelpers.js';

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
  const { transits } = appData.transits; // Transit planets
  const aspects = appData.transits.aspects.slice(0, 15); // Top 15 aspects
  
  let html = '';
  aspects.forEach(a => {
    html += `
      <div class="transit-item">
        <div class="transit-header">
          <span>${a.transitSymbol} ${a.transitPlanet}</span>
          <span>${a.aspectSymbol} ${a.aspect}</span>
          <span>${a.natalSymbol} ${a.natalPlanet} (Natal)</span>
        </div>
        <div class="transit-details">
          Orb: ${a.orb}° | Exactness: ${a.exactness}% | Nature: ${a.nature}
        </div>
      </div>
    `;
  });
  
  if (!html) html = '<div style="padding:20px;text-align:center;">No significant transits right now.</div>';
  els.listContent.innerHTML = html;
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
