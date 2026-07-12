import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve(process.argv[2] || 'public');
const basePath = '/hugo-blog/';
const htmlFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(target);
  }
}

function localTarget(url, sourceFile) {
  const target = decodeURIComponent(url.replaceAll('&amp;', '&').split('#')[0].split('?')[0]);
  if (target.includes('${')) return null;
  if (!target || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(target)) return null;

  let resolved;
  if (target.startsWith('/')) {
    const withoutBase = target.startsWith(basePath) ? target.slice(basePath.length) : target.slice(1);
    resolved = path.join(outputDir, withoutBase);
  } else {
    resolved = path.resolve(path.dirname(sourceFile), target);
  }

  const candidates = [resolved, `${resolved}.html`, path.join(resolved, 'index.html')];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function shouldIgnore(url) {
  const target = decodeURIComponent(url.replaceAll('&amp;', '&').split('#')[0].split('?')[0]);
  return !target || target.includes('${') || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(target);
}

walk(outputDir);
const broken = [];
const attributePattern = /(?:href|src)=["']([^"']+)["']/g;

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(attributePattern)) {
    if (shouldIgnore(match[1])) continue;
    if (!localTarget(match[1], file)) {
      broken.push(`${path.relative(outputDir, file)} -> ${match[1]}`);
    }
  }
}

if (broken.length) {
  console.error(`Found ${broken.length} broken local link(s):\n${broken.join('\n')}`);
  process.exit(1);
}

console.log(`Checked ${htmlFiles.length} HTML files: local links are valid.`);
