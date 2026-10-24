/* FCK - natdata.js : national teams for the tournaments (own strength estimates, not official rankings) + extra name pools */
(function (FCK) {
  'use strict';

  // Extra name groups. They are NOT added to FCK.NAME_GROUPS, so club squads stay exactly as before.
  const N = FCK.NAMES;
  N.sl = {
    f: ['Marko', 'Luka', 'Ivan', 'Nikola', 'Stefan', 'Milan', 'Tomáš', 'Jakub', 'Petr', 'Mateusz', 'Bogdan', 'Dario', 'Filip', 'Andrej', 'Matej', 'Vlad', 'Dušan', 'Adam', 'Roman', 'Lukasz'],
    l: ['Kovač', 'Novak', 'Horvat', 'Petrović', 'Nowak', 'Kowalski', 'Marković', 'Jovanović', 'Svoboda', 'Dvořák', 'Popescu', 'Ilić', 'Babić', 'Kovalenko', 'Savić', 'Tomić', 'Varga', 'Horváth', 'Lazar', 'Mazur'],
  };
  N.sc = {
    f: ['Erik', 'Magnus', 'Oskar', 'Anders', 'Henrik', 'Mikkel', 'Lars', 'Sven', 'Jonas', 'Emil', 'Johan', 'Axel', 'Tobias', 'Kasper', 'Mathias', 'Elias', 'Viktor', 'Rasmus', 'Ole', 'Leif'],
    l: ['Hansen', 'Johansson', 'Andersen', 'Larsen', 'Nilsson', 'Berg', 'Lindqvist', 'Eriksen', 'Dahl', 'Holm', 'Jensen', 'Svensson', 'Haugen', 'Nyberg', 'Strand', 'Lund', 'Sørensen', 'Bakke', 'Virtanen', 'Korhonen'],
  };
  N.ar = {
    f: ['Karim', 'Omar', 'Youssef', 'Hamza', 'Ahmed', 'Yassine', 'Walid', 'Tarek', 'Amir', 'Khalid', 'Nabil', 'Samir', 'Bilal', 'Ismail', 'Hassan', 'Rachid', 'Zakaria', 'Faris', 'Idris', 'Mahmoud'],
    l: ['Haddad', 'Mansour', 'Benali', 'Saidi', 'Farouk', 'Nasser', 'Khalil', 'Amrani', 'Darwish', 'Rahal', 'Karam', 'Jabari', 'Tahir', 'Ziani', 'Bakri', 'Hamdi', 'Salem', 'Qasim', 'Fadel', 'Maalouf'],
  };
  N.af = {
    f: ['Kwame', 'Emeka', 'Moussa', 'Ibrahim', 'Samuel', 'Kofi', 'Daniel', 'Cheikh', 'Sékou', 'Amadou', 'Yaw', 'Chidi', 'Mamadou', 'Ousmane', 'Isaac', 'Joseph', 'Blaise', 'Didier', 'Ayo', 'Tunde'],
    l: ['Diallo', 'Traoré', 'Mensah', 'Okonkwo', 'Keita', 'Sow', 'Coulibaly', 'Bamba', 'Adeyemi', 'Boateng', 'Ndiaye', 'Kamara', 'Eze', 'Mbeki', 'Oduya', 'Konaté', 'Sarr', 'Camara', 'Nkosi', 'Balogun'],
  };
  N.ja = {
    f: ['Haruto', 'Ren', 'Sota', 'Yuto', 'Kaito', 'Daiki', 'Takumi', 'Riku', 'Hiroki', 'Shun', 'Kenji', 'Yuki', 'Ryo', 'Koki', 'Naoki', 'Taiga', 'Minato', 'Itsuki', 'Kazuki', 'Tatsuya'],
    l: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi', 'Shimizu', 'Mori', 'Ogawa'],
  };
  N.ko = {
    f: ['Min-jun', 'Seo-jun', 'Ji-ho', 'Hyun-woo', 'Joon-ho', 'Sung-min', 'Tae-yang', 'Do-yun', 'Jae-won', 'Woo-jin', 'Dong-hyun', 'Ji-hoon', 'Seung-ho', 'Min-ho', 'Young-jae', 'Sang-hoon', 'Jin-woo', 'Ye-jun', 'Hyeon-seok', 'Gun-woo'],
    l: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim', 'Han', 'Oh', 'Seo', 'Shin', 'Kwon', 'Hwang', 'Ahn', 'Song', 'Yoo', 'Hong'],
  };
  N.ir = {
    f: ['Reza', 'Mehdi', 'Ali', 'Saeed', 'Amir', 'Hossein', 'Behnam', 'Farhad', 'Kaveh', 'Shahin', 'Arash', 'Navid', 'Omid', 'Sina', 'Dariush', 'Timur', 'Rustam', 'Jasur', 'Bakhtiyor', 'Aziz'],
    l: ['Karimi', 'Rezaei', 'Ahmadi', 'Hosseini', 'Moradi', 'Jafari', 'Rahimi', 'Nazari', 'Sadeghi', 'Tavakoli', 'Yusupov', 'Karimov', 'Rashidov', 'Alimov', 'Ismoilov', 'Nurmatov', 'Saidov', 'Bakirov', 'Ergashev', 'Mirzaev'],
  };
  N.gr = {
    f: ['Nikos', 'Giorgos', 'Dimitris', 'Kostas', 'Yannis', 'Panos', 'Thanasis', 'Christos', 'Stavros', 'Lefteris', 'Vasilis', 'Manolis', 'Alexandros', 'Petros', 'Sotiris', 'Andreas', 'Michalis', 'Theo', 'Fotis', 'Haris'],
    l: ['Papadopoulos', 'Nikolaidis', 'Georgiou', 'Vasileiou', 'Alexiou', 'Antoniou', 'Papas', 'Christou', 'Dimitriou', 'Makris', 'Stergiou', 'Pappas', 'Kyriakou', 'Lazaridis', 'Manolas', 'Oikonomou', 'Theodorou', 'Ioannou', 'Zafeiris', 'Karras'],
  };
  const SW = FCK.SKIN_W;
  SW.sl = [4, 5, 3, 1, 0.2, 0, 0]; SW.sc = [6, 4, 1, 0.4, 0.1, 0, 0]; SW.ar = [1, 4, 6, 3, 1, 0.3, 0];
  SW.af = [0, 0, 0.5, 2, 5, 6, 4]; SW.ja = [3, 6, 3, 0.3, 0, 0, 0]; SW.ko = [3, 6, 3, 0.2, 0, 0, 0];
  SW.ir = [1, 4, 6, 3, 0.5, 0, 0]; SW.gr = [2, 5, 5, 1, 0.2, 0, 0];
  FCK.EXTRA_NAME_GROUPS = ['sl', 'sc', 'ar', 'af', 'ja', 'ko', 'ir', 'gr'];

  // id, German name, English name, flag, confederation, strength r (club scale 10..96), name group, primary, secondary, kit
  const n = (id, de, en, flag, conf, r, g, p, s, kit) => ({ id, de, en, flag, conf, r, g, p, s, kit: kit || 'solid' });
  FCK.NATIONS = [
    // UEFA
    n('ESP', 'Spanien', 'Spain', '🇪🇸', 'UEFA', 91, 'es', '#c60b1e', '#ffc400'),
    n('FRA', 'Frankreich', 'France', '🇫🇷', 'UEFA', 90, 'fr', '#1b3a8a', '#e30613'),
    n('ENG', 'England', 'England', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'UEFA', 89, 'en', '#f4f4f4', '#1c2a6b'),
    n('POR', 'Portugal', 'Portugal', '🇵🇹', 'UEFA', 88, 'pt', '#a50021', '#046a38'),
    n('GER', 'Deutschland', 'Germany', '🇩🇪', 'UEFA', 87, 'de', '#f4f4f4', '#111111'),
    n('NED', 'Niederlande', 'Netherlands', '🇳🇱', 'UEFA', 86, 'nl', '#f36c21', '#1b2a6b'),
    n('ITA', 'Italien', 'Italy', '🇮🇹', 'UEFA', 84, 'it', '#0a56a8', '#ffffff'),
    n('BEL', 'Belgien', 'Belgium', '🇧🇪', 'UEFA', 83, 'nl', '#c8102e', '#111111'),
    n('CRO', 'Kroatien', 'Croatia', '🇭🇷', 'UEFA', 82, 'sl', '#f4f4f4', '#c8102e', 'hoops'),
    n('SUI', 'Schweiz', 'Switzerland', '🇨🇭', 'UEFA', 78, 'de', '#d52b1e', '#ffffff'),
    n('DEN', 'Dänemark', 'Denmark', '🇩🇰', 'UEFA', 78, 'sc', '#c8102e', '#ffffff'),
    n('NOR', 'Norwegen', 'Norway', '🇳🇴', 'UEFA', 78, 'sc', '#ba0c2f', '#00205b'),
    n('AUT', 'Österreich', 'Austria', '🇦🇹', 'UEFA', 77, 'de', '#c8102e', '#ffffff'),
    n('TUR', 'Türkei', 'Türkiye', '🇹🇷', 'UEFA', 77, 'tr', '#e30a17', '#ffffff'),
    n('POL', 'Polen', 'Poland', '🇵🇱', 'UEFA', 74, 'sl', '#f4f4f4', '#dc143c'),
    n('UKR', 'Ukraine', 'Ukraine', '🇺🇦', 'UEFA', 74, 'sl', '#ffd500', '#005bbb'),
    n('SWE', 'Schweden', 'Sweden', '🇸🇪', 'UEFA', 74, 'sc', '#fecc02', '#006aa7'),
    n('SRB', 'Serbien', 'Serbia', '🇷🇸', 'UEFA', 73, 'sl', '#c6363c', '#0c4076'),
    n('SCO', 'Schottland', 'Scotland', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'UEFA', 72, 'en', '#0b2a6f', '#ffffff'),
    n('CZE', 'Tschechien', 'Czechia', '🇨🇿', 'UEFA', 72, 'sl', '#d7141a', '#11457e'),
    n('HUN', 'Ungarn', 'Hungary', '🇭🇺', 'UEFA', 72, 'sl', '#ce2939', '#477050'),
    n('WAL', 'Wales', 'Wales', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'UEFA', 70, 'en', '#c8102e', '#ffffff'),
    n('GRE', 'Griechenland', 'Greece', '🇬🇷', 'UEFA', 70, 'gr', '#0d5eaf', '#ffffff'),
    n('ROU', 'Rumänien', 'Romania', '🇷🇴', 'UEFA', 69, 'sl', '#fcd116', '#002b7f'),
    n('SVK', 'Slowakei', 'Slovakia', '🇸🇰', 'UEFA', 67, 'sl', '#0b4ea2', '#ee1c25'),
    n('SVN', 'Slowenien', 'Slovenia', '🇸🇮', 'UEFA', 66, 'sl', '#f4f4f4', '#005da4'),
    n('IRL', 'Irland', 'Ireland', '🇮🇪', 'UEFA', 66, 'en', '#169b62', '#ffffff'),
    n('BIH', 'Bosnien-Herzegowina', 'Bosnia and Herzegovina', '🇧🇦', 'UEFA', 65, 'sl', '#002f6c', '#fecb00'),
    n('ALB', 'Albanien', 'Albania', '🇦🇱', 'UEFA', 64, 'sl', '#e41e20', '#111111'),
    n('GEO', 'Georgien', 'Georgia', '🇬🇪', 'UEFA', 63, 'sl', '#f4f4f4', '#d6001c'),
    n('NIR', 'Nordirland', 'Northern Ireland', '🇬🇧', 'UEFA', 62, 'en', '#0a7d3e', '#ffffff'),
    n('FIN', 'Finnland', 'Finland', '🇫🇮', 'UEFA', 62, 'sc', '#f4f4f4', '#003580'),
    n('ISL', 'Island', 'Iceland', '🇮🇸', 'UEFA', 60, 'sc', '#02529c', '#dc1e35'),
    // CONMEBOL
    n('ARG', 'Argentinien', 'Argentina', '🇦🇷', 'CONMEBOL', 90, 'es', '#75aadb', '#ffffff', 'stripesV'),
    n('BRA', 'Brasilien', 'Brazil', '🇧🇷', 'CONMEBOL', 88, 'pt', '#ffdc02', '#009c3b'),
    n('URU', 'Uruguay', 'Uruguay', '🇺🇾', 'CONMEBOL', 82, 'es', '#5cbfeb', '#1b1b1b'),
    n('COL', 'Kolumbien', 'Colombia', '🇨🇴', 'CONMEBOL', 82, 'es', '#fcd116', '#003893'),
    n('ECU', 'Ecuador', 'Ecuador', '🇪🇨', 'CONMEBOL', 77, 'es', '#ffd100', '#034ea2'),
    n('PAR', 'Paraguay', 'Paraguay', '🇵🇾', 'CONMEBOL', 72, 'es', '#d52b1e', '#0038a8', 'stripesV'),
    n('VEN', 'Venezuela', 'Venezuela', '🇻🇪', 'CONMEBOL', 66, 'es', '#7a1f3d', '#fcd116'),
    n('CHI', 'Chile', 'Chile', '🇨🇱', 'CONMEBOL', 66, 'es', '#d52b1e', '#0039a6'),
    n('PER', 'Peru', 'Peru', '🇵🇪', 'CONMEBOL', 64, 'es', '#f4f4f4', '#d91023', 'sash'),
    n('BOL', 'Bolivien', 'Bolivia', '🇧🇴', 'CONMEBOL', 56, 'es', '#007934', '#fcd116'),
    // CONCACAF
    n('USA', 'USA', 'USA', '🇺🇸', 'CONCACAF', 78, 'us', '#f4f4f4', '#0a3161'),
    n('MEX', 'Mexiko', 'Mexico', '🇲🇽', 'CONCACAF', 77, 'es', '#006847', '#ce1126'),
    n('CAN', 'Kanada', 'Canada', '🇨🇦', 'CONCACAF', 73, 'en', '#d52b1e', '#ffffff'),
    n('PAN', 'Panama', 'Panama', '🇵🇦', 'CONCACAF', 66, 'es', '#d21034', '#005293'),
    n('CRC', 'Costa Rica', 'Costa Rica', '🇨🇷', 'CONCACAF', 63, 'es', '#ce1126', '#002b7f'),
    n('JAM', 'Jamaika', 'Jamaica', '🇯🇲', 'CONCACAF', 62, 'en', '#fed100', '#009b3a'),
    n('HON', 'Honduras', 'Honduras', '🇭🇳', 'CONCACAF', 58, 'es', '#0073cf', '#ffffff'),
    n('HAI', 'Haiti', 'Haiti', '🇭🇹', 'CONCACAF', 56, 'fr', '#00209f', '#d21034'),
    n('CUW', 'Curaçao', 'Curaçao', '🇨🇼', 'CONCACAF', 54, 'nl', '#002b7f', '#f9e814'),
    // CAF
    n('MAR', 'Marokko', 'Morocco', '🇲🇦', 'CAF', 82, 'ar', '#c1272d', '#006233'),
    n('SEN', 'Senegal', 'Senegal', '🇸🇳', 'CAF', 78, 'af', '#00853f', '#fdef42'),
    n('CIV', 'Elfenbeinküste', 'Ivory Coast', '🇨🇮', 'CAF', 75, 'af', '#f77f00', '#009e60'),
    n('EGY', 'Ägypten', 'Egypt', '🇪🇬', 'CAF', 74, 'ar', '#ce1126', '#111111'),
    n('ALG', 'Algerien', 'Algeria', '🇩🇿', 'CAF', 73, 'ar', '#f4f4f4', '#006233'),
    n('NGA', 'Nigeria', 'Nigeria', '🇳🇬', 'CAF', 72, 'af', '#008751', '#f4f4f4'),
    n('TUN', 'Tunesien', 'Tunisia', '🇹🇳', 'CAF', 70, 'ar', '#e70013', '#ffffff'),
    n('CMR', 'Kamerun', 'Cameroon', '🇨🇲', 'CAF', 70, 'af', '#007a5e', '#ce1126'),
    n('GHA', 'Ghana', 'Ghana', '🇬🇭', 'CAF', 68, 'af', '#f4f4f4', '#ce1126'),
    n('MLI', 'Mali', 'Mali', '🇲🇱', 'CAF', 68, 'af', '#14b53a', '#fcd116'),
    n('COD', 'DR Kongo', 'DR Congo', '🇨🇩', 'CAF', 66, 'af', '#007fff', '#f7d618'),
    n('RSA', 'Südafrika', 'South Africa', '🇿🇦', 'CAF', 64, 'af', '#ffb612', '#007749'),
    n('BFA', 'Burkina Faso', 'Burkina Faso', '🇧🇫', 'CAF', 63, 'af', '#009a00', '#ef2b2d'),
    n('CPV', 'Kap Verde', 'Cape Verde', '🇨🇻', 'CAF', 62, 'pt', '#003893', '#cf2027'),
    // AFC
    n('JPN', 'Japan', 'Japan', '🇯🇵', 'AFC', 79, 'ja', '#1a3a8f', '#ffffff'),
    n('KOR', 'Südkorea', 'South Korea', '🇰🇷', 'AFC', 76, 'ko', '#c60c30', '#003478'),
    n('IRN', 'Iran', 'Iran', '🇮🇷', 'AFC', 74, 'ir', '#f4f4f4', '#da0000'),
    n('AUS', 'Australien', 'Australia', '🇦🇺', 'AFC', 72, 'en', '#ffcd00', '#00843d'),
    n('KSA', 'Saudi-Arabien', 'Saudi Arabia', '🇸🇦', 'AFC', 66, 'ar', '#006c35', '#ffffff'),
    n('UZB', 'Usbekistan', 'Uzbekistan', '🇺🇿', 'AFC', 65, 'ir', '#0099b5', '#ffffff'),
    n('QAT', 'Katar', 'Qatar', '🇶🇦', 'AFC', 62, 'ar', '#8a1538', '#ffffff'),
    n('JOR', 'Jordanien', 'Jordan', '🇯🇴', 'AFC', 62, 'ar', '#ce1126', '#111111'),
    n('IRQ', 'Irak', 'Iraq', '🇮🇶', 'AFC', 60, 'ar', '#007a3d', '#ffffff'),
    n('UAE', 'Ver. Arab. Emirate', 'UAE', '🇦🇪', 'AFC', 58, 'ar', '#f4f4f4', '#c8102e'),
    // OFC
    n('NZL', 'Neuseeland', 'New Zealand', '🇳🇿', 'OFC', 56, 'en', '#111111', '#ffffff'),
  ];
  FCK.NATION_BY_ID = {};
  FCK.NATIONS.forEach((x) => { FCK.NATION_BY_ID[x.id] = x; });
})((globalThis.FCK = globalThis.FCK || {}));
