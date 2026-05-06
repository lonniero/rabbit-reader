export const SIGN_SYMBOLS = ['♈\uFE0E', '♉\uFE0E', '♊\uFE0E', '♋\uFE0E', '♌\uFE0E', '♍\uFE0E', '♎\uFE0E', '♏\uFE0E', '♐\uFE0E', '♑\uFE0E', '♒\uFE0E', '♓\uFE0E'];
export const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

export const SIGN_COLORS = [
    '#E11515', // Aries (Fire - Red)
    '#22c55e', // Taurus (Earth - Green)
    '#f59e0b', // Gemini (Air - Orange/Yellow)
    '#3b82f6', // Cancer (Water - Blue)
    '#E11515', // Leo (Fire)
    '#22c55e', // Virgo (Earth)
    '#f59e0b', // Libra (Air)
    '#3b82f6', // Scorpio (Water)
    '#E11515', // Sagittarius (Fire)
    '#22c55e', // Capricorn (Earth)
    '#f59e0b', // Aquarius (Air)
    '#3b82f6'  // Pisces (Water)
];

export const PLANET_COLORS = {
    'Sun': '#FF8C00', 'Moon': '#FFB500', 'Mercury': '#8A2BE2', 'Venus': '#FF69B4',
    'Mars': '#E11515', 'Jupiter': '#00CED1', 'Saturn': '#E11515', 'Uranus': '#8B0000',
    'Neptune': '#008080', 'Pluto': '#FF0000', 'North Node': '#808080', 'South Node': '#808080',
    'Chiron': '#A9A9A9', 'Fortune': '#808080'
};

export const PLANET_SYMBOLS = {
    'Sun': '☉\uFE0E', 'Moon': '☽\uFE0E', 'Mercury': '☿\uFE0E', 'Venus': '♀\uFE0E', 'Mars': '♂\uFE0E',
    'Jupiter': '♃\uFE0E', 'Saturn': '♄\uFE0E', 'Uranus': '♅\uFE0E', 'Neptune': '♆\uFE0E', 'Pluto': '♇\uFE0E',
    'North Node': '☊\uFE0E', 'South Node': '☋\uFE0E', 'Chiron': '⚷\uFE0E', 'Fortune': '⊗\uFE0E'
};

export const ASPECT_COLORS = {
    'conjunction': '#000000',
    'sextile': '#0000FF',
    'square': '#FF0000',
    'trine': '#0000FF',
    'opposition': '#FF0000',
    'quincunx': '#800080',
    'semisextile': '#008000'
};

export const BG = '#FFFFFF';
export const BG_LIGHT = '#F5F5F5';
export const STROKE = '#000000';

export function lonToXY(lon, r, cx, cy, asc = 0) {
    const a = (((asc - lon + 180) % 360 + 360) % 360) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export function lonToSign(longitude) {
    const idx = Math.floor(longitude / 30);
    const deg = Math.floor(longitude % 30);
    const min = Math.floor((longitude % 1) * 60);
    return { sign: SIGN_NAMES[idx], deg, min, symbol: SIGN_SYMBOLS[idx], color: SIGN_COLORS[idx] };
}
