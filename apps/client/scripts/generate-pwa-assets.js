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

  // Social preview card for og:image / twitter:image. Crawlers want 1200x630;
  // icon-512 is too small and the screenshots are placeholders.
  const ogIcon = await sharp(INPUT_ICON).resize(360, 360).toBuffer();
  const ogText = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <text x="520" y="290" font-family="Helvetica, Arial, sans-serif" font-size="88"
        font-weight="700" fill="#ffffff">Trade Tycoon</text>
      <text x="522" y="360" font-family="Helvetica, Arial, sans-serif" font-size="34"
        fill="#d7ecd9">Buy, trade and build your way to the top.</text>
      <text x="522" y="410" font-family="Helvetica, Arial, sans-serif" font-size="34"
        fill="#d7ecd9">Pass-and-play or online with friends.</text>
    </svg>`);
  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 27, g: 94, b: 32, alpha: 1 }, // #1B5E20
    },
  })
    .composite([
      { input: ogIcon, left: 110, top: 135 },
      { input: ogText, left: 0, top: 0 },
    ])
    .png()
    .toFile(path.join(PUBLIC_DIR, 'og-image.png'));
  console.log('Generated og-image.png');
}

generateAssets().catch((err) => {
  console.error(err);
  process.exit(1);
});
