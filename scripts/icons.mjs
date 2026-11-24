import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icons/icon.svg');
const out = (n) => `public/icons/${n}`;
await sharp(svg).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(out('icon-512.png'));
await sharp(svg).resize(96, 96).png().toFile(out('badge-96.png'));
// Full-bleed variants (iOS adds its own rounding; maskable needs safe zone)
const flat = Buffer.from(readFileSync('public/icons/icon.svg', 'utf8').replace('rx="112"', 'rx="0"'));
await sharp(flat).resize(180, 180).png().toFile(out('apple-touch-icon.png'));
const pad = await sharp(flat).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0b0b0e' } })
  .composite([{ input: pad, top: 56, left: 56 }]).png().toFile(out('maskable-512.png'));
console.log('icons generated');
