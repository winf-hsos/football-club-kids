/* FCK - commentary.js : text commentary (DE/EN, kids-friendly variant), fed by match events */
(function (FCK) {
  'use strict';
  const U = FCK.U;

  // {a} = player short name, {b} = second player, {t} = team, {o} = other team, {s} = score, {m} = minute
  const L = {
    de: {
      kickoff: ['Anpfiff! Los geht’s im {venue}!', 'Das Spiel läuft! {t} gegen {o}.', 'Der Ball rollt – {t} gegen {o}!'],
      goal: ['TOOOR! {a} trifft für {t}! {s}', 'Tor für {t}! {a} lässt den Torwart keine Chance! {s}', 'Das ist drin! {a} schiebt ein – {s}', 'JAAAA! {a} netzt für {t} ein! {s}', 'Was für ein Treffer von {a}! {s}'],
      goalAssist: ['TOOOR! {a} trifft nach Vorlage von {b}! {s}', 'Schöner Pass von {b}, {a} vollendet! {s}'],
      og: ['Eigentor! {a} lenkt den Ball ins eigene Netz. {s}', 'Oh nein, {a} trifft ins eigene Tor! {s}'],
      save: ['Parade von {a}!', 'Starke Rettungstat von {a}!', '{a} hält den Ball fest!', 'Glanzparade von {a}!'],
      parry: ['{a} lenkt den Ball zur Seite.', '{a} faustet den Ball weg!', '{a} wehrt ab – Ecke!'],
      shotOn: ['{a} schießt – aufs Tor!', 'Gefährlicher Schuss von {a}!', '{a} zieht ab!'],
      shotOff: ['{a} schießt – knapp drüber.', '{a} verzieht deutlich.', 'Das war nichts, {a} schießt vorbei.'],
      post: ['Pfosten! Das war knapp!', 'Aluminium! Der Ball springt vom Pfosten zurück!'],
      bar: ['Latte! {a} hat Pech!', 'Der Ball knallt an die Latte!'],
      foul: ['Foul von {a} an {b}.', '{a} kommt zu spät – Freistoß.', 'Das war zu ruppig von {a}.'],
      foulKids: ['Hoppla, {a} war zu stürmisch. Freistoß!', '{a} hat {b} umgerannt – Freistoß.'],
      adv: ['Der Schiedsrichter lässt weiterspielen – Vorteil!', 'Vorteil für {t}!'],
      yellow: ['Gelbe Karte für {a}.', 'Der Schiedsrichter zeigt {a} Gelb.'],
      yellow2: ['Gelb-Rot für {a}! Der Platzverweis ist die Folge.'],
      red: ['Rote Karte für {a}! Das Spiel geht in Unterzahl weiter.'],
      offside: ['Abseits! {a} stand zu weit vorn.', 'Die Fahne geht hoch – Abseits.'],
      corner: ['Ecke für {t}.', 'Eckball – {t} kann Druck machen.'],
      penalty: ['ELFMETER! Der Schiedsrichter zeigt auf den Punkt!', 'Strafstoß für {t}!'],
      injury: ['{a} bleibt verletzt liegen. Das Spiel ist unterbrochen.', 'Behandlungspause: {a} hat sich wehgetan.'],
      sub: ['Wechsel bei {t}: {b} kommt für {a}.', '{t} bringt {b} für {a}.'],
      added: ['Die Nachspielzeit beträgt {n} Minute(n).'],
      half: ['Halbzeit! Es steht {s}.', 'Pause! Zwischenstand: {s}.'],
      full: ['Abpfiff! Endstand {s}.', 'Das Spiel ist aus – {s}.'],
      extra: ['Verlängerung! Es geht in die Extrazeit.'],
      pens: ['Elfmeterschießen! Jetzt wird es spannend!'],
      penGoal: ['{a} verwandelt sicher!', 'Drin! {a} trifft vom Punkt.'],
      penMiss: ['{a} scheitert! Der Elfmeter ist vergeben!', 'Gehalten! Der Torwart ist der Held!'],
      slide: ['Grätsche von {a} – sauber geklärt!', '{a} wirft sich in den Ball!'],
      filler: ['{t} lässt den Ball laufen.', 'Ruhige Phase im Mittelfeld.', 'Das Spiel ist ausgeglichen.', '{t} sucht die Lücke.', 'Die Zuschauer feuern ihr Team an.'],
      poss: ['{t} hat aktuell mehr Ballbesitz.', '{t} kontrolliert die Partie.'],
      weather_rain: ['Der Regen macht den Rasen schnell und rutschig.'],
      weather_snow: ['Schnee auf dem Platz – der Ball bleibt schnell liegen.'],
      weather_storm: ['Ein Unwetter tobt über dem Stadion!'],
      weather_fog: ['Nebel liegt über dem Stadion.'],
    },
    en: {
      kickoff: ['Kick-off! Here we go at {venue}!', 'We are underway! {t} against {o}.', 'The ball is rolling – {t} versus {o}!'],
      goal: ['GOAL! {a} scores for {t}! {s}', 'It’s in! {a} gives the keeper no chance! {s}', 'What a finish by {a}! {s}', 'YES! {a} finds the net for {t}! {s}', '{a} makes no mistake – {s}'],
      goalAssist: ['GOAL! {a} finishes after a pass from {b}! {s}', 'Lovely ball from {b}, {a} converts! {s}'],
      og: ['Own goal! {a} turns it into his own net. {s}', 'Oh no, {a} puts it in the wrong goal! {s}'],
      save: ['Great save by {a}!', 'Superb stop from {a}!', '{a} holds on to it!', 'What a save by {a}!'],
      parry: ['{a} palms it away.', '{a} punches it clear!', '{a} pushes it round the post – corner!'],
      shotOn: ['{a} shoots – on target!', 'Dangerous effort from {a}!', '{a} lets fly!'],
      shotOff: ['{a} shoots – just over.', '{a} drags it wide.', 'That one goes well off target, {a}.'],
      post: ['Off the post! So close!', 'Woodwork! It bounces back off the post!'],
      bar: ['Crossbar! Bad luck for {a}!', 'It smashes off the bar!'],
      foul: ['Foul by {a} on {b}.', '{a} is late – free kick.', 'That was rough from {a}.'],
      foulKids: ['Oops, {a} was too eager. Free kick!', '{a} bumped into {b} – free kick.'],
      adv: ['The referee plays the advantage!', 'Advantage to {t}!'],
      yellow: ['Yellow card for {a}.', 'The referee shows {a} a yellow.'],
      yellow2: ['Second yellow for {a}! He’s off.'],
      red: ['Red card for {a}! They play on with ten.'],
      offside: ['Offside! {a} was too far forward.', 'The flag goes up – offside.'],
      corner: ['Corner for {t}.', 'A corner – {t} can pile on the pressure.'],
      penalty: ['PENALTY! The referee points to the spot!', 'Spot kick for {t}!'],
      injury: ['{a} stays down injured. Play is stopped.', 'Treatment break: {a} is hurt.'],
      sub: ['Substitution for {t}: {b} replaces {a}.', '{t} brings on {b} for {a}.'],
      added: ['{n} minute(s) of added time.'],
      half: ['Half-time! It’s {s}.', 'Break! Score at the interval: {s}.'],
      full: ['Full-time! Final score {s}.', 'That’s it – {s}.'],
      extra: ['Extra time! We play on.'],
      pens: ['Penalty shoot-out! Now it gets tense!'],
      penGoal: ['{a} converts coolly!', 'In! {a} scores from the spot.'],
      penMiss: ['{a} misses! The penalty is wasted!', 'Saved! The keeper is the hero!'],
      slide: ['Slide tackle by {a} – clean!', '{a} throws himself at it!'],
      filler: ['{t} keep the ball moving.', 'A quiet spell in midfield.', 'The game is evenly balanced.', '{t} look for a gap.', 'The fans are cheering their team on.'],
      poss: ['{t} have more of the ball right now.', '{t} are controlling the game.'],
      weather_rain: ['The rain makes the pitch fast and slippery.'],
      weather_snow: ['Snow on the pitch – the ball slows down quickly.'],
      weather_storm: ['A storm is raging over the stadium!'],
      weather_fog: ['Fog hangs over the stadium.'],
    },
  };

  class Commentary {
    constructor(m, opts) {
      this.m = m; this.lang = (opts && opts.lang) || 'de'; this.kids = !!(opts && opts.kids);
      this.out = (opts && opts.out) || function () {};
      this.last = {}; this.fillerT = 0; this.lastLine = -99; this.shotCool = 0;
      this.log = [];
      m.on((e) => this.onEvent(e));
    }
    say(key, vars, prio, kind) {
      const m = this.m;
      const bank = L[this.lang] || L.de;
      let arr = bank[key];
      if (!arr) return;
      // avoid immediate repetition
      let idx = this.rng(arr.length);
      if (arr.length > 1 && idx === this.last[key]) idx = (idx + 1) % arr.length;
      this.last[key] = idx;
      let s = arr[idx];
      const t = vars || {};
      s = s.replace(/\{(\w+)\}/g, (a, k) => (t[k] !== undefined ? t[k] : ''));
      this.lastLine = m.time;
      const line = { text: s, minute: m.minute(), prio: prio || 1, kind: kind || key };
      this.log.push(line);
      if (this.log.length > 200) this.log.shift();
      this.out(line);
    }
    rng(n) { return Math.floor(Math.random() * n); }
    sc() { const m = this.m; return m.teams[0].score + ':' + m.teams[1].score; }
    onEvent(e) {
      const m = this.m;
      const nm = (p) => (p ? p.sname : '');
      switch (e.type) {
        case 'goal':
          if (e.og) this.say('og', { a: nm(e.goal.ogBy), s: this.sc(), t: e.team.short }, 3, 'goal');
          else if (e.assist && Math.random() < 0.6) this.say('goalAssist', { a: nm(e.scorer), b: nm(e.assist), s: this.sc(), t: e.team.name }, 3, 'goal');
          else this.say('goal', { a: nm(e.scorer), t: e.team.name, s: this.sc() }, 3, 'goal');
          break;
        case 'save': this.say(e.kind === 'parry' ? 'parry' : 'save', { a: nm(e.by) }, 2); break;
        case 'shot':
          if (e.penalty) break;
          if (m.time - this.shotCool < 3) break;
          this.shotCool = m.time;
          if (e.on) this.say('shotOn', { a: nm(e.by) }, 1); else if (e.dist < 28) this.say('shotOff', { a: nm(e.by) }, 1);
          break;
        case 'woodwork': this.say(e.kind === 'bar' ? 'bar' : 'post', { a: nm(e.by) }, 2); break;
        case 'foul':
          if (e.penalty) { this.say('penalty', { t: m.teams[e.victim ? e.victim.ti : 0].name }, 3); break; }
          this.say(this.kids ? 'foulKids' : 'foul', { a: nm(e.by), b: nm(e.victim) }, 1);
          break;
        case 'advantage': this.say('adv', { t: e.victim ? e.victim.team.name : '' }, 1); break;
        case 'card': this.say(e.kind === 'yellow' ? 'yellow' : e.kind === 'red' ? 'red' : 'yellow2', { a: nm(e.by) }, 2); break;
        case 'offside': this.say('offside', { a: nm(e.by) }, 1); break;
        case 'corner': this.say('corner', { t: e.by ? e.by.team.name : '' }, 1); break;
        case 'injury': if (!this.kids) this.say('injury', { a: nm(e.by) }, 2); break;
        case 'sub': if (!e.auto || true) this.say('sub', { t: e.team.name, a: nm(e.out), b: nm(e.in) }, 1); break;
        case 'added': this.say('added', { n: e.mins }, 1); break;
        case 'halftime': if (e.et) this.say('half', { s: this.sc() }, 2); else this.say('half', { s: this.sc() }, 2); break;
        case 'extratime': this.say('extra', {}, 2); break;
        case 'penaltiesNext': this.say('pens', {}, 2); break;
        case 'penalty':
          if (e.scored) this.say('penGoal', { a: nm(e.shooter) }, 2); else this.say('penMiss', { a: nm(e.shooter) }, 2);
          break;
        case 'end': this.say('full', { s: this.sc() }, 3); break;
        case 'tackle': if (e.slide && e.ok && Math.random() < 0.35) this.say('slide', { a: nm(e.by) }, 1); break;
        default: break;
      }
    }
    kickoff() {
      const m = this.m;
      this.say('kickoff', { venue: m.teams[0].club.stadium, t: m.teams[0].name, o: m.teams[1].name }, 2);
      const w = 'weather_' + m.weather;
      if ((L[this.lang] || L.de)[w]) setTimeout(() => this.say(w, {}, 1), 100);
    }
    tick(dt) {
      const m = this.m;
      if (m.mode !== 'play') return;
      this.fillerT += dt;
      if (this.fillerT > 14 && m.time - this.lastLine > 10) {
        this.fillerT = 0;
        const t = m.poss >= 0 ? m.teams[m.poss] : m.teams[0];
        const k = Math.random() < 0.3 ? 'poss' : 'filler';
        this.say(k, { t: t.name }, 0);
      }
    }
  }

  FCK.Commentary = Commentary;
})((globalThis.FCK = globalThis.FCK || {}));
