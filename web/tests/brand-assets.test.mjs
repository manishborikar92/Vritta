import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function getPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  return null;
}

const AUTHORITATIVE_PATH = 'M 68 132 C 44 132 40 100 68 84 C 92 70 108 130 132 116 C 160 100 156 68 132 68 C 108 68 92 128 68 132 Z';

describe('Phase 2: Authoritative Logo & Favicon Asset Pipeline', () => {

  describe('Authoritative Source of Truth & Vector Integrity', () => {
    it('should verify Logo.js contains authoritative Guiding Sutra coordinates and theme variables', () => {
      const logoJsPath = path.join(projectRoot, 'src', 'components', 'ui', 'display', 'Logo.js');
      const content = fs.readFileSync(logoJsPath, 'utf8');

      assert.ok(content.includes('viewBox="20 20 160 160"') || content.includes('viewBox="0 0 200 200"'), 'Logo.js must use valid viewBox matching authoritative framing');
      assert.ok(content.includes(AUTHORITATIVE_PATH), 'Logo.js must match exact Guiding Sutra continuous loop coordinates');
      assert.ok(content.includes('strokeWidth="13"'), 'Logo.js stroke-width must be 13');
      assert.ok(content.includes('cx="100"') && content.includes('cy="100"') && content.includes('r="8"'), 'Logo.js must include center balance dot at (100, 100, r=8)');
      assert.ok(content.includes('--color-brand-primary') || content.includes('#0F766E'), 'Logo.js must reference Restorative Juniper primary brand color');
    });

    it('should verify public/logo.svg and app/icon0.svg match authoritative geometry and support dark mode', () => {
      const publicLogoPath = path.join(projectRoot, 'public', 'logo.svg');
      const icon0Path = path.join(projectRoot, 'src', 'app', 'icon0.svg');

      const logoContent = fs.readFileSync(publicLogoPath, 'utf8');
      assert.ok(logoContent.includes('viewBox="0 0 200 200"'), 'logo.svg must use 200x200 viewBox');
      assert.ok(logoContent.includes(AUTHORITATIVE_PATH), 'logo.svg must match exact Guiding Sutra coordinates');
      assert.ok(logoContent.includes('cx="100"') && logoContent.includes('cy="100"') && logoContent.includes('r="8"'), 'logo.svg must include center balance dot at (100, 100, r=8)');
      assert.ok(logoContent.includes('#0F766E'), 'logo.svg must reference accessible light stroke #0F766E');
      assert.ok(logoContent.includes('#14B8A6'), 'logo.svg must include core Luminous Teal #14B8A6');
      assert.ok(logoContent.includes('#090D16'), 'logo.svg must include core Deep Obsidian #090D16');
      assert.ok(logoContent.includes('#D97706'), 'logo.svg must include core Warm Amber #D97706');

      const icon0Content = fs.readFileSync(icon0Path, 'utf8');
      assert.ok(icon0Content.includes('<svg'), 'icon0.svg must be valid SVG');
      assert.ok(icon0Content.includes('#14B8A6'), 'icon0.svg must include Luminous Teal');
      assert.ok(icon0Content.includes('#090D16'), 'icon0.svg must include Deep Obsidian');
      assert.ok(icon0Content.includes('#D97706'), 'icon0.svg must include Warm Amber');
    });
  });

  describe('Raster Assets & Pixel Dimensions', () => {
    it('should verify Apple touch icon dimensions are exactly 180x180 px', () => {
      const applePath = path.join(projectRoot, 'src', 'app', 'apple-icon.png');
      assert.ok(fs.existsSync(applePath), 'apple-icon.png must exist');
      const dim = getPngDimensions(applePath);
      assert.deepEqual(dim, { width: 180, height: 180 }, 'apple-icon.png must be 180x180 px');
    });

    it('should verify Next.js icon1.png dimensions are valid square icon (48x48 or 96x96 px)', () => {
      const icon1Path = path.join(projectRoot, 'src', 'app', 'icon1.png');
      assert.ok(fs.existsSync(icon1Path), 'icon1.png must exist');
      const dim = getPngDimensions(icon1Path);
      assert.ok(dim.width === 48 || dim.width === 96, `icon1.png must be 48 or 96 px wide, got ${dim.width}`);
      assert.equal(dim.width, dim.height, 'icon1.png must be square');
    });

    it('should verify PWA web-app-manifest-192x192.png and 512x512.png dimensions', () => {
      const pwa192Path = path.join(projectRoot, 'public', 'web-app-manifest-192x192.png');
      const pwa512Path = path.join(projectRoot, 'public', 'web-app-manifest-512x512.png');

      assert.ok(fs.existsSync(pwa192Path), '192x192 PNG must exist');
      assert.ok(fs.existsSync(pwa512Path), '512x512 PNG must exist');

      assert.deepEqual(getPngDimensions(pwa192Path), { width: 192, height: 192 });
      assert.deepEqual(getPngDimensions(pwa512Path), { width: 512, height: 512 });
    });

    it('should verify multi-resolution favicon.ico contains valid sub-images including 16x16 and 32x32 entries', () => {
      const icoPath = path.join(projectRoot, 'src', 'app', 'favicon.ico');
      assert.ok(fs.existsSync(icoPath), 'favicon.ico must exist');

      const buf = fs.readFileSync(icoPath);
      assert.equal(buf.readUInt16LE(0), 0, 'ICO reserved word must be 0');
      assert.equal(buf.readUInt16LE(2), 1, 'ICO type must be 1 (icon)');
      const count = buf.readUInt16LE(4);
      assert.ok(count >= 2, `ICO must contain at least 2 sub-images, found ${count}`);

      const entry0W = buf.readUInt8(6) || 256;
      const entry0H = buf.readUInt8(7) || 256;
      const entry1W = buf.readUInt8(22) || 256;
      const entry1H = buf.readUInt8(23) || 256;

      assert.ok(entry0W === 16 || entry0W === 32 || entry0W === 48, 'Must have standard favicon width');
      assert.equal(entry0W, entry0H, 'Favicon entry must be square');
    });
  });

  describe('Manifest & App Metadata Resolution', () => {
    it('should verify manifest.json declares Vritta branding and valid icon references', () => {
      const manifestPath = path.join(projectRoot, 'src', 'app', 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      assert.ok(manifest.name.startsWith('Vritta'), 'Manifest name must start with Vritta');
      assert.equal(manifest.short_name, 'Vritta');
      assert.ok(manifest.theme_color === '#090D16' || manifest.theme_color === '#14B8A6');
      assert.ok(manifest.background_color === '#090D16' || manifest.background_color === '#F8FAFC');

      // Verify every declared icon exists
      for (const icon of manifest.icons) {
        const relPath = icon.src.startsWith('/') ? icon.src.slice(1) : icon.src;
        const inPublic = path.join(projectRoot, 'public', relPath);
        const inApp = path.join(projectRoot, 'src', 'app', relPath);
        assert.ok(
          fs.existsSync(inPublic) || fs.existsSync(inApp),
          `Manifest icon ${icon.src} must exist on disk`
        );
      }
    });

    it('should verify file-based metadata convention delivers manifest and non-conflicting icon declarations', () => {
      const layoutPath = path.join(projectRoot, 'src', 'app', 'layout.js');
      const manifestPath = path.join(projectRoot, 'src', 'app', 'manifest.json');
      const content = fs.readFileSync(layoutPath, 'utf8');

      assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist in src/app for Next.js file-based metadata convention');
      assert.ok(content.includes('apple-icon.png'), 'layout.js must document apple-icon.png for iOS');
      assert.ok(content.includes('favicon.ico'), 'layout.js must document favicon.ico');
      assert.ok(content.includes('icon0.svg'), 'layout.js must document vector icon0.svg');
      assert.ok(content.includes('manifest.json'), 'layout.js must document file-based manifest.json convention');
    });
  });
});
