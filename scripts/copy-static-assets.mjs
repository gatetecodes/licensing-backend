import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const templatesSrc = path.join(root, 'src', 'templates');
const logoSrc = path.join(root, 'src', 'assets', 'email', 'bnr-logo.webp');
const templatesDest = path.join(root, 'dist', 'templates');
const logoDest = path.join(root, 'dist', 'assets', 'email', 'bnr-logo.webp');

function fail(message) {
  process.stderr.write(`copy-static-assets: ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(templatesSrc)) {
  fail(
    'src/templates not found. Run this script from the backend repo root (bnr-licensing-be) after checkout.'
  );
}
if (!fs.existsSync(logoSrc)) {
  fail(
    'src/assets/email/bnr-logo.webp not found. Add the logo or restore assets.'
  );
}
const hbsFiles = fs
  .readdirSync(templatesSrc)
  .filter((name) => name.endsWith('.hbs'));
if (hbsFiles.length === 0) {
  fail('No .hbs files under src/templates.');
}

fs.mkdirSync(templatesDest, { recursive: true });
for (const name of hbsFiles) {
  fs.copyFileSync(
    path.join(templatesSrc, name),
    path.join(templatesDest, name)
  );
}

fs.mkdirSync(path.dirname(logoDest), { recursive: true });
fs.copyFileSync(logoSrc, logoDest);

process.stdout.write(
  `copy-static-assets: copied ${hbsFiles.length} template(s) and logo → dist/\n`
);
