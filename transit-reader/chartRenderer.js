import {
    lonToXY, lonToSign,
    PLANET_SYMBOLS, ASPECT_COLORS,
    SIGN_SYMBOLS, SIGN_NAMES,
    BG, STROKE
} from './chartHelpers.js';

function angDiff(a, b) {
    return ((a - b + 180) % 360 + 360) % 360 - 180;
}

function layoutGlyphs(planets, minSepDeg) {
    if (!planets || planets.length === 0) return [];

    const items = planets.map(p => ({ ...p, drawLon: p.longitude }));
    items.sort((a, b) => a.longitude - b.longitude);

    const CLUSTER_GAP = 22; 
    const clusters = [];
    let group = [0];
    for (let i = 1; i < items.length; i++) {
        const gap = Math.abs(angDiff(items[i].longitude, items[group[group.length - 1]].longitude));
        if (gap < CLUSTER_GAP) {
            group.push(i);
        } else {
            clusters.push(group);
            group = [i];
        }
    }
    clusters.push(group);

    for (const grp of clusters) {
        if (grp.length < 2) continue;
        const lons = grp.map(i => items[i].longitude);
        const center = lons.reduce((s, l) => s + l, 0) / lons.length;
        const span = (grp.length - 1) * minSepDeg;
        grp.forEach((idx, i) => {
            items[idx].drawLon = center - span / 2 + i * minSepDeg;
        });
    }

    for (let k = 1; k < clusters.length; k++) {
        const prev = clusters[k - 1];
        const curr = clusters[k];
        const prevMax = items[prev[prev.length - 1]].drawLon;
        const currMin = items[curr[0]].drawLon;
        if (currMin < prevMax + minSepDeg) {
            const shift = prevMax + minSepDeg - currMin;
            curr.forEach(idx => { items[idx].drawLon += shift; });
        }
    }

    const byLon = [...items].sort((a, b) => a.longitude - b.longitude);
    const drawLons = byLon.map(it => it.drawLon).sort((a, b) => a - b);
    byLon.forEach((it, i) => { it.drawLon = drawLons[i]; });

    return items;
}

export function generateChartSVG(natalChart, transitData, highlight = null) {
    if (!natalChart) return '';

    const S = 960, cx = 480, cy = 480;
    const K = STROKE;

    const R_TR = 420;  
    const R_TR_RING = 380;  
    const R_NAT = 240;  
    const R_OUTER = 260;  
    const R_SIGN = 238;  
    const R_INNER = 220;  
    const R_HOUSE = 214;  
    const R_CTR = 50;

    const natal = natalChart.planets || [];
    const houses = natalChart.houses;
    const asc = houses?.ascendant?.longitude || 0;
    const transits = transitData?.transits || [];
    const aspects = transitData?.aspects || [];

    let svg = `<svg viewBox="-20 -20 ${S + 40} ${S + 40}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">`;

    svg += `<rect x="-20" y="-20" width="${S + 40}" height="${S + 40}" fill="${BG}"/>`;

    if (transits.length > 0) {
        svg += `<circle cx="${cx}" cy="${cy}" r="${R_TR_RING}" fill="none" stroke="${K}" stroke-width="2"/>`;
    }
    svg += `<circle cx="${cx}" cy="${cy}" r="${R_OUTER}" fill="none" stroke="${K}" stroke-width="3"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${R_INNER}" fill="none" stroke="${K}" stroke-width="3"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${R_CTR}" fill="none" stroke="${K}" stroke-width="2"/>`;

    for (let deg = 0; deg < 360; deg++) {
        const isMajor = deg % 30 === 0;
        const isFive = deg % 5 === 0;
        if (isMajor) continue; 
        const tickLen = isFive ? 12 : 6;
        const p1 = lonToXY(deg, R_INNER, cx, cy, asc); 
        const p2 = lonToXY(deg, R_INNER - tickLen, cx, cy, asc); 
        svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${K}" stroke-width="${isFive ? 1.5 : 0.8}" opacity="${isFive ? 0.5 : 0.3}"/>`;
    }

    for (let i = 0; i < 12; i++) {
        const sL = i * 30;
        const d1 = lonToXY(sL, R_OUTER, cx, cy, asc);
        const d2 = lonToXY(sL, R_INNER, cx, cy, asc);
        svg += `<line x1="${d1.x}" y1="${d1.y}" x2="${d2.x}" y2="${d2.y}" stroke="${K}" stroke-width="2.5"/>`;

        const mid = lonToXY(sL + 15, R_SIGN, cx, cy, asc);
        svg += `<text x="${mid.x}" y="${mid.y}" text-anchor="middle" dominant-baseline="central" fill="${K}" font-size="26" font-family="serif" font-weight="bold" opacity="0.85">${SIGN_SYMBOLS[i]}</text>`;
    }

    if (houses) {
        houses.cusps.forEach(c => {
            const isAng = [1, 4, 7, 10].includes(c.house);
            const p1 = lonToXY(c.longitude, R_HOUSE, cx, cy, asc);
            const p2 = lonToXY(c.longitude, R_CTR, cx, cy, asc);
            svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${K}" stroke-width="${isAng ? 2.5 : 1}" opacity="${isAng ? 0.6 : 0.2}"/>`;
        });

        houses.cusps.forEach((c, i) => {
            const next = houses.cusps[(i + 1) % 12];
            let midLon = c.longitude + ((((next.longitude - c.longitude) + 360) % 360) / 2);
            const p = lonToXY(midLon, (R_HOUSE + R_CTR) / 2, cx, cy, asc);
            svg += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" fill="${K}" font-size="13" font-weight="700" opacity="0.35" font-family="'Inter',sans-serif">${c.house}</text>`;
        });

        const labels = [
            { l: houses.ascendant.longitude, t: 'AC' },
            { l: (houses.ascendant.longitude + 180) % 360, t: 'DC' },
            { l: houses.midheaven.longitude, t: 'MC' },
            { l: (houses.midheaven.longitude + 180) % 360, t: 'IC' },
        ];
        for (const { l, t } of labels) {
            const p = lonToXY(l, R_OUTER + 22, cx, cy, asc);
            svg += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" fill="${K}" font-size="15" font-weight="900" font-family="'Inter',sans-serif" letter-spacing="1">${t}</text>`;
        }
    }

    const starR = R_CTR - 8;
    for (let i = 0; i < 6; i++) {
        const a1 = (i * 60) * Math.PI / 180;
        const a2 = ((i + 3) * 60) * Math.PI / 180;
        svg += `<line x1="${cx + starR * Math.cos(a1)}" y1="${cy + starR * Math.sin(a1)}" x2="${cx + starR * Math.cos(a2)}" y2="${cy + starR * Math.sin(a2)}" stroke="${K}" stroke-width="1.5" opacity="0.4"/>`;
    }
    svg += `<circle cx="${cx}" cy="${cy}" r="4" fill="${K}"/>`;

    const sigA = aspects.filter(a => a.exactness >= 45 && a.type === 'major').slice(0, 20);
    for (const a of sigA) {
        const tp = transits.find(p => p.name === a.transitPlanet);
        const np = natal.find(p => p.name === a.natalPlanet);
        if (!tp || !np) continue;
        const hl = highlight && (highlight.transitPlanet === a.transitPlanet || highlight.natalPlanet === a.natalPlanet);
        const op = hl ? 0.65 : Math.max(0.07, (a.exactness / 100) * 0.25);
        const col = a.nature === 'challenging' ? '#300808' : (a.nature === 'harmonious' ? '#08082a' : K);
        const q1 = lonToXY(tp.longitude, R_TR_RING, cx, cy, asc);
        const q2 = lonToXY(np.longitude, R_INNER, cx, cy, asc);
        svg += `<line x1="${q1.x}" y1="${q1.y}" x2="${q2.x}" y2="${q2.y}" stroke="${col}" stroke-width="${hl ? 2.5 : 1.5}" opacity="${op}"/>`;
        if (hl) {
            svg += `<circle cx="${q1.x}" cy="${q1.y}" r="4" fill="${K}" opacity="0.6"/>`;
            svg += `<circle cx="${q2.x}" cy="${q2.y}" r="4" fill="${K}" opacity="0.6"/>`;
        }
    }

    const R_NAT_GLYPH = R_INNER + 20; 
    const natalItems = layoutGlyphs(natal, 15);
    for (const p of natalItems) {
        const pos = lonToXY(p.drawLon, R_NAT_GLYPH, cx, cy, asc);
        const dot = lonToXY(p.longitude, R_INNER, cx, cy, asc);
        const stub = lonToXY(p.longitude, R_INNER + 10, cx, cy, asc);
        const sym = PLANET_SYMBOLS[p.name] || '?';
        const hl = highlight && highlight.natalPlanet === p.name;
        const info = lonToSign(p.longitude);
        const tip = `${p.name} ${info.deg}°${String(info.min).padStart(2, '0')}' ${info.sign}${p.retrograde ? ' ℞' : ''}`;

        svg += `<circle cx="${dot.x}" cy="${dot.y}" r="${hl ? 5 : 3.5}" fill="${K}" stroke="${K}" stroke-width="1"/>`;
        svg += `<line x1="${stub.x}" y1="${stub.y}" x2="${pos.x}" y2="${pos.y}" stroke="${K}" stroke-width="0.9" opacity="0.4"/>`;

        const r = hl ? 20 : 17;
        svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${r}" fill="${BG}" stroke="${K}" stroke-width="${hl ? 2.5 : 2}" data-natal-planet="${p.name}" style="cursor:pointer"/>`;
        svg += `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" fill="${K}" font-size="${hl ? 26 : 20}" font-family="serif" font-weight="bold" pointer-events="none"><title>${tip}</title>${sym}</text>`;
        if (p.retrograde) {
            svg += `<text x="${pos.x + r + 3}" y="${pos.y - r + 2}" fill="${K}" font-size="10" font-weight="900" opacity="0.65">℞</text>`;
        }
    }

    const transitItems = layoutGlyphs(transits, 20);
    for (const p of transitItems) {
        const pos = lonToXY(p.drawLon, R_TR, cx, cy, asc);
        const ring = lonToXY(p.longitude, R_TR_RING, cx, cy, asc);
        const stub = lonToXY(p.longitude, R_TR_RING + 22, cx, cy, asc);
        const sym = PLANET_SYMBOLS[p.name] || '?';
        const hl = highlight && highlight.transitPlanet === p.name;
        const info = lonToSign(p.longitude);
        const tip = `${p.name} ${info.deg}°${String(info.min).padStart(2, '0')}' ${info.sign}${p.retrograde ? ' ℞' : ''}`;
        const active = aspects.some(a => a.transitPlanet === p.name && a.exactness >= 55);

        svg += `<line x1="${ring.x}" y1="${ring.y}" x2="${stub.x}" y2="${stub.y}" stroke="${K}" stroke-width="1.5" opacity="0.65"/>`;
        svg += `<line x1="${stub.x}" y1="${stub.y}" x2="${pos.x}" y2="${pos.y}" stroke="${K}" stroke-width="1" opacity="0.35"/>`;
        svg += `<circle cx="${ring.x}" cy="${ring.y}" r="${hl ? 7 : 5}" fill="${active || hl ? K : 'none'}" stroke="${K}" stroke-width="1.8"/>`;

        const r = hl ? 24 : 20;
        svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${r}" fill="${BG}" stroke="${K}" stroke-width="${hl ? 3 : 2}" data-transit-planet="${p.name}" style="cursor:pointer"/>`;
        svg += `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" fill="${K}" font-size="${hl ? 30 : 24}" font-family="serif" font-weight="bold" pointer-events="none"><title>${tip}</title>${sym}</text>`;
        if (p.retrograde) {
            svg += `<text x="${pos.x + r + 3}" y="${pos.y - r + 2}" fill="${K}" font-size="11" font-weight="900" opacity="0.65">℞</text>`;
        }
    }

    svg += '</svg>';
    return svg;
}
