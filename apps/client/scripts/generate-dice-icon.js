const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '../assets/images');

// Ensure directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// Colors
const DIE_COLOR = '#FFFFFF';
const DOT_COLOR = '#000000';
const BORDER_COLOR = '#000000';
const BG_COLOR = '#E6F4FE'; // For android-icon-background

// SVG for Main Icon (1024x1024)
// Full bleed or slightly padded. Expo icon is usually square, iOS applies rounding.
const mainIconSvg = (width, height) => `
<svg width="${width}" height="${height}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="100" height="100" fill="${DIE_COLOR}"/>
  <rect x="5" y="5" width="90" height="90" rx="15" ry="15" fill="${DIE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="2"/>
  <circle cx="25" cy="25" r="6" fill="${DOT_COLOR}"/>
  <circle cx="25" cy="50" r="6" fill="${DOT_COLOR}"/>
  <circle cx="25" cy="75" r="6" fill="${DOT_COLOR}"/>
  <circle cx="75" cy="25" r="6" fill="${DOT_COLOR}"/>
  <circle cx="75" cy="50" r="6" fill="${DOT_COLOR}"/>
  <circle cx="75" cy="75" r="6" fill="${DOT_COLOR}"/>
</svg>
`;

// SVG for Android Foreground (Transparent background, centered content)
// 432x432, content in center ~216px
const androidForegroundSvg = (width, height) => `
<svg width="${width}" height="${height}" viewBox="0 0 432 432" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(108, 108)">
    <rect x="10" y="10" width="196" height="196" rx="30" ry="30" fill="${DIE_COLOR}" stroke="${BORDER_COLOR}" stroke-width="4"/>
    <circle cx="53" cy="53" r="14" fill="${DOT_COLOR}"/>
    <circle cx="53" cy="108" r="14" fill="${DOT_COLOR}"/>
    <circle cx="53" cy="163" r="14" fill="${DOT_COLOR}"/>
    <circle cx="163" cy="53" r="14" fill="${DOT_COLOR}"/>
    <circle cx="163" cy="108" r="14" fill="${DOT_COLOR}"/>
    <circle cx="163" cy="163" r="14" fill="${DOT_COLOR}"/>
  </g>
</svg>
`;

// Monochrome: Solid white fill with transparent dots
const monochromeSvg = (width, height) => `
<svg width="${width}" height="${height}" viewBox="0 0 432 432" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="dots-mask">
      <rect x="0" y="0" width="432" height="432" fill="white"/>
      <g transform="translate(108, 108)">
        <circle cx="53" cy="53" r="14" fill="black"/>
        <circle cx="53" cy="108" r="14" fill="black"/>
        <circle cx="53" cy="163" r="14" fill="black"/>
        <circle cx="163" cy="53" r="14" fill="black"/>
        <circle cx="163" cy="108" r="14" fill="black"/>
        <circle cx="163" cy="163" r="14" fill="black"/>
      </g>
    </mask>
  </defs>
  <g transform="translate(108, 108)">
    <rect x="10" y="10" width="196" height="196" rx="30" ry="30" fill="white" mask="url(#dots-mask)"/>
  </g>
</svg>
`;

async function generate() {
  console.log('Generating dice icons...');

  // 1. icon.png (1024x1024)
  const iconBuffer = Buffer.from(mainIconSvg(1024, 1024));
  await sharp(iconBuffer).png().toFile(path.join(ASSETS_DIR, 'icon.png'));
  console.log('Generated icon.png');

  // 2. favicon.png (196x196)
  await sharp(iconBuffer).resize(196, 196).png().toFile(path.join(ASSETS_DIR, 'favicon.png'));
  console.log('Generated favicon.png');

  // 3. android-icon-foreground.png (432x432)
  const androidFgBuffer = Buffer.from(androidForegroundSvg(432, 432));
  await sharp(androidFgBuffer).png().toFile(path.join(ASSETS_DIR, 'android-icon-foreground.png'));
  console.log('Generated android-icon-foreground.png');

  // 4. android-icon-monochrome.png (432x432)
  const monochromeBuffer = Buffer.from(monochromeSvg(432, 432));
  await sharp(monochromeBuffer).png().toFile(path.join(ASSETS_DIR, 'android-icon-monochrome.png'));
  console.log('Generated android-icon-monochrome.png');

  // 5. android-icon-background.png (1x1 is enough, let's do 100x100)
  await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .png()
    .toFile(path.join(ASSETS_DIR, 'android-icon-background.png'));
  console.log('Generated android-icon-background.png');

  // 6. splash-icon.png
  // Reuse foreground, resize if needed.
  // Splash icon usually is the logo.
  await sharp(androidFgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(ASSETS_DIR, 'splash-icon.png'));
  console.log('Generated splash-icon.png');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
