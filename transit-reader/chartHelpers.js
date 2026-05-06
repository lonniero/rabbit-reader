export const SIGN_SYMBOLS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
export const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

export const SIGN_COLORS = [
    '#E11515', // Aries (Fire - Red)
    '#8B6508', // Taurus (Earth - Brown)
    '#008B8B', // Gemini (Air - Teal)
    '#0000CD', // Cancer (Water - Blue)
    '#E11515', // Leo (Fire - Red)
    '#8B6508', // Virgo (Earth - Brown)
    '#008B8B', // Libra (Air - Teal)
    '#0000CD', // Scorpio (Water - Blue)
    '#E11515', // Sagittarius (Fire - Red)
    '#8B6508', // Capricorn (Earth - Brown)
    '#008B8B', // Aquarius (Air - Teal)
    '#0000CD'  // Pisces (Water - Blue)
];

export const PLANET_COLORS = {
    'Sun': '#FF8C00', 'Moon': '#FFB500', 'Mercury': '#8A2BE2', 'Venus': '#FF69B4',
    'Mars': '#E11515', 'Jupiter': '#00CED1', 'Saturn': '#E11515', 'Uranus': '#8B0000',
    'Neptune': '#008080', 'Pluto': '#FF0000', 'North Node': '#808080', 'South Node': '#808080',
    'Chiron': '#A9A9A9', 'Fortune': '#808080'
};

export const PLANET_SYMBOLS = {
    'Sun': '☉', 'Moon': '☽', 'Mercury': '☿', 'Venus': '♀', 'Mars': '♂',
    'Jupiter': '♃', 'Saturn': '♄', 'Uranus': '♅', 'Neptune': '♆', 'Pluto': '♇',
    'North Node': '☊', 'South Node': '☋', 'Chiron': '⚷', 'Fortune': '⊗'
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
