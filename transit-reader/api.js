export const BASE = 'https://astro-clock-production.up.railway.app';

export async function api(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

export const calcTransits = (data) => api('/api/transits', { method: 'POST', body: JSON.stringify(data) });
