/* FCK - abilities.js : 30 special abilities (like play styles) for the pro career; the engine reads them as p.abx */
(function (FCK) {
  'use strict';
  const GROUPS = ['atk', 'pas', 'dri', 'def', 'phy', 'gk'];
  // pos: 'f' field players, 'g' keepers, 'a' everybody. req: attribute minimums. cost: skill points.
  // fx: multipliers (default 1) or additive bonuses (see ADD) read by the match engine
  const LIST = [
    // ---- Schuss
    { id: 'power', grp: 'atk', ico: '💥', cost: 4, pos: 'f', req: { sho: 70 }, fx: { shotPow: 1.12, shotErr: 1.08 } },
    { id: 'finesse', grp: 'atk', ico: '🎯', cost: 4, pos: 'f', req: { sho: 72 }, fx: { shotErr: 0.65 } },
    { id: 'cold', grp: 'atk', ico: '🧊', cost: 4, pos: 'f', req: { sho: 68 }, fx: { shotPress: 0.3, noSky: true } },
    { id: 'long', grp: 'atk', ico: '🚀', cost: 3, pos: 'f', req: { sho: 70 }, fx: { shotLong: 0.15 } },
    { id: 'chip', grp: 'atk', ico: '🥄', cost: 3, pos: 'f', req: { sho: 64, dri: 62 }, fx: { lobErr: 0.35 } },
    { id: 'pen', grp: 'atk', ico: '⚪', cost: 2, pos: 'f', req: { sho: 62 }, fx: { penErr: 0.4 } },
    { id: 'fk', grp: 'atk', ico: '🌀', cost: 3, pos: 'f', req: { sho: 66 }, fx: { fkErr: 0.45 } },
    // ---- Pass
    { id: 'pinpoint', grp: 'pas', ico: '📐', cost: 4, pos: 'a', req: { pas: 72 }, fx: { passErr: 0.5 } },
    { id: 'thru', grp: 'pas', ico: '🗝️', cost: 3, pos: 'f', req: { pas: 70 }, fx: { throughErr: 0.5 } },
    { id: 'cross', grp: 'pas', ico: '🎪', cost: 3, pos: 'a', req: { pas: 68 }, fx: { crossErr: 0.45 } },
    { id: 'tiki', grp: 'pas', ico: '🔁', cost: 3, pos: 'f', req: { pas: 64 }, fx: { shortErr: 0.6 } },
    { id: 'vision', grp: 'pas', ico: '👁️', cost: 4, pos: 'f', req: { pas: 74 }, fx: { passPress: 0.35 } },
    // ---- Dribbling
    { id: 'dribbler', grp: 'dri', ico: '🕺', cost: 4, pos: 'f', req: { dri: 72 }, fx: { shield: 0.12 } },
    { id: 'touch', grp: 'dri', ico: '🧲', cost: 3, pos: 'f', req: { dri: 66 }, fx: { touch: 0.5, noDeflect: true } },
    { id: 'speedball', grp: 'dri', ico: '🏃', cost: 4, pos: 'f', req: { pac: 70, dri: 68 }, fx: { carry: 1.05 } },
    { id: 'feint', grp: 'dri', ico: '🌪️', cost: 3, pos: 'f', req: { dri: 70 }, fx: { shield: 0.06, slideShield: 0.14 } },
    { id: 'shielder', grp: 'dri', ico: '🛡️', cost: 3, pos: 'f', req: { phy: 68, dri: 58 }, fx: { shield: 0.1 } },
    { id: 'onetouch', grp: 'dri', ico: '⚡', cost: 3, pos: 'f', req: { pas: 66, dri: 64 }, fx: { quick: 0.5 } },
    // ---- Abwehr
    { id: 'tackler', grp: 'def', ico: '🦾', cost: 4, pos: 'f', req: { def: 72 }, fx: { tackleWin: 0.12, slideWin: 0.04 } },
    { id: 'slider', grp: 'def', ico: '🛷', cost: 3, pos: 'f', req: { def: 68 }, fx: { slideWin: 0.12, slideFoul: 0.6 } },
    { id: 'interceptor', grp: 'def', ico: '🕸️', cost: 4, pos: 'f', req: { def: 68 }, fx: { reachLoose: 0.35 } },
    { id: 'clean', grp: 'def', ico: '🤝', cost: 2, pos: 'f', req: { def: 62 }, fx: { foul: 0.5 } },
    { id: 'press', grp: 'def', ico: '🔥', cost: 3, pos: 'f', req: { def: 62, phy: 66 }, fx: { pressSpd: 1.05 } },
    // ---- Körper
    { id: 'engine', grp: 'phy', ico: '🔋', cost: 3, pos: 'a', req: { phy: 68 }, fx: { stam: 0.6 } },
    { id: 'turbo', grp: 'phy', ico: '💨', cost: 4, pos: 'f', req: { pac: 76 }, fx: { speed: 1.04 } },
    { id: 'tank', grp: 'phy', ico: '🧱', cost: 3, pos: 'a', req: { phy: 72 }, fx: { injury: 0.4 } },
    { id: 'cool', grp: 'phy', ico: '😎', cost: 4, pos: 'a', req: { pas: 60, phy: 60 }, fx: { pressure: 0.55 } },
    // ---- Torwart
    { id: 'gkpen', grp: 'gk', ico: '🧤', cost: 3, pos: 'g', req: { gk: 72 }, fx: { gkPen: 0.18 } },
    { id: 'gkreflex', grp: 'gk', ico: '🐱', cost: 4, pos: 'g', req: { gk: 70 }, fx: { gkCatch: 0.1, gkDive: 1.1 } },
    { id: 'gkreach', grp: 'gk', ico: '🦒', cost: 4, pos: 'g', req: { gk: 74 }, fx: { gkReach: 0.35 } },
  ];
  const BY = {}; LIST.forEach((a) => { BY[a.id] = a; });
  const ADD = new Set(['tackleWin', 'slideWin', 'shield', 'slideShield', 'reachLoose', 'touch', 'gkCatch', 'gkPen', 'gkReach']);
  const A = {
    LIST, BY, GROUPS, ADD,
    count: LIST.length,
    // merged engine modifiers for a list of ability ids
    fx(ids) {
      const o = {};
      (ids || []).forEach((id) => {
        const a = BY[id]; if (!a) return;
        for (const k in a.fx) {
          const v = a.fx[k];
          if (v === true) o[k] = true;
          else if (ADD.has(k)) o[k] = (o[k] || 0) + v;
          else o[k] = (o[k] == null ? 1 : o[k]) * v;
        }
      });
      return o;
    },
    isGK: (pos) => pos === 'GK',
    allowed(a, pos) { const gk = pos === 'GK'; return a.pos === 'a' || (a.pos === 'g' ? gk : !gk); },
    has: (p, id) => !!(p.ab && p.ab.indexOf(id) >= 0),
    // why not? returns null when he can unlock it now
    why(p, id) {
      const a = BY[id];
      if (!a) return 'none';
      if (A.has(p, id)) return 'owned';
      if (!A.allowed(a, p.pos)) return 'pos';
      for (const k in a.req) if (Math.round(p.a[k]) < a.req[k]) return 'req';
      if (p.sp < a.cost) return 'sp';
      return null;
    },
    unlock(c, id) {
      const p = c.pro;
      if (A.why(p, id)) return false;
      p.sp -= BY[id].cost; (p.ab = p.ab || []).push(id);
      return true;
    },
    // free starter ability by archetype / position (ignores the requirements)
    starter(pos, arch) {
      if (pos === 'GK') return 'gkreflex';
      const m = { pace: 'turbo', shot: 'power', tech: 'touch', power: 'tank' };
      if (m[arch]) return m[arch];
      const r = FCK.ROLE_OF ? FCK.ROLE_OF[pos] : 'MF';
      return r === 'DF' ? 'interceptor' : r === 'FW' ? 'cold' : 'tiki';
    },
  };
  FCK.Abilities = A;
})((globalThis.FCK = globalThis.FCK || {}));
