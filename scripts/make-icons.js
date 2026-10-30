import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b) {
  // Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // color type (RGB)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(len + 12);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
    // CRC calculation
    let c = 0xffffffff;
    const crcBuf = Buffer.concat([Buffer.from(type), data]);
    for (let i = 0; i < crcBuf.length; i++) {
      c ^= crcBuf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    buf.writeUInt32BE((c ^ 0xffffffff) >>> 0, len + 8);
    return buf;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data with filter byte 0 per line
  const raw = Buffer.alloc(height * (width * 3 + 1));
  let pos = 0;
  for (let y = 0; y < height; y++) {
    raw[pos++] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      // Border or center styling
      const border = 16;
      const isInner = x > border && x < width - border && y > border && y < height - border;
      // Draw cross or accent in center
      const cx = width / 2;
      const cy = height / 2;
      const arm = width * 0.15;
      const thick = width * 0.05;
      const isCross = (Math.abs(x - cx) < thick && Math.abs(y - cy) < arm) ||
                      (Math.abs(y - cy) < thick && Math.abs(x - cx) < arm);

      if (isCross) {
        raw[pos++] = 255;
        raw[pos++] = 255;
        raw[pos++] = 255;
      } else if (isInner) {
        raw[pos++] = r;
        raw[pos++] = g;
        raw[pos++] = b;
      } else {
        raw[pos++] = 11;
        raw[pos++] = 34;
        raw[pos++] = 64; // navy #0B2240
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Generate 192x192, 512x512, apple-touch-icon 180x180
fs.writeFileSync('public/pwa-192x192.png', createPNG(192, 192, 255, 107, 0));
fs.writeFileSync('public/pwa-512x512.png', createPNG(512, 512, 255, 107, 0));
fs.writeFileSync('public/apple-touch-icon.png', createPNG(180, 180, 255, 107, 0));
console.log('PNG icons created successfully.');
