const workboxBuild = require('workbox-build');
const path = require('path');

const buildSW = async () => {
  try {
    const { count, size, warnings } = await workboxBuild.generateSW({
      globDirectory: 'dist',
      globPatterns: ['**/*.{html,json,js,css,png,jpg,svg}'],
      swDest: 'dist/sw.js',
      // Skip precaching files that are too big
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      // Ignore source maps and other non-essential files
      globIgnores: ['**/*.map'],
      // Clients claim immediately
      clientsClaim: true,
      skipWaiting: true,
    });

    if (warnings.length > 0) {
      console.warn('Warnings encountered while generating SW:', warnings.join('\n'));
    }

    console.log(
      `Generated service worker, which will precache ${count} files, totaling ${size} bytes.`
    );
  } catch (error) {
    console.error('Error generating service worker:', error);
    process.exit(1);
  }
};

buildSW();
