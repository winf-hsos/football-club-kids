// node test/run_all.js : alle Node-Tests (ohne Browser) nacheinander; Exit-Code != 0 bei Fehler
const { spawnSync } = require('child_process');
const path = require('path');
const tests = ['world_sim.js', 'comp_sim.js', 'mgr_sim.js', 'mgr_edge.js', 'cards_sim.js', 'cards_sk.js', 'own_sim.js', 'pro_sim.js', 'pro_req.js', 'gk_rush.js', 'headers.js', 'tourney_sim.js', 'ab_test.js', 'names_test.js', 'i18n_check.js'];
let bad = 0;
for (const t of tests) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, t)], { encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = r.status === 0 && !/FAILED/.test(out) && (t === 'i18n_check.js' ? /missing 0/.test(out) : true);
  console.log((ok ? 'PASS ' : 'FAIL ') + t + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  if (!ok) { bad++; console.log(out.split('\n').slice(-12).join('\n')); }
}
console.log(bad ? bad + ' Test(s) fehlgeschlagen' : 'ALLE OK');
process.exit(bad ? 1 : 0);
