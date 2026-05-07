import {
    lonToXY, lonToSign,
    PLANET_SYMBOLS, PLANET_COLORS, ASPECT_COLORS,
    SIGN_SYMBOLS, SIGN_NAMES, SIGN_COLORS,
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

    // Astrotheme-style radii proportions scaled for 960x960
    const R_ASPECTS = 140;
    const R_ZODIAC_INNER = 200;
    const R_ZODIAC_OUTER = 280;
    
    // Natal planets are placed outside the zodiac ring
    const R_NATAL_PLANETS = 330;
    
    // Transit planets are placed in an even wider concentric circle
    const R_TRANSITS_INNER = 380;
    const R_TRANSIT_PLANETS = 440;

    const natal = natalChart.planets || [];
    const houses = natalChart.houses;
    const asc = houses?.ascendant?.longitude || 0;
    const transits = transitData?.transits || [];
    const aspects = transitData?.aspects || natalChart.aspects || [];

    // Background
    let svg = `<svg viewBox="-20 -20 ${S + 40} ${S + 40}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;background-color:${BG};">`;

    // Rings
    svg += `<circle cx="${cx}" cy="${cy}" r="${R_ZODIAC_OUTER}" fill="none" stroke="${K}" stroke-width="2"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${R_ZODIAC_INNER}" fill="none" stroke="${K}" stroke-width="2"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${R_ASPECTS}" fill="none" stroke="${K}" stroke-width="1.5"/>`;

    // Degree Ticks on the inner rim of the zodiac band, pointing INTO the band
    for (let deg = 0; deg < 360; deg++) {
        const isMajor = deg % 30 === 0;
        const isTen = deg % 10 === 0;
        const isFive = deg % 5 === 0;
        if (isMajor) continue; 
        
        const tickLen = isTen ? 14 : (isFive ? 9 : 4);
        const p1 = lonToXY(deg, R_ZODIAC_INNER, cx, cy, asc); 
        const p2 = lonToXY(deg, R_ZODIAC_INNER + tickLen, cx, cy, asc); 
        svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${K}" stroke-width="${isFive ? 1.5 : 0.5}" opacity="0.8"/>`;
    }

    // Sign Boundaries — only span the zodiac band (outer to inner)
    for (let i = 0; i < 12; i++) {
        const sL = i * 30;
        
        const d1 = lonToXY(sL, R_ZODIAC_OUTER, cx, cy, asc);
        const d2 = lonToXY(sL, R_ZODIAC_INNER, cx, cy, asc);
        svg += `<line x1="${d1.x}" y1="${d1.y}" x2="${d2.x}" y2="${d2.y}" stroke="${K}" stroke-width="1.5"/>`;

        // Zodiac symbols sit in the upper half of the zodiac band (above ticks)
        const mid = lonToXY(sL + 15, R_ZODIAC_INNER + (R_ZODIAC_OUTER - R_ZODIAC_INNER) * 0.6, cx, cy, asc);
        const signColor = SIGN_COLORS ? SIGN_COLORS[i] : K;
        svg += `<text x="${mid.x}" y="${mid.y}" text-anchor="middle" dominant-baseline="central" fill="${signColor}" font-size="40" font-family="serif" font-weight="bold">${SIGN_SYMBOLS[i]}</text>`;
    }

    // Houses
    if (houses) {
        // House cusp lines span from R_ZODIAC_INNER to R_ASPECTS (house area only)
        houses.cusps.forEach(c => {
            const isAng = [1, 4, 7, 10].includes(c.house);
            const p1 = lonToXY(c.longitude, R_ZODIAC_INNER, cx, cy, asc);
            const p2 = lonToXY(c.longitude, R_ASPECTS, cx, cy, asc);
            svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${K}" stroke-width="${isAng ? 2 : 0.8}" opacity="${isAng ? 1 : 0.6}"/>`;
        });

        // House numbers on the outer rim of the house area (just inside R_ZODIAC_INNER)
        houses.cusps.forEach((c, i) => {
            const next = houses.cusps[(i + 1) % 12];
            // Place number at the midpoint between this cusp and the next
            let midLon = c.longitude + ((((next.longitude - c.longitude) + 360) % 360) / 2);
            const p = lonToXY(midLon, R_ZODIAC_INNER - 16, cx, cy, asc);
            svg += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" fill="${K}" font-size="14" font-weight="bold" opacity="0.7" font-family="'Inter',sans-serif">${c.house}</text>`;
        });

        // AC / DC / MC / IC Labels
        const labels = [
            { l: houses.ascendant.longitude, t: 'AC' },
            { l: houses.midheaven.longitude, t: 'MC' },
            { l: (houses.ascendant.longitude + 180) % 360, t: 'DC' },
            { l: (houses.midheaven.longitude + 180) % 360, t: 'IC' }
        ];
        for (const { l, t } of labels) {
            const p = lonToXY(l, R_ZODIAC_OUTER + 30, cx, cy, asc);
            svg += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" fill="${K}" font-size="22" font-family="serif" font-weight="bold">${t}</text>`;
            // Arrow pointing to cusp
            const pArr = lonToXY(l, R_ZODIAC_OUTER + 15, cx, cy, asc);
            const pTip = lonToXY(l, R_ZODIAC_OUTER, cx, cy, asc);
            svg += `<line x1="${p.x}" y1="${p.y}" x2="${pArr.x}" y2="${pArr.y}" stroke="${K}" stroke-width="2"/>`;
            // Draw arrowhead
            const angle = Math.atan2(pTip.y - pArr.y, pTip.x - pArr.x);
            const a1 = angle - Math.PI / 6;
            const a2 = angle + Math.PI / 6;
            const headLen = 8;
            svg += `<line x1="${pTip.x}" y1="${pTip.y}" x2="${pTip.x - headLen * Math.cos(a1)}" y2="${pTip.y - headLen * Math.sin(a1)}" stroke="${K}" stroke-width="2"/>`;
            svg += `<line x1="${pTip.x}" y1="${pTip.y}" x2="${pTip.x - headLen * Math.cos(a2)}" y2="${pTip.y - headLen * Math.sin(a2)}" stroke="${K}" stroke-width="2"/>`;
        }
    }

    // Aspects (Connecting points exclusively inside the R_ASPECTS ring)
    const aspectLines = aspects.filter(a => a.exactness >= 45 && a.type === 'major').slice(0, 30);
    for (const a of aspectLines) {
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
        
        // Aspects connect the inner points (at R_ASPECTS)
        const q1 = lonToXY(p1.longitude, R_ASPECTS, cx, cy, asc);
        const q2 = lonToXY(p2.longitude, R_ASPECTS, cx, cy, asc);
        
        let col = ASPECT_COLORS[a.aspectType || a.nature] || K;
        if (!ASPECT_COLORS[a.aspectType] && a.nature) {
            col = a.nature === 'challenging' ? '#FF0000' : (a.nature === 'harmonious' ? '#0000FF' : K);
        }

        const isDashed = a.aspectType === 'quincunx' || a.aspectType === 'semisextile';
        svg += `<line x1="${q1.x}" y1="${q1.y}" x2="${q2.x}" y2="${q2.y}" stroke="${col}" stroke-width="1.5" opacity="0.8" ${isDashed ? 'stroke-dasharray="5,5"' : ''}/>`;
    }

    // Natal Planets (Main Chart)
    const isBiWheel = transits.length > 0;
    const natalItems = layoutGlyphs(natal, 8);
    for (const p of natalItems) {
        const pColor = PLANET_COLORS[p.name] || K;
        const sym = PLANET_SYMBOLS[p.name] || p.name.substring(0,2);
        const info = lonToSign(p.longitude);

        // Astrotheme style: straight angled stems originating from the outside of the Zodiac rim
        const pZodiacOuter = lonToXY(p.longitude, R_ZODIAC_OUTER, cx, cy, asc);
        const pGlyphEdge = lonToXY(p.drawLon, R_NATAL_PLANETS - 16, cx, cy, asc);
        const pGlyph = lonToXY(p.drawLon, R_NATAL_PLANETS, cx, cy, asc);

        // Draw straight stem
        svg += `<line x1="${pZodiacOuter.x}" y1="${pZodiacOuter.y}" x2="${pGlyphEdge.x}" y2="${pGlyphEdge.y}" stroke="${pColor}" stroke-width="1"/>`;

        // Planet degree text
        const degStr = `${info.deg}°`;
        const minStr = `${String(info.min).padStart(2, '0')}'`;
        
        const dx = p.drawLon > 90 && p.drawLon < 270 ? -24 : 24;
        const txtAnchor = p.drawLon > 90 && p.drawLon < 270 ? 'end' : 'start';

        svg += `<text x="${pGlyph.x + dx}" y="${pGlyph.y - 8}" text-anchor="${txtAnchor}" dominant-baseline="central" fill="${pColor}" font-size="12" font-weight="bold" font-family="'Inter',sans-serif">${degStr}</text>`;
        svg += `<text x="${pGlyph.x + dx}" y="${pGlyph.y + 8}" text-anchor="${txtAnchor}" dominant-baseline="central" fill="${pColor}" font-size="10" font-weight="normal" font-family="'Inter',sans-serif">${minStr}</text>`;

        // Glyph
        svg += `<text x="${pGlyph.x}" y="${pGlyph.y}" text-anchor="middle" dominant-baseline="central" fill="${pColor}" font-size="32" font-family="serif" font-weight="bold">${sym}</text>`;
        
        if (p.retrograde) {
            svg += `<text x="${pGlyph.x + 16}" y="${pGlyph.y + 14}" fill="${pColor}" font-size="10" font-weight="900" opacity="0.8">Rx</text>`;
        }
    }

    // Transit Planets (Outer Ring)
    if (isBiWheel) {
        // Draw a separator ring for transits
        svg += `<circle cx="${cx}" cy="${cy}" r="${R_TRANSITS_INNER}" fill="none" stroke="${K}" stroke-width="1.5"/>`;

        const transitItems = layoutGlyphs(transits, 7);
        for (const p of transitItems) {
            const pColor = PLANET_COLORS[p.name] || K;
            const sym = PLANET_SYMBOLS[p.name] || p.name.substring(0,2);
            const info = lonToSign(p.longitude);

            // Stems for transits: straight angled lines from the transit inner ring
            const pRadStart = lonToXY(p.longitude, R_TRANSITS_INNER, cx, cy, asc);
            const pGlyphEdge = lonToXY(p.drawLon, R_TRANSIT_PLANETS - 16, cx, cy, asc);
            const pGlyph = lonToXY(p.drawLon, R_TRANSIT_PLANETS, cx, cy, asc);

            svg += `<line x1="${pRadStart.x}" y1="${pRadStart.y}" x2="${pGlyphEdge.x}" y2="${pGlyphEdge.y}" stroke="${pColor}" stroke-width="1.5" opacity="0.8"/>`;

            const degStr = `${info.deg}°`;
            const minStr = `${String(info.min).padStart(2, '0')}'`;
            const dx = p.drawLon > 90 && p.drawLon < 270 ? -28 : 28;
            const txtAnchor = p.drawLon > 90 && p.drawLon < 270 ? 'end' : 'start';

            svg += `<text x="${pGlyph.x + dx}" y="${pGlyph.y - 8}" text-anchor="${txtAnchor}" dominant-baseline="central" fill="${pColor}" font-size="14" font-weight="bold" font-family="'Inter',sans-serif">${degStr}</text>`;
            svg += `<text x="${pGlyph.x + dx}" y="${pGlyph.y + 8}" text-anchor="${txtAnchor}" dominant-baseline="central" fill="${pColor}" font-size="12" font-weight="normal" font-family="'Inter',sans-serif">${minStr}</text>`;

            svg += `<text x="${pGlyph.x}" y="${pGlyph.y}" text-anchor="middle" dominant-baseline="central" fill="${pColor}" font-size="34" font-family="serif" font-weight="bold">${sym}</text>`;
            
            if (p.retrograde) {
                svg += `<text x="${pGlyph.x + 18}" y="${pGlyph.y + 16}" fill="${pColor}" font-size="12" font-weight="900" opacity="0.8">Rx</text>`;
            }
        }
    }

    svg += '</svg>';
    return svg;
}
