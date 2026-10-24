/* FCK - data.js : teams, name pools, formations, tactics, presets */
(function (FCK) {
  'use strict';

  // ---------- Clubs (text names only; crests and kits are generated) ----------
  // rating = rough playing strength 55..90 (own estimate, not an official value)
  const T = (id, name, short, cc, league, p, s, t, kit, crest, rating, stadium, cap) => ({
    id, name, short, cc, league, colors: { p, s, t }, kit, crest, rating, stadium, cap,
  });

  FCK.TEAMS = [
    // Germany
    T('fcb', 'FC Bayern München', 'BAY', 'de', 'Deutschland', '#d4162a', '#ffffff', '#0b3a8f', 'solid', { shape: 'round', pattern: 'halves', emblem: 'star' }, 86, 'Allianz Arena', 75000),
    T('bvb', 'Borussia Dortmund', 'BVB', 'de', 'Deutschland', '#ffd800', '#111111', '#111111', 'solid', { shape: 'round', pattern: 'plain', emblem: 'ball' }, 80, 'Signal Iduna Park', 81000),
    T('b04', 'Bayer 04 Leverkusen', 'B04', 'de', 'Deutschland', '#e32219', '#111111', '#111111', 'solid', { shape: 'round', pattern: 'halves', emblem: 'bolt' }, 80, 'BayArena', 30000),
    T('rbl', 'RB Leipzig', 'RBL', 'de', 'Deutschland', '#f4f4f4', '#d2102b', '#0e2a5a', 'solid', { shape: 'shield', pattern: 'bend', emblem: 'bolt' }, 79, 'Red Bull Arena', 47000),
    // Spain
    T('rma', 'Real Madrid', 'RMA', 'es', 'Spanien', '#f6f6f6', '#2c1f6b', '#c9a227', 'solid', { shape: 'shield', pattern: 'plain', emblem: 'crown' }, 87, 'Santiago Bernabéu', 83000),
    T('bar', 'FC Barcelona', 'BAR', 'es', 'Spanien', '#a50044', '#004d98', '#edbb00', 'stripesV', { shape: 'shield', pattern: 'stripesV', emblem: 'ball' }, 85, 'Camp Nou', 99000),
    T('atm', 'Atlético Madrid', 'ATM', 'es', 'Spanien', '#cb3524', '#ffffff', '#1a2c5b', 'stripesV', { shape: 'shield', pattern: 'stripesV', emblem: 'star' }, 82, 'Metropolitano', 70000),
    // England
    T('mci', 'Manchester City', 'MCI', 'en', 'England', '#6cabdd', '#ffffff', '#1c2c5b', 'solid', { shape: 'round', pattern: 'plain', emblem: 'ring' }, 87, 'Etihad Stadium', 53000),
    T('liv', 'Liverpool FC', 'LIV', 'en', 'England', '#c8102e', '#f6eb61', '#00a398', 'solid', { shape: 'shield', pattern: 'plain', emblem: 'tower' }, 85, 'Anfield', 61000),
    T('ars', 'Arsenal FC', 'ARS', 'en', 'England', '#ef0107', '#ffffff', '#023474', 'sleeves', { shape: 'shield', pattern: 'plain', emblem: 'ball' }, 85, 'Emirates Stadium', 60000),
    T('mun', 'Manchester United', 'MUN', 'en', 'England', '#da291c', '#111111', '#fbe122', 'solid', { shape: 'round', pattern: 'plain', emblem: 'star' }, 79, 'Old Trafford', 74000),
    T('che', 'Chelsea FC', 'CHE', 'en', 'England', '#034694', '#ffffff', '#d1d3d4', 'solid', { shape: 'round', pattern: 'plain', emblem: 'crown' }, 80, 'Stamford Bridge', 40000),
    T('tot', 'Tottenham Hotspur', 'TOT', 'en', 'England', '#f4f4f4', '#132257', '#132257', 'solid', { shape: 'shield', pattern: 'plain', emblem: 'ball' }, 78, 'Tottenham Hotspur Stadium', 62000),
    // Italy
    T('juv', 'Juventus', 'JUV', 'it', 'Italien', '#f2f2f2', '#111111', '#111111', 'stripesV', { shape: 'shield', pattern: 'stripesV', emblem: 'star' }, 80, 'Allianz Stadium', 41000),
    T('int', 'Inter Mailand', 'INT', 'it', 'Italien', '#0a3d8f', '#111111', '#c9a227', 'stripesV', { shape: 'round', pattern: 'stripesV', emblem: 'star' }, 83, 'San Siro', 75000),
    T('mil', 'AC Mailand', 'MIL', 'it', 'Italien', '#d71920', '#111111', '#ffffff', 'stripesV', { shape: 'shield', pattern: 'stripesV', emblem: 'ring' }, 79, 'San Siro', 75000),
    T('nap', 'SSC Neapel', 'NAP', 'it', 'Italien', '#12a0d7', '#ffffff', '#0b3a73', 'solid', { shape: 'round', pattern: 'plain', emblem: 'ball' }, 79, 'Stadio Maradona', 54000),
    // France
    T('psg', 'Paris Saint-Germain', 'PSG', 'fr', 'Frankreich', '#0b1f4d', '#e30613', '#ffffff', 'band', { shape: 'round', pattern: 'halves', emblem: 'tower' }, 84, 'Parc des Princes', 47000),
    T('om', 'Olympique Marseille', 'OM', 'fr', 'Frankreich', '#f4f4f4', '#2faee0', '#2faee0', 'solid', { shape: 'round', pattern: 'plain', emblem: 'star' }, 76, 'Orange Vélodrome', 67000),
    // Rest of Europe
    T('ajx', 'Ajax Amsterdam', 'AJX', 'nl', 'Niederlande', '#f4f4f4', '#d2122e', '#d2122e', 'band', { shape: 'round', pattern: 'plain', emblem: 'ring' }, 76, 'Johan Cruijff Arena', 54000),
    T('ben', 'Benfica Lissabon', 'BEN', 'pt', 'Portugal', '#e30613', '#ffffff', '#111111', 'solid', { shape: 'shield', pattern: 'plain', emblem: 'crown' }, 77, 'Estádio da Luz', 65000),
    T('por', 'FC Porto', 'POR', 'pt', 'Portugal', '#0a4ea3', '#ffffff', '#c9a227', 'stripesV', { shape: 'shield', pattern: 'stripesV', emblem: 'crown' }, 76, 'Estádio do Dragão', 50000),
    T('gal', 'Galatasaray Istanbul', 'GAL', 'tr', 'Türkei', '#ffb300', '#a90432', '#a90432', 'halves', { shape: 'round', pattern: 'halves', emblem: 'star' }, 73, 'RAMS Park', 52000),
    T('cel', 'Celtic Glasgow', 'CEL', 'en', 'Schottland', '#0f8a3c', '#ffffff', '#ffffff', 'hoops', { shape: 'round', pattern: 'plain', emblem: 'leaf' }, 70, 'Celtic Park', 60000),
    // Americas
    T('mia', 'Inter Miami CF', 'MIA', 'us', 'USA', '#f7b5cd', '#231f20', '#231f20', 'solid', { shape: 'shield', pattern: 'plain', emblem: 'ball' }, 70, 'Chase Stadium', 21000),
    T('lag', 'LA Galaxy', 'LAG', 'us', 'USA', '#f4f4f4', '#00245d', '#ffd200', 'solid', { shape: 'round', pattern: 'plain', emblem: 'star' }, 66, 'Dignity Health Sports Park', 27000),
    T('ame', 'Club América', 'AME', 'es', 'Mexiko', '#ffdd00', '#0b2a6f', '#0b2a6f', 'solid', { shape: 'round', pattern: 'plain', emblem: 'bolt' }, 70, 'Estadio Azteca', 87000),
    T('boc', 'Boca Juniors', 'BOC', 'es', 'Argentinien', '#0a3f91', '#ffd400', '#ffd400', 'band', { shape: 'shield', pattern: 'halves', emblem: 'star' }, 72, 'La Bombonera', 54000),
    T('fla', 'Flamengo', 'FLA', 'pt', 'Brasilien', '#c8102e', '#111111', '#111111', 'hoops', { shape: 'round', pattern: 'plain', emblem: 'ball' }, 74, 'Maracanã', 78000),
    // Fun teams
    T('kom', 'FCK Kometen', 'KOM', 'de', 'Kinderliga', '#18b46b', '#ffffff', '#ffe14d', 'sash', { shape: 'round', pattern: 'chevron', emblem: 'star' }, 62, 'Sternenwiese', 4200),
    T('kun', 'Kids United', 'KUN', 'en', 'Kinderliga', '#ff7a1a', '#1c3fa8', '#ffffff', 'halves', { shape: 'shield', pattern: 'halves', emblem: 'bolt' }, 62, 'Sunshine Park', 5200),
  ];

  FCK.teamById = (id) => FCK.TEAMS.find((t) => t.id === id) || FCK.TEAMS[0];

  // ---------- Names (generated, mixed at random: not real people) ----------
  FCK.NAMES = {
    de: {
      f: ['Lukas', 'Jonas', 'Felix', 'Leon', 'Maximilian', 'Niklas', 'Tim', 'Jan', 'Paul', 'David', 'Moritz', 'Florian', 'Tobias', 'Simon', 'Lennart', 'Kai', 'Emil', 'Ben', 'Nico', 'Fabian'],
      l: ['Müller', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Schwarz', 'Zimmermann', 'Krüger', 'Hartmann', 'Lange', 'Werner', 'Krause', 'Brandt'],
    },
    en: {
      f: ['Jack', 'Harry', 'Oliver', 'George', 'Noah', 'Charlie', 'Jacob', 'Alfie', 'Freddie', 'Oscar', 'James', 'Callum', 'Ryan', 'Connor', 'Declan', 'Liam', 'Mason', 'Tyler', 'Cole', 'Jordan'],
      l: ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Walker', 'Wright', 'Robinson', 'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Hall', 'Wood', 'Harris', 'Clarke', 'Mitchell', 'Carter'],
    },
    es: {
      f: ['Alejandro', 'Pablo', 'Diego', 'Javier', 'Carlos', 'Miguel', 'Sergio', 'Álvaro', 'Adrián', 'Iván', 'Hugo', 'Mateo', 'Rubén', 'Marcos', 'Raúl', 'Nicolás', 'Gonzalo', 'Santiago', 'Emilio', 'Lucas'],
      l: ['García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Navarro', 'Torres', 'Domínguez', 'Vega', 'Castro', 'Ortega'],
    },
    it: {
      f: ['Marco', 'Luca', 'Matteo', 'Andrea', 'Davide', 'Federico', 'Simone', 'Alessio', 'Giorgio', 'Stefano', 'Riccardo', 'Lorenzo', 'Nicolò', 'Emanuele', 'Fabio', 'Daniele', 'Tommaso', 'Gabriele', 'Edoardo', 'Paolo'],
      l: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa', 'Giordano', 'Mancini', 'Rizzo', 'Lombardi', 'Moretti'],
    },
    fr: {
      f: ['Hugo', 'Louis', 'Lucas', 'Antoine', 'Théo', 'Maxime', 'Nathan', 'Julien', 'Mathis', 'Baptiste', 'Clément', 'Romain', 'Kylian', 'Yanis', 'Adrien', 'Enzo', 'Rayan', 'Axel', 'Léo', 'Bastien'],
      l: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'Fournier', 'Girard', 'Bonnet', 'Dupont', 'Lambert', 'Fontaine'],
    },
    nl: {
      f: ['Daan', 'Sem', 'Luuk', 'Bram', 'Jesse', 'Thijs', 'Mees', 'Stijn', 'Joris', 'Ruben', 'Sven', 'Tom', 'Niels', 'Max', 'Finn', 'Gijs', 'Jasper', 'Milan', 'Lars', 'Teun'],
      l: ['de Jong', 'Jansen', 'de Vries', 'van den Berg', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Dijk', 'Dekker', 'Brouwer', 'Kok', 'Jacobs'],
    },
    pt: {
      f: ['João', 'Tiago', 'Rafael', 'Bruno', 'Diogo', 'Gonçalo', 'Pedro', 'André', 'Rui', 'Miguel', 'Vitor', 'Gabriel', 'Mateus', 'Felipe', 'Thiago', 'Caio', 'Rodrigo', 'Léo', 'Vinícius', 'Danilo'],
      l: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Sousa', 'Fernandes', 'Gonçalves', 'Almeida', 'Ribeiro', 'Carvalho', 'Teixeira', 'Moreira', 'Cardoso', 'Lopes', 'Barbosa', 'Nogueira'],
    },
    tr: {
      f: ['Emre', 'Mert', 'Burak', 'Cem', 'Kerem', 'Arda', 'Can', 'Yusuf', 'Eren', 'Oğuz', 'Barış', 'Kaan', 'Serkan', 'Onur', 'Deniz', 'Ozan', 'Tolga', 'Hakan', 'Berk', 'Ali'],
      l: ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat', 'Erdoğan'],
    },
    us: {
      f: ['Mason', 'Logan', 'Ethan', 'Caleb', 'Owen', 'Dylan', 'Austin', 'Tanner', 'Brandon', 'Kyle', 'Jaden', 'Miles', 'Trevor', 'Wyatt', 'Chase', 'Hunter', 'Blake', 'Cody', 'Landon', 'Brady'],
      l: ['Johnson', 'Williams', 'Davis', 'Miller', 'Anderson', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'Clark', 'Lewis', 'Young', 'Allen', 'King', 'Scott', 'Adams', 'Baker', 'Nelson'],
    },
  };
  FCK.NAME_GROUPS = Object.keys(FCK.NAMES);

  FCK.REF_NAMES = ['M. Hartmann', 'L. Brandt', 'S. Delgado', 'P. Rinaldi', 'J. Whitfield', 'T. Vermeer', 'A. Kovač', 'D. Moreau', 'F. Lindqvist', 'R. Okafor'];

  // ---------- Looks ----------
  FCK.SKIN = ['#f6d5bd', '#eac0a0', '#d6a57e', '#b9855d', '#8f5e3d', '#6a4228', '#4a2c1b'];
  FCK.HAIR = ['#1c1410', '#2e2018', '#4a3322', '#6b4a2f', '#a8793f', '#d9b36a', '#c0562b', '#9a9a9a'];
  FCK.HAIR_STYLES = ['short', 'buzz', 'long', 'curly', 'bald', 'bun', 'mohawk', 'fade'];
  // skin weights per name group (index = FCK.SKIN)
  FCK.SKIN_W = {
    de: [5, 5, 2, 0.5, 0.2, 0, 0], en: [4, 4, 2, 1.5, 1.5, 1, 0.5], es: [3, 5, 4, 1.5, 0.5, 0, 0],
    it: [3, 5, 4, 1, 0.3, 0, 0], fr: [3, 4, 3, 2, 2, 1.5, 0.8], nl: [4, 4, 2, 1, 1, 1, 0.5],
    pt: [2, 4, 4, 3, 2, 1, 0.5], tr: [2, 5, 5, 1.5, 0.3, 0, 0], us: [3, 3, 3, 2, 2, 1.5, 0.8],
  };

  // ---------- Formations ----------
  // fx = depth from own goal (0..1), fy = across (0..1, 0 = team's left)
  const S = (pos, fx, fy) => ({ pos, fx, fy });
  FCK.FORMATIONS = {
    '4-4-2': [S('GK', 0.03, 0.5), S('LB', 0.2, 0.1), S('CB', 0.18, 0.36), S('CB', 0.18, 0.64), S('RB', 0.2, 0.9), S('LM', 0.45, 0.1), S('CM', 0.42, 0.38), S('CM', 0.42, 0.62), S('RM', 0.45, 0.9), S('ST', 0.72, 0.38), S('ST', 0.72, 0.62)],
    '4-3-3': [S('GK', 0.03, 0.5), S('LB', 0.2, 0.1), S('CB', 0.18, 0.36), S('CB', 0.18, 0.64), S('RB', 0.2, 0.9), S('CM', 0.4, 0.28), S('CDM', 0.35, 0.5), S('CM', 0.4, 0.72), S('LW', 0.7, 0.12), S('ST', 0.76, 0.5), S('RW', 0.7, 0.88)],
    '3-5-2': [S('GK', 0.03, 0.5), S('CB', 0.17, 0.25), S('CB', 0.15, 0.5), S('CB', 0.17, 0.75), S('LWB', 0.4, 0.06), S('CM', 0.41, 0.3), S('CDM', 0.34, 0.5), S('CM', 0.41, 0.7), S('RWB', 0.4, 0.94), S('ST', 0.72, 0.4), S('ST', 0.72, 0.6)],
    '4-2-3-1': [S('GK', 0.03, 0.5), S('LB', 0.2, 0.1), S('CB', 0.18, 0.36), S('CB', 0.18, 0.64), S('RB', 0.2, 0.9), S('CDM', 0.34, 0.36), S('CDM', 0.34, 0.64), S('LAM', 0.58, 0.12), S('CAM', 0.55, 0.5), S('RAM', 0.58, 0.88), S('ST', 0.76, 0.5)],
    '5-3-2': [S('GK', 0.03, 0.5), S('LWB', 0.26, 0.06), S('CB', 0.17, 0.25), S('CB', 0.15, 0.5), S('CB', 0.17, 0.75), S('RWB', 0.26, 0.94), S('CM', 0.42, 0.28), S('CM', 0.4, 0.5), S('CM', 0.42, 0.72), S('ST', 0.72, 0.4), S('ST', 0.72, 0.6)],
    '4-1-4-1': [S('GK', 0.03, 0.5), S('LB', 0.2, 0.1), S('CB', 0.18, 0.36), S('CB', 0.18, 0.64), S('RB', 0.2, 0.9), S('CDM', 0.32, 0.5), S('LM', 0.5, 0.08), S('CM', 0.48, 0.36), S('CM', 0.48, 0.64), S('RM', 0.5, 0.92), S('ST', 0.74, 0.5)],
    '3-4-3': [S('GK', 0.03, 0.5), S('CB', 0.17, 0.25), S('CB', 0.15, 0.5), S('CB', 0.17, 0.75), S('LM', 0.42, 0.08), S('CM', 0.4, 0.38), S('CM', 0.4, 0.62), S('RM', 0.42, 0.92), S('LW', 0.7, 0.16), S('ST', 0.76, 0.5), S('RW', 0.7, 0.84)],
  };
  FCK.FORMATION_NAMES = Object.keys(FCK.FORMATIONS);

  FCK.ROLE_OF = {
    GK: 'GK', LB: 'DF', CB: 'DF', RB: 'DF', LWB: 'DF', RWB: 'DF',
    CM: 'MF', CDM: 'MF', CAM: 'MF', LM: 'MF', RM: 'MF', LAM: 'MF', RAM: 'MF',
    ST: 'FW', LW: 'FW', RW: 'FW',
  };

  // display labels for positions (internal codes stay English so saves/exports keep working)
  FCK.POS_DE = { GK: 'TW', CB: 'IV', LB: 'LV', RB: 'RV', LWB: 'LAV', RWB: 'RAV', CDM: 'ZDM', CM: 'ZM', CAM: 'ZOM', LM: 'LM', RM: 'RM', LAM: 'LF', RAM: 'RF', LW: 'LF', RW: 'RF', ST: 'ST' };
  FCK.posL = (code) => (!FCK.settings || FCK.settings.lang !== 'en' ? FCK.POS_DE[code] || code : code);

  // Tactic styles: line (defensive line), press, width, risk, tempo  (0..1)
  FCK.STYLES = {
    balanced: { line: 0.5, press: 0.5, width: 0.5, risk: 0.45, tempo: 0.5 },
    attacking: { line: 0.68, press: 0.68, width: 0.66, risk: 0.68, tempo: 0.66 },
    defensive: { line: 0.28, press: 0.34, width: 0.4, risk: 0.28, tempo: 0.4 },
    counter: { line: 0.34, press: 0.4, width: 0.55, risk: 0.7, tempo: 0.78 },
    pressing: { line: 0.72, press: 0.92, width: 0.55, risk: 0.5, tempo: 0.7 },
  };
  FCK.STYLE_KEYS = Object.keys(FCK.STYLES);

  // Difficulty presets (CPU)
  FCK.LEVELS = {
    rookie: { react: 0.7, passAcc: 0.6, aggr: 0.12, tempo: 0.88 },
    amateur: { react: 0.52, passAcc: 0.78, aggr: 0.3, tempo: 0.94 },
    pro: { react: 0.36, passAcc: 0.95, aggr: 0.5, tempo: 1.0 },
    world: { react: 0.24, passAcc: 1.12, aggr: 0.7, tempo: 1.06 },
    legend: { react: 0.14, passAcc: 1.28, aggr: 0.85, tempo: 1.12 },
  };
  FCK.LEVEL_KEYS = Object.keys(FCK.LEVELS);

  FCK.WEATHERS = ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'];
  FCK.TIMES = ['day', 'evening', 'night'];

  // Default settings
  FCK.DEFAULTS = {
    lang: 'de',
    profile: 'normal', // 'kids' | 'normal'
    master: 0.8, sfx: 0.9, music: 0.5, crowd: 0.8, speech: 0.9,
    commentary: true, speech_on: false, musicInGame: false, muted: false,
    zoom: 'mid', radar: true, particles: true, touch: 'auto', uiStyle: 'mix',
  };

  FCK.DEFAULT_MATCH = {
    halfMins: 4, weather: 'clear', tod: 'day', knockout: false,
    level: 'pro', react: 0.36, passAcc: 0.95, aggr: 0.5, tempo: 1.0,
    referee: 'normal', assist: 0.5, gkManual: false,
    offside: true, advantage: true, cards: true, injuries: true,
    homeFormation: '4-3-3', awayFormation: '4-4-2', homeStyle: 'balanced', awayStyle: 'balanced',
  };
})((globalThis.FCK = globalThis.FCK || {}));
