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
    let items = planets.map(p => ({ ...p, drawLon: p.longitude }));
    items.sort((a, b) => a.longitude - b.longitude);

    for (let iter = 0; iter < 150; iter++) {
        let moved = false;
        for (let i = 0; i < items.length; i++) {
            let j = (i + 1) % items.length;
            let diff = angDiff(items[j].drawLon, items[i].drawLon);
            let ccwDist = diff >= 0 ? diff : (360 + diff);
            
            if (ccwDist < minSepDeg) {
                let overlap = minSepDeg - ccwDist;
                items[j].drawLon += overlap / 2 + 0.1;
                items[i].drawLon -= overlap / 2 + 0.1;
                items[j].drawLon = (items[j].drawLon % 360 + 360) % 360;
                items[i].drawLon = (items[i].drawLon % 360 + 360) % 360;
                moved = true;
            }
        }
        if (!moved) break;
    }
    return items;
}

export function generateChartSVG(natalChart, transitData, highlight = null) {
    if (!natalChart) return '';

    const S = 960, cx = 480, cy = 480;
    const K = STROKE;

    // Layout (inside → outside):
    //   Aspect ring → wider zodiac band → narrow house band → natal planets
    const R_ASPECTS     = 140;  // aspect lines touch here
    const R_ZODIAC_INNER = 140; // zodiac band starts here (same as aspects)
    const R_ZODIAC_OUTER = 220; // zodiac band outer rim (80px wide)
    const R_HOUSE_INNER = 220;  // narrow house band starts here
    const R_HOUSE_OUTER = 235;  // narrow house band (15px wide)

    // Natal planets are placed outside the house ring
    const R_NATAL_PLANETS = 285;

    // Transit planets are placed in an even wider concentric circle
    const R_TRANSITS_INNER = 365;
    const R_TRANSIT_PLANETS = 425;

    const natal = natalChart.planets || [];
    const houses = natalChart.houses;
    const asc = houses?.ascendant?.longitude || 0;
    const transits = transitData?.transits || [];
    const aspects = transitData?.aspects || natalChart.aspects || [];

    const isBiWheel = transits.length > 0;

    // Dynamic viewBox based on chart bounds
    const maxRadius = isBiWheel ? 465 : 340;
    const vMin = cx - maxRadius;
    const vSize = maxRadius * 2;
    
    // Background
    let svg = `<svg viewBox="${vMin} ${vMin} ${vSize} ${vSize}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;background-color:${BG};">`;

    // Rings (inside → outside)
    svg += `<circle cx="${cx}" cy="${cy}" r="${R_ASPECTS}" fill="none" stroke="${K}" stroke-width="1.5"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${R_ZODIAC_OUTER}" fill="none" stroke="${K}" stroke-width="2"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="${R_HOUSE_OUTER}" fill="none" stroke="${K}" stroke-width="2"/>`;

    // Degree ticks: originate from R_ZODIAC_OUTER (outer rim), point INWARD into zodiac band
    for (let deg = 0; deg < 360; deg++) {
        const isMajor = deg % 30 === 0;
        const isTen = deg % 10 === 0;
        const isFive = deg % 5 === 0;
        if (isMajor) continue;

        const tickLen = isTen ? 14 : (isFive ? 9 : 4);
        const p1 = lonToXY(deg, R_ZODIAC_OUTER, cx, cy, asc);
        const p2 = lonToXY(deg, R_ZODIAC_OUTER - tickLen, cx, cy, asc);
        svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${K}" stroke-width="${isFive ? 1.5 : 0.5}" opacity="0.8"/>`;
    }

    // Sign Boundaries — only span the zodiac band; glyphs sit in center of band
    for (let i = 0; i < 12; i++) {
        const sL = i * 30;

        // Boundary line spans the zodiac band only
        const d1 = lonToXY(sL, R_ZODIAC_OUTER, cx, cy, asc);
        const d2 = lonToXY(sL, R_ZODIAC_INNER, cx, cy, asc);
        svg += `<line x1="${d1.x}" y1="${d1.y}" x2="${d2.x}" y2="${d2.y}" stroke="${K}" stroke-width="1.5"/>`;

        // Zodiac symbols centered in the band, biased toward inner (away from outer ticks)
        const mid = lonToXY(sL + 15, R_ZODIAC_INNER + (R_ZODIAC_OUTER - R_ZODIAC_INNER) * 0.41, cx, cy, asc);
        const signColor = SIGN_COLORS ? SIGN_COLORS[i] : K;
        svg += `<text x="${mid.x}" y="${mid.y}" text-anchor="middle" dominant-baseline="central" fill="${signColor}" font-size="42" font-family="serif" font-weight="bold">${SIGN_SYMBOLS[i]}</text>`;
    }

    // Houses
    if (houses) {
        // House cusp lines span from R_HOUSE_INNER to R_HOUSE_OUTER (house band only)
        houses.cusps.forEach(c => {
            const isAng = [1, 4, 7, 10].includes(c.house);
            const p1 = lonToXY(c.longitude, R_HOUSE_INNER, cx, cy, asc);
            const p2 = lonToXY(c.longitude, R_HOUSE_OUTER, cx, cy, asc);
            svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${K}" stroke-width="${isAng ? 2 : 0.8}" opacity="${isAng ? 1 : 0.6}"/>`;
        });

        // House numbers centered in the house band
        houses.cusps.forEach((c, i) => {
            const next = houses.cusps[(i + 1) % 12];
            let midLon = c.longitude + ((((next.longitude - c.longitude) + 360) % 360) / 2);
            const p = lonToXY(midLon, (R_HOUSE_INNER + R_HOUSE_OUTER) / 2, cx, cy, asc);
            svg += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" fill="${K}" font-size="10" font-weight="bold" opacity="0.75" font-family="'Inter',sans-serif">${c.house}</text>`;
        });

        // AC / DC / MC / IC Labels
        const labels = [
            { l: houses.ascendant.longitude, t: 'AC' },
            { l: houses.midheaven.longitude, t: 'MC' },
            { l: (houses.ascendant.longitude + 180) % 360, t: 'DC' },
            { l: (houses.midheaven.longitude + 180) % 360, t: 'IC' }
        ];
        for (const { l, t } of labels) {
            const p = lonToXY(l, R_HOUSE_OUTER + 25, cx, cy, asc);
            svg += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" fill="${K}" font-size="22" font-family="serif" font-weight="bold">${t}</text>`;
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
    const natalItems = layoutGlyphs(natal, 10);
    for (const p of natalItems) {
        const pColor = PLANET_COLORS[p.name] || K;
        const sym = PLANET_SYMBOLS[p.name] || p.name.substring(0,2);
        const info = lonToSign(p.longitude);

        // Stem from outer house rim to glyph
        const pStart = lonToXY(p.longitude, R_HOUSE_OUTER, cx, cy, asc);
        const pElbow = lonToXY(p.longitude, R_HOUSE_OUTER + 12, cx, cy, asc);
        const pGlyphEdge = lonToXY(p.drawLon, R_NATAL_PLANETS - 16, cx, cy, asc);
        const pGlyph = lonToXY(p.drawLon, R_NATAL_PLANETS, cx, cy, asc);

        svg += `<polyline points="${pStart.x},${pStart.y} ${pElbow.x},${pElbow.y} ${pGlyphEdge.x},${pGlyphEdge.y}" stroke="${pColor}" stroke-width="1" fill="none"/>`;

        // Planet degree text
        const degStr = `${info.deg}°`;
        const minStr = `${String(info.min).padStart(2, '0')}'`;
        
        const dx = p.drawLon > 90 && p.drawLon < 270 ? -22 : 22;
        const txtAnchor = p.drawLon > 90 && p.drawLon < 270 ? 'end' : 'start';

        svg += `<text x="${pGlyph.x + dx}" y="${pGlyph.y - 7}" text-anchor="${txtAnchor}" dominant-baseline="central" fill="${pColor}" font-size="11" font-weight="bold" font-family="'Inter',sans-serif">${degStr}</text>`;
        svg += `<text x="${pGlyph.x + dx}" y="${pGlyph.y + 7}" text-anchor="${txtAnchor}" dominant-baseline="central" fill="${pColor}" font-size="9" font-weight="normal" font-family="'Inter',sans-serif">${minStr}</text>`;

        // Glyph
        svg += `<text x="${pGlyph.x}" y="${pGlyph.y}" text-anchor="middle" dominant-baseline="central" fill="${pColor}" font-size="40" font-family="serif" font-weight="bold">${sym}</text>`;
        
        if (p.retrograde) {
            svg += `<text x="${pGlyph.x + 16}" y="${pGlyph.y + 14}" fill="${pColor}" font-size="10" font-weight="900" opacity="0.8">Rx</text>`;
        }
    }

    // Transit Planets (Outer Ring)
    if (isBiWheel) {
        // Draw a separator ring for transits
        svg += `<circle cx="${cx}" cy="${cy}" r="${R_TRANSITS_INNER}" fill="none" stroke="${K}" stroke-width="1.5"/>`;

        const transitItems = layoutGlyphs(transits, 8.5);
        for (const p of transitItems) {
            const pColor = PLANET_COLORS[p.name] || K;
            const sym = PLANET_SYMBOLS[p.name] || p.name.substring(0,2);
            const info = lonToSign(p.longitude);

            // Stems for transits: elbows
            const pStart = lonToXY(p.longitude, R_TRANSITS_INNER, cx, cy, asc);
            const pElbow = lonToXY(p.longitude, R_TRANSITS_INNER + 12, cx, cy, asc);
            const pGlyphEdge = lonToXY(p.drawLon, R_TRANSIT_PLANETS - 16, cx, cy, asc);
            const pGlyph = lonToXY(p.drawLon, R_TRANSIT_PLANETS, cx, cy, asc);

            svg += `<polyline points="${pStart.x},${pStart.y} ${pElbow.x},${pElbow.y} ${pGlyphEdge.x},${pGlyphEdge.y}" stroke="${pColor}" stroke-width="1.5" opacity="0.8" fill="none"/>`;

            const degStr = `${info.deg}°`;
            const minStr = `${String(info.min).padStart(2, '0')}'`;
            const dx = p.drawLon > 90 && p.drawLon < 270 ? -24 : 24;
            const txtAnchor = p.drawLon > 90 && p.drawLon < 270 ? 'end' : 'start';

            svg += `<text x="${pGlyph.x + dx}" y="${pGlyph.y - 7}" text-anchor="${txtAnchor}" dominant-baseline="central" fill="${pColor}" font-size="13" font-weight="bold" font-family="'Inter',sans-serif">${degStr}</text>`;
            svg += `<text x="${pGlyph.x + dx}" y="${pGlyph.y + 7}" text-anchor="${txtAnchor}" dominant-baseline="central" fill="${pColor}" font-size="11" font-weight="normal" font-family="'Inter',sans-serif">${minStr}</text>`;

            svg += `<text x="${pGlyph.x}" y="${pGlyph.y}" text-anchor="middle" dominant-baseline="central" fill="${pColor}" font-size="42" font-family="serif" font-weight="bold">${sym}</text>`;
            
            if (p.retrograde) {
                svg += `<text x="${pGlyph.x + 18}" y="${pGlyph.y + 16}" fill="${pColor}" font-size="12" font-weight="900" opacity="0.8">Rx</text>`;
            }
        }
    }

    svg += '</svg>';
    return svg;
}
