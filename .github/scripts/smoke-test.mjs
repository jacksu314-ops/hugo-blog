import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve(process.argv[2] || 'public');
const pages = ['/', '/posts/', '/projects/', '/study/', '/about/', '/account/', '/auth/callback/', '/now/'];

function pageFile(route) {
  return path.join(outputDir, route.replace(/^\//, ''), 'index.html');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const route of pages) {
  const file = pageFile(route);
  assert(fs.existsSync(file), `${route} was not generated`);
  const html = fs.readFileSync(file, 'utf8');
  assert(/<title>[^<]+<\/title>/.test(html), `${route} is missing a title`);
  assert(/<meta name=description content=(?:"[^"]+"|[^\s>]+)/.test(html), `${route} is missing a description`);
  assert(/<link rel=canonical href=https:\/\/jacksu314-ops\.github\.io\/hugo-blog\//.test(html), `${route} is missing a canonical URL`);
  assert(/<meta property="og:title" content=(?:"[^"]+"|[^\s>]+)/.test(html), `${route} is missing Open Graph title`);
  assert(/<meta property="og:description" content=(?:"[^"]+"|[^\s>]+)/.test(html), `${route} is missing Open Graph description`);
  assert(/<meta property="og:image" content=(?:"[^"]*social-share[^\"]*"|[^\s>]*social-share[^\s>]*)/.test(html), `${route} is missing the default social image`);
  assert(/<meta name=twitter:card content=(?:"[^"]+"|[^\s>]+)/.test(html), `${route} is missing Twitter Card metadata`);
}

const studyHtml = fs.readFileSync(pageFile('/study/'), 'utf8');
const homeHtml = fs.readFileSync(pageFile('/'), 'utf8');
const articleHtml = fs.readFileSync(pageFile('/posts/fluent-udf-journal-bearing-equilibrium/'), 'utf8');
const authCss = fs.readFileSync(path.resolve('assets/css/custom.css'), 'utf8');
const authJs = fs.readFileSync(path.resolve('assets/js/auth.js'), 'utf8');
assert(studyHtml.includes('记录已隐藏'), 'Visitor study privacy copy is missing');
assert(!studyHtml.includes('data-week-rate>0%'), 'Visitor build contains a misleading 0% rate');
assert(authCss.includes('html:not([data-site-access="admin"]) .study-owner-only'), 'Visitor default must hide admin controls');
assert(authJs.includes("role === 'admin'"), 'Admin role contract is missing');
assert(/authState\.role\s*=\s*authState\.user\s*\?\s*'member'\s*:\s*'visitor'/.test(authJs), 'Member role contract is missing');
assert(homeHtml.includes('id=site-entrance'), 'Home entry experience is missing');
assert(homeHtml.includes('social-share.png'), 'Home entry image is missing');
assert(homeHtml.includes('id=share-page'), 'Global share trigger is missing');
assert(articleHtml.includes('linkedin.com') && articleHtml.includes('twitter.com'), 'Article sharing links are missing');

console.log(`Smoke-tested ${pages.length} key pages, access contracts, sharing, and entry experience.`);
