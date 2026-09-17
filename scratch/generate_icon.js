const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

function create256Icon() {
  const width = 256;
  const height = 256;
  const numPixels = width * height;
  const pixelDataSize = numPixels * 4;
  const andMaskSize = (width * height) / 8; // 8192 bytes
  const bitmapInfoHeaderSize = 40;
  const imageSize = bitmapInfoHeaderSize + pixelDataSize + andMaskSize;

  const buffer = new ArrayBuffer(6 + 16 + imageSize);
  const view = new DataView(buffer);

  // ICONHEADER
  view.setUint16(0, 0, true); // Reserved
  view.setUint16(2, 1, true); // Type 1 = ICO
  view.setUint16(4, 1, true); // Count = 1

  // ICONDIRENTRY (Width/Height 0 means 256 in ICO spec)
  view.setUint8(6, 0); // 256px
  view.setUint8(7, 0); // 256px
  view.setUint8(8, 0); // Palette count
  view.setUint8(9, 0); // Reserved
  view.setUint16(10, 1, true); // Color planes
  view.setUint16(12, 32, true); // Bits per pixel
  view.setUint32(14, imageSize, true); // Size
  view.setUint32(18, 22, true); // Offset

  // BITMAPINFOHEADER
  let offset = 22;
  view.setUint32(offset, 40, true); offset += 4;
  view.setInt32(offset, width, true); offset += 4;
  view.setInt32(offset, height * 2, true); offset += 4; // Height * 2 for XOR+AND
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, 32, true); offset += 2;
  view.setUint32(offset, 0, true); offset += 4; // BI_RGB
  view.setUint32(offset, pixelDataSize, true); offset += 4;
  view.setInt32(offset, 0, true); offset += 4;
  view.setInt32(offset, 0, true); offset += 4;
  view.setUint32(offset, 0, true); offset += 4;
  view.setUint32(offset, 0, true); offset += 4;

  // Pixel Data (Bottom-to-Top BGRA)
  // Scaled retro cassette icon (256x256)
  const u8 = new Uint8Array(buffer);
  for (let y = 0; y < height; y++) {
    const row = height - 1 - y; // Bottom-to-top
    for (let x = 0; x < width; x++) {
      const idx = offset + (row * width + x) * 4;

      // Outer border (scaling 32->256 is factor of 8)
      if (x < 16 || x >= 240 || y < 32 || y >= 224) {
        // Silver / Dark gray cassette shell border
        u8[idx + 0] = 0x33;
        u8[idx + 1] = 0x33;
        u8[idx + 2] = 0x33;
        u8[idx + 3] = 0xff;
      } else if (
        (x >= 48 && x <= 96 && y >= 88 && y <= 160) || 
        (x >= 160 && x <= 208 && y >= 88 && y <= 160)
      ) {
        // Gold Reel Hubs
        u8[idx + 0] = 0x1c;
        u8[idx + 1] = 0x6d;
        u8[idx + 2] = 0x85;
        u8[idx + 3] = 0xff;
      } else if (x >= 104 && x <= 152 && y >= 112 && y <= 136) {
        // Center Window (Red LED)
        u8[idx + 0] = 0x22;
        u8[idx + 1] = 0x22;
        u8[idx + 2] = 0xee;
        u8[idx + 3] = 0xff;
      } else {
        // Dark Cassette Body
        u8[idx + 0] = 0x55;
        u8[idx + 1] = 0x55;
        u8[idx + 2] = 0x55;
        u8[idx + 3] = 0xff;
      }
    }
  }

  // AND mask (all 0s = opaque)
  const andOffset = offset + pixelDataSize;
  for (let i = 0; i < andMaskSize; i++) {
    u8[andOffset + i] = 0;
  }

  const icoPath = path.join(assetsDir, 'cassette.ico');
  const pngPath = path.join(assetsDir, 'cassette.png');
  fs.writeFileSync(icoPath, Buffer.from(buffer));
  fs.writeFileSync(pngPath, Buffer.from(buffer));

  console.log(`Generated 256x256 cassette icon at ${icoPath}`);
}

create256Icon();
