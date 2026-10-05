const sharp = require('sharp');
const path = require('path');

const INPUT_ICON = path.join(__dirname, '../assets/images/icon.png');
const OUTPUT = path.join(__dirname, '../public/og-image.png');

// Social preview card for og:image / twitter:image. Crawlers want 1200x630;
// icon-512 is too small and the PWA screenshots are placeholders. Run by hand
// and commit the PNG: the text relies on system fonts, so it is kept out of
// the Vercel build (generate:pwa) where those fonts may be missing.
async function generateOgImage() {
  const icon = await sharp(INPUT_ICON).resize(360, 360).toBuffer();
  const text = Buffer.from(`
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
      { input: icon, left: 110, top: 135 },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toFile(OUTPUT);
  console.log('Generated og-image.png');
}

generateOgImage().catch((err) => {
  console.error(err);
  process.exit(1);
});
