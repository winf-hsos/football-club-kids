// Bundles the project into: dist/FCK.html (single file), dist/artifact.html (page fragment for hosting), dist/FCK-project.zip
const fs = require('fs'), path = require('path');
const ORDER = ['util', 'data', 'abilities', 'squad', 'crest', 'i18n', 'i18n_career', 'i18n_mgr', 'i18n_cards', 'i18n_s5', 'i18n_s6', 'i18n_3d', 'i18n_pad', 'i18n_comp', 'i18n_pro', 'i18n_ab', 'i18n_cpk', 'i18n_fifa', 'natdata', 'names', 'i18n_names', 'worlddata', 'world', 'importer', 'season', 'sim', 'rules', 'ai', 'render', 'render3d', 'audio', 'input', 'commentary', 'stats', 'career', 'pro', 'manager', 'market', 'youth', 'mgrseason', 'cards', 'editor', 'tourney', 'comp', 'duel', 'ui', 'padnav', 'lineupui', 'setup', 'matchui', 'careerui', 'clubpick', 'proui', 'mgrui', 'cardsui', 'editorui', 'tourneyui', 'compui', 'duelui', 'donateui', 'main'];
const root = __dirname;
// build tag shown (small) on the home screen: short commit + commit time, so a deployed version can be told apart
const BUILD = (() => {
  let sha = 'dev', d = new Date();
  try {
    const cp = require('child_process');
    sha = cp.execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    d = new Date(cp.execSync('git log -1 --format=%cI', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim());
  } catch (e) { /* no git: use build time */ }
  const when = d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return sha + ' \u00b7 ' + when;
})();
const buildJs = '/* ===== build tag ===== */\nglobalThis.FCK = globalThis.FCK || {}; globalThis.FCK.BUILD = ' + JSON.stringify(BUILD) + ';\n';
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const js = buildJs + ORDER.map((f) => '/* ===== ' + f + '.js ===== */\n' + fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8')).join('\n');
const CSS = ['style', '3d', 'pad', 'comp', 'pro', 'fifa'];
const css = CSS.map((f) => (fs.existsSync(path.join(root, 'css', f + '.css')) ? fs.readFileSync(path.join(root, 'css', f + '.css'), 'utf8') : '')).join('\n');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Chakra+Petch:wght@500;600;700&display=swap">';
const markup = '<div id="app"><canvas id="cv" aria-label="Football pitch"></canvas><div id="hud" hidden></div><div id="touch"></div><div id="screen" hidden></div><div id="modal" hidden></div><div id="toast" aria-live="polite"></div></div><noscript>FCK needs JavaScript.</noscript>';
const TITLE = 'FCK Football Club Kids';
const safeJs = js.replace(/<\/script/gi, '<\\/script');
// three.js r128 (3D match view): inlined into the single file, loaded from cdnjs for the hosted page, lib/ file for the ZIP
const THREE_LIB = fs.readFileSync(path.join(root, 'lib', 'three.r128.min.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
// privacy-friendly visit counter (GoatCounter: no cookies, no personal data); only in the hosted single file, switchable off in Help
const GC = '<script data-goatcounter="https://fck.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>';
const THREE_CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';

// 1) standalone file
const single = '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><meta name="theme-color" content="#0a0e17"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><title>' + TITLE + '</title>' + fonts + '<style>' + css + '</style></head><body>' + markup + '<script>' + THREE_LIB + '</script><script>' + safeJs + '</script>' + GC + '</body></html>';
fs.writeFileSync(path.join(root, 'dist', 'FCK.html'), single);

// 2) artifact fragment (the host wraps it into a document skeleton)
const frag = '<title>FCK Football Club Kids</title>\n' + fonts + '\n<style>' + css + '</style>\n' + markup + '\n' + THREE_CDN + '\n<script>' + safeJs + '</script>\n';
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), frag);

// 3) dev index (multi-file) for the ZIP
const dev = '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><meta name="theme-color" content="#0a0e17"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><title>' + TITLE + '</title>' + fonts + CSS.filter((f) => fs.existsSync(path.join(root, 'css', f + '.css'))).map((f) => '<link rel="stylesheet" href="css/' + f + '.css">').join('') + '</head><body>' + markup + '\n<script src="lib/three.r128.min.js"></script>\n<script>' + buildJs + '</script>\n' + ORDER.map((f) => '<script src="js/' + f + '.js"></script>').join('\n') + '\n</body></html>';
fs.writeFileSync(path.join(root, 'index.html'), dev);
console.log('single', (single.length / 1024).toFixed(0) + ' KB', 'artifact', (frag.length / 1024).toFixed(0) + ' KB');
