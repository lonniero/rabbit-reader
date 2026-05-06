export const SIGN_SYMBOLS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
export const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

export const PLANET_COLORS = {
    'Sun': '#1a1a1a', 'Moon': '#1a1a1a', 'Mercury': '#1a1a1a', 'Venus': '#1a1a1a',
    'Mars': '#1a1a1a', 'Jupiter': '#1a1a1a', 'Saturn': '#1a1a1a', 'Uranus': '#1a1a1a',
    'Neptune': '#1a1a1a', 'Pluto': '#1a1a1a', 'North Node': '#1a1a1a', 'Chiron': '#1a1a1a'
};

export const PLANET_SYMBOLS = {
    'Sun': '☉', 'Moon': '☽', 'Mercury': '☿', 'Venus': '♀', 'Mars': '♂',
    'Jupiter': '♃', 'Saturn': '♄', 'Uranus': '♅', 'Neptune': '♆', 'Pluto': '♇',
    'North Node': '☊', 'Chiron': '⚷'
};

export const ASPECT_COLORS = {
    harmonious: '#1a1a4a',
    challenging: '#3a1a1a',
    neutral: '#1a3a1a'
};

export const BG = '#8382FC';
export const BG_LIGHT = '#9696FF';
export const STROKE = '#1a1a1a';

export function lonToXY(lon, r, cx, cy, asc = 0) {
    const a = (((asc - lon + 180) % 360 + 360) % 360) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export function lonToSign(longitude) {
    const idx = Math.floor(longitude / 30);
    const deg = Math.floor(longitude % 30);
    const min = Math.floor((longitude % 1) * 60);
    return { sign: SIGN_NAMES[idx], deg, min, symbol: SIGN_SYMBOLS[idx] };
}
