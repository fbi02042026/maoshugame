import { Color } from 'cc';

/** 安全解析 #RRGGBB，避免 Preview 里 Color.fromHEX 偶发 Illegal constructor */
export function colorFromHex(hex: string): Color {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3
        ? h.split('').map((c) => c + c).join('')
        : h, 16);
    if (Number.isNaN(n)) {
        return new Color(255, 255, 255, 255);
    }
    return new Color((n >> 16) & 255, (n >> 8) & 255, n & 255, 255);
}
