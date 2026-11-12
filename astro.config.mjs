// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

/**
 * Generates an accurate precache manifest for built static assets inside dist/sw.js
 * so lazy map chunks, workers, fonts, photos, and PMTiles files work in Airplane Mode.
 */
function swPrecacheManifestIntegration() {
  return {
    name: 'sw-precache-manifest',
    hooks: {
      /** @param {{ dir: URL }} ctx */
      'astro:build:done': ({ dir }) => {
        const distDir = fileURLToPath(dir);
        const swPath = path.join(distDir, 'sw.js');
        if (!fs.existsSync(swPath)) return;

        /** @type {string[]} */
        const urls = ['/', '/index.html'];
        const allowedDirs = ['_astro', 'fonts', 'assets', 'tiles'];

        /** @param {string} subDir */
        function walkDir(subDir) {
          const absDir = path.join(distDir, subDir);
          if (!fs.existsSync(absDir)) return;
          for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
            const rel = path.posix.join(subDir, entry.name);
            if (entry.isDirectory()) {
              walkDir(rel);
            } else if (
              !entry.name.startsWith('admin.') &&
              !entry.name.startsWith('test-digits.') &&
              !entry.name.startsWith('_mapAdmin_')
            ) {
              urls.push('/' + rel);
            }
          }
        }

        for (const folder of allowedDirs) {
          walkDir(folder);
        }

        if (fs.existsSync(path.join(distDir, 'content.json'))) {
          urls.push('/content.json');
        }
        if (fs.existsSync(path.join(distDir, 'favicon.svg'))) {
          urls.push('/favicon.svg');
        }

        const versionedCacheName = `as-sunnah-map-${Date.now()}`;
        const rawSw = fs.readFileSync(swPath, 'utf8');
        const nextSw = rawSw
          .replace("'as-sunnah-map-v1'", `'${versionedCacheName}'`)
          .replace(
            /\/\*__PRECACHE_MANIFEST__\*\/\s*\[[^\]]*\]/,
            JSON.stringify(Array.from(new Set(urls)))
          );
        fs.writeFileSync(swPath, nextSw, 'utf8');
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  output: 'static',
  build: {
    inlineStylesheets: 'always',
  },
  vite: {
    optimizeDeps: {
      include: ['maplibre-gl', 'pmtiles', '@protomaps/basemaps'],
    },
  },
  integrations: [swPrecacheManifestIntegration()],
});
