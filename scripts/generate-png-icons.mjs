import fs from 'fs';
import zlib from 'zlib';

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makePng(width, height, isMaskable = false) {
  const bytesPerPixel = 4;
  const rowBytes = width * bytesPerPixel;
  const rawData = Buffer.alloc(height * (1 + rowBytes));

  const cx = width / 2;
  const cy = height / 2;
  const maxR = width * 0.45;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // filter type 0 (None)
    for (let x = 0; x < width; x++) {
      // Dark zinc background (#18181b = 24, 24, 27)
      let r = 24;
      let g = 24;
      let b = 27;
      let a = 255;

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Outer border styling if not maskable
      if (!isMaskable) {
        const cornerDist = Math.max(Math.abs(dx), Math.abs(dy));
        if (cornerDist > width * 0.48) {
          a = 0; // rounded outer transparent boundary
        }
      }

      // Draw Candlesticks & TB logo representation in center 60%
      const nx = x / width;
      const ny = y / height;

      // Candle 1 (left zinc)
      if (nx >= 0.22 && nx <= 0.30 && ny >= 0.35 && ny <= 0.65) {
        r = 113; g = 113; b = 122; // #71717a
      }
      if (nx >= 0.25 && nx <= 0.27 && ny >= 0.25 && ny <= 0.75) {
        r = 161; g = 161; b = 170;
      }

      // Candle 2 (middle emerald bullish)
      if (nx >= 0.45 && nx <= 0.55 && ny >= 0.25 && ny <= 0.60) {
        r = 16; g = 185; b = 129; // #10b981
      }
      if (nx >= 0.49 && nx <= 0.51 && ny >= 0.18 && ny <= 0.70) {
        r = 52; g = 211; b = 153;
      }

      // Candle 3 (right cyan bullish)
      if (nx >= 0.70 && nx <= 0.78 && ny >= 0.20 && ny <= 0.50) {
        r = 14; g = 165; b = 233; // #0ea5e9
      }
      if (nx >= 0.73 && nx <= 0.75 && ny >= 0.15 && ny <= 0.58) {
        r = 56; g = 189; b = 248;
      }

      // Bottom bar text area (#f4f4f5)
      if (nx >= 0.30 && nx <= 0.70 && ny >= 0.82 && ny <= 0.86) {
        r = 244; g = 244; b = 245;
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const typeAndData = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.writeFileSync('public/pwa-192x192.png', makePng(192, 192, false));
fs.writeFileSync('public/pwa-512x512.png', makePng(512, 512, false));
fs.writeFileSync('public/pwa-maskable-512x512.png', makePng(512, 512, true));
fs.writeFileSync('public/apple-touch-icon.png', makePng(180, 180, false));
fs.writeFileSync('public/favicon.ico', makePng(64, 64, false));

console.log('Successfully generated all PWA icons!');
