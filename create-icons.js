// Placeholder for system tray icon
// In a real app, replace with actual icon files
// Linux/Mac: 16x16 @1x, 32x32 @2x  
// Windows: 16x16 ICO format
// This script generates a simple PNG for demo purposes

const fs = require('fs');
const path = require('path');

// Create a simple 1x1 transparent PNG as placeholder
// Format: PNG file header + IHDR chunk
const pngHeader = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, // IHDR chunk size
  0x49, 0x48, 0x44, 0x52, // IHDR
  0x00, 0x00, 0x00, 0x01, // width: 1
  0x00, 0x00, 0x00, 0x01, // height: 1
  0x08, 0x06, // bit depth: 8, color type: 6 (RGBA)
  0x00, 0x00, 0x00, // compression, filter, interlace
  0x1f, 0x15, 0xc4, 0x89, // CRC
  0x00, 0x00, 0x00, 0x0c, // IDAT chunk size
  0x49, 0x44, 0x41, 0x54, // IDAT
  0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0xfe, 0xff,
  0x00, 0x00, 0x00, 0x02,
  0x00, 0x01, 0x49, 0xb4, 0xe8, 0xb7, // CRC
  0x00, 0x00, 0x00, 0x00, // IEND chunk size
  0x49, 0x45, 0x4e, 0x44, // IEND
  0xae, 0x42, 0x60, 0x82, // CRC
]);

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create placeholder icon files
fs.writeFileSync(path.join(assetsDir, 'tray-icon.png'), pngHeader);
fs.writeFileSync(path.join(assetsDir, 'tray-icon-default.png'), pngHeader);

console.log('Tray icon placeholder created');
