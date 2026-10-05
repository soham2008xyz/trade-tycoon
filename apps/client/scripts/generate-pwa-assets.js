const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const INPUT_ICON = path.join(__dirname, '../assets/images/icon.png');
const PUBLIC_DIR = path.join(__dirname, '../public');
const SPLASH_ICON = path.join(__dirname, '../assets/images/splash-icon.png');

async function generateAssets() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  // Generate Icons
  await sharp(INPUT_ICON).resize(192, 192).toFile(path.join(PUBLIC_DIR, 'icon-192.png'));
  console.log('Generated icon-192.png');

  await sharp(INPUT_ICON).resize(512, 512).toFile(path.join(PUBLIC_DIR, 'icon-512.png'));
  console.log('Generated icon-512.png');

  // Resize splash icon for composite
  const resizedSplash = await sharp(SPLASH_ICON)
    .resize(200, 200) // Make it smaller to fit
    .toBuffer();

  // Generate Dummy Screenshots
  // Wide screenshot (e.g. 1280x720)
  await sharp({
    create: {
      width: 1280,
      height: 720,
      channels: 4,
      background: { r: 230, g: 244, b: 254, alpha: 1 }, // #E6F4FE
    },
  })
    .composite([{ input: resizedSplash, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'screenshot-wide.png'));
  console.log('Generated screenshot-wide.png');

  // Mobile screenshot (e.g. 750x1334)
  await sharp({
    create: {
      width: 750,
      height: 1334,
      channels: 4,
      background: { r: 230, g: 244, b: 254, alpha: 1 }, // #E6F4FE
    },
  })
    .composite([{ input: resizedSplash, gravity: 'center' }])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'screenshot-mobile.png'));
  console.log('Generated screenshot-mobile.png');
}

generateAssets().catch((err) => {
  console.error(err);
  process.exit(1);
});
