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

    // Adjust radii for a clean layout matching the screenshot
    const R_TR = 440;  
    const R_TR_RING = 380;  
    
    // Make the outer sign ring look like the screenshot
    const R_OUTER = 260;  
    const R_SIGN = 240;  
    const R_INNER = 220;  
    const R_HOUSE = 214;  
    const R_CTR = 30; // Smaller center circle

    const natal = natalChart.planets || [];
    const houses = natalChart.houses;
    const asc = houses?.ascendant?.longitude || 0;
    const transits = transitData?.transits || [];
    const aspects = transitData?.aspects || natalChart.aspects || [];

    // Background white
    let svg = `<svg viewBox="-20 -20 ${S + 40} ${S + 40}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;background-color:${BG};">`;

    if (transits.length > 0) {
        svg += `<circle cx="${cx}" cy="${cy}" r="${R_TR_RING}" fill="none" stroke="${K}" stroke-width="1.5"/>`;
    }
    
    // Rings
    svg += `<circle cx="${cx}" cy="${cy}" r="${R_OUTER}" fill="none" stroke="${K}" stroke-width="1.5"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${R_INNER}" fill="none" stroke="${K}" stroke-width="1.5"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${R_CTR}" fill="none" stroke="${K}" stroke-width="1.5"/>`;

    // Degree Ticks on the inside of R_INNER
    for (let deg = 0; deg < 360; deg++) {
        const isMajor = deg % 30 === 0;
        const isFive = deg % 5 === 0;
        if (isMajor) continue; 
        const tickLen = isFive ? 8 : 4;
        const p1 = lonToXY(deg, R_INNER, cx, cy, asc); 
        const p2 = lonToXY(deg, R_INNER - tickLen, cx, cy, asc); 
        svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${K}" stroke-width="${isFive ? 1 : 0.5}" opacity="0.6"/>`;
    }

    // Sign Boundaries and Glyphs
    for (let i = 0; i < 12; i++) {
        const sL = i * 30;
        const d1 = lonToXY(sL, R_OUTER, cx, cy, asc);
        const d2 = lonToXY(sL, R_INNER, cx, cy, asc);
        svg += `<line x1="${d1.x}" y1="${d1.y}" x2="${d2.x}" y2="${d2.y}" stroke="${K}" stroke-width="1.5"/>`;

        const mid = lonToXY(sL + 15, R_SIGN, cx, cy, asc);
        const signColor = SIGN_COLORS ? SIGN_COLORS[i] : K;
        svg += `<text x="${mid.x}" y="${mid.y}" text-anchor="middle" dominant-baseline="central" fill="${signColor}" font-size="28" font-family="serif" font-weight="bold">${SIGN_SYMBOLS[i]}</text>`;
    }

    // Houses
    if (houses) {
        houses.cusps.forEach(c => {
            const isAng = [1, 4, 7, 10].includes(c.house);
            const p1 = lonToXY(c.longitude, R_HOUSE, cx, cy, asc);
            const p2 = lonToXY(c.longitude, R_CTR, cx, cy, asc);
            svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${K}" stroke-width="${isAng ? 1.5 : 0.5}" opacity="${isAng ? 1 : 0.5}"/>`;
        });

        // House numbers
        houses.cusps.forEach((c, i) => {
            const next = houses.cusps[(i + 1) % 12];
            let midLon = c.longitude + ((((next.longitude - c.longitude) + 360) % 360) / 2);
            const p = lonToXY(midLon, R_INNER - 15, cx, cy, asc);
            svg += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" fill="${K}" font-size="12" font-weight="700" opacity="0.8" font-family="'Inter',sans-serif">${c.house}</text>`;
        });

        // AC / DC / MC / IC Labels
        const labels = [
            { l: houses.ascendant.longitude, t: 'AC' },
            { l: houses.midheaven.longitude, t: 'MC' },
        ];
        for (const { l, t } of labels) {
            const p = lonToXY(l, R_OUTER + 35, cx, cy, asc);
            svg += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" fill="${K}" font-size="32" font-family="serif">${t}</text>`;
            // Arrow pointing to cusp
            const pArr = lonToXY(l, R_OUTER + 15, cx, cy, asc);
            const pTip = lonToXY(l, R_OUTER, cx, cy, asc);
            svg += `<line x1="${p.x}" y1="${p.y}" x2="${pArr.x}" y2="${pArr.y}" stroke="${K}" stroke-width="2"/>`;
            // Draw an actual arrowhead (simple triangle)
            const angle = Math.atan2(pTip.y - pArr.y, pTip.x - pArr.x);
            const a1 = angle - Math.PI / 6;
            const a2 = angle + Math.PI / 6;
            const headLen = 10;
            svg += `<line x1="${pTip.x}" y1="${pTip.y}" x2="${pTip.x - headLen * Math.cos(a1)}" y2="${pTip.y - headLen * Math.sin(a1)}" stroke="${K}" stroke-width="2"/>`;
            svg += `<line x1="${pTip.x}" y1="${pTip.y}" x2="${pTip.x - headLen * Math.cos(a2)}" y2="${pTip.y - headLen * Math.sin(a2)}" stroke="${K}" stroke-width="2"/>`;
        }
    }

    // Aspects
    const aspectLines = aspects.filter(a => a.exactness >= 45 && a.type === 'major').slice(0, 30);
    for (const a of aspectLines) {
        // If it's a single chart, we draw aspects between natal planets
        // If it's a bi-wheel, we draw aspects between transit and natal
        const isBiWheel = transits.length > 0;
        let p1, p2;
        if (isBiWheel) {
            p1 = transits.find(p => p.name === a.transitPlanet);
            p2 = natal.find(p => p.name === a.natalPlanet);
        } else {
            p1 = natal.find(p => p.name === a.planet1 || p.name === a.transitPlanet);
            p2 = natal.find(p => p.name === a.planet2 || p.name === a.natalPlanet);
        }
        
        if (!p1 || !p2) continue;
        
        const q1 = lonToXY(p1.longitude, R_INNER, cx, cy, asc);
        const q2 = lonToXY(p2.longitude, R_INNER, cx, cy, asc);
        
        let col = ASPECT_COLORS[a.aspectType || a.nature] || K;
        if (!ASPECT_COLORS[a.aspectType] && a.nature) {
            col = a.nature === 'challenging' ? '#FF0000' : (a.nature === 'harmonious' ? '#0000FF' : K);
        }

        const isDashed = a.aspectType === 'quincunx' || a.aspectType === 'semisextile';
        svg += `<line x1="${q1.x}" y1="${q1.y}" x2="${q2.x}" y2="${q2.y}" stroke="${col}" stroke-width="1.2" opacity="0.8" ${isDashed ? 'stroke-dasharray="4,4"' : ''}/>`;
    }

    // Natal Planets (Main Chart)
    const R_NAT_GLYPH = R_OUTER + 70; 
    const natalItems = layoutGlyphs(natal, 12);
    for (const p of natalItems) {
        const pColor = PLANET_COLORS[p.name] || K;
        const sym = PLANET_SYMBOLS[p.name] || p.name.substring(0,2);
        const info = lonToSign(p.longitude);

        // Elbow geometry
        const pRadStart = lonToXY(p.longitude, R_INNER, cx, cy, asc);
        const pRadEnd = lonToXY(p.longitude, R_OUTER + 10, cx, cy, asc);
        const pGlyph = lonToXY(p.drawLon, R_NAT_GLYPH, cx, cy, asc);
        
        // Draw the elbow lines
        svg += `<line x1="${pRadStart.x}" y1="${pRadStart.y}" x2="${pRadEnd.x}" y2="${pRadEnd.y}" stroke="${pColor}" stroke-width="1" opacity="0.8"/>`;
        svg += `<line x1="${pRadEnd.x}" y1="${pRadEnd.y}" x2="${pGlyph.x}" y2="${pGlyph.y}" stroke="${pColor}" stroke-width="1" opacity="0.8"/>`;

        // Draw planet degree text
        const degStr = `${info.deg}°`;
        const minStr = `${String(info.min).padStart(2, '0')}'`;
        
        // Offset text based on position to avoid overlapping glyph
        const dx = p.drawLon > 90 && p.drawLon < 270 ? -25 : 25;
        const txtAnchor = p.drawLon > 90 && p.drawLon < 270 ? 'end' : 'start';

        svg += `<text x="${pGlyph.x + dx}" y="${pGlyph.y - 10}" text-anchor="${txtAnchor}" dominant-baseline="central" fill="${pColor}" font-size="12" font-weight="bold" font-family="'Inter',sans-serif">${degStr}</text>`;
        svg += `<text x="${pGlyph.x + dx}" y="${pGlyph.y + 10}" text-anchor="${txtAnchor}" dominant-baseline="central" fill="${pColor}" font-size="10" font-weight="normal" font-family="'Inter',sans-serif">${minStr}</text>`;

        // Draw Glyph
        svg += `<text x="${pGlyph.x}" y="${pGlyph.y}" text-anchor="middle" dominant-baseline="central" fill="${pColor}" font-size="34" font-family="serif" font-weight="bold">${sym}</text>`;
        
        if (p.retrograde) {
            svg += `<text x="${pGlyph.x + 14}" y="${pGlyph.y + 14}" fill="${pColor}" font-size="12" font-weight="900" opacity="0.8">Rx</text>`;
        }
    }

    // Transit Planets (Outer Ring, only if bi-wheel)
    if (transits.length > 0) {
        const transitItems = layoutGlyphs(transits, 12);
        for (const p of transitItems) {
            const pColor = PLANET_COLORS[p.name] || K;
            const sym = PLANET_SYMBOLS[p.name] || p.name.substring(0,2);
            const info = lonToSign(p.longitude);

            const pRadStart = lonToXY(p.longitude, R_TR_RING, cx, cy, asc);
            const pRadEnd = lonToXY(p.longitude, R_TR_RING + 15, cx, cy, asc);
            const pGlyph = lonToXY(p.drawLon, R_TR, cx, cy, asc);

            svg += `<line x1="${pRadStart.x}" y1="${pRadStart.y}" x2="${pRadEnd.x}" y2="${pRadEnd.y}" stroke="${pColor}" stroke-width="1.5" opacity="0.8"/>`;
            svg += `<line x1="${pRadEnd.x}" y1="${pRadEnd.y}" x2="${pGlyph.x}" y2="${pGlyph.y}" stroke="${pColor}" stroke-width="1" opacity="0.8"/>`;

            const degStr = `${info.deg}°`;
            const minStr = `${String(info.min).padStart(2, '0')}'`;
            const dx = p.drawLon > 90 && p.drawLon < 270 ? -30 : 30;
            const txtAnchor = p.drawLon > 90 && p.drawLon < 270 ? 'end' : 'start';

            svg += `<text x="${pGlyph.x + dx}" y="${pGlyph.y - 12}" text-anchor="${txtAnchor}" dominant-baseline="central" fill="${pColor}" font-size="14" font-weight="bold" font-family="'Inter',sans-serif">${degStr}</text>`;
            svg += `<text x="${pGlyph.x + dx}" y="${pGlyph.y + 12}" text-anchor="${txtAnchor}" dominant-baseline="central" fill="${pColor}" font-size="12" font-weight="normal" font-family="'Inter',sans-serif">${minStr}</text>`;

            svg += `<text x="${pGlyph.x}" y="${pGlyph.y}" text-anchor="middle" dominant-baseline="central" fill="${pColor}" font-size="40" font-family="serif" font-weight="bold">${sym}</text>`;
            
            if (p.retrograde) {
                svg += `<text x="${pGlyph.x + 18}" y="${pGlyph.y + 18}" fill="${pColor}" font-size="14" font-weight="900" opacity="0.8">Rx</text>`;
            }
        }
    }

    svg += '</svg>';
    return svg;
}
