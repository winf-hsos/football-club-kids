/* FCK - i18n_3d.js : texts for the 3D match view (settings, camera names, hints) */
(function (FCK) {
  'use strict';
  const de = {
    'set.gfx3d': '3D-Ansicht', 'gfx3d.3d': '3D', 'gfx3d.2d': '2D (klassisch)',
    'set.cam3d': 'Kamera (3D)', 'cam3d.tv': 'TV', 'cam3d.high': 'Hoch', 'cam3d.goal': 'Hinter dem Tor', 'cam3d.top': 'Draufsicht',
    'set.q3d': 'Grafikqualität (3D)', 'q3d.low': 'Niedrig', 'q3d.mid': 'Mittel', 'q3d.high': 'Hoch',
    'cam3d.hint': 'Kamera wechseln (Taste B)', 'cam3d.toast': 'Kamera: {n}', 'cam3d.keys': 'Kamera im Spiel wechseln: Taste B oder Tab, Controller Select, oder die Kamera-Taste oben rechts.',
    'gfx3d.unavailable': '3D ist auf diesem Gerät nicht verfügbar – es wird die 2D-Ansicht genutzt.',
    'gfx3d.lost': 'Grafik nicht verfügbar – 2D-Ansicht aktiv.',
    'gfx3d.slow': 'Die 3D-Grafik läuft langsam. Tipp: Einstellungen › Grafikqualität senken oder 2D wählen.',
  };
  const en = {
    'set.gfx3d': '3D view', 'gfx3d.3d': '3D', 'gfx3d.2d': '2D (classic)',
    'set.cam3d': 'Camera (3D)', 'cam3d.tv': 'TV', 'cam3d.high': 'High', 'cam3d.goal': 'Behind the goal', 'cam3d.top': 'Top-down',
    'set.q3d': 'Graphics quality (3D)', 'q3d.low': 'Low', 'q3d.mid': 'Medium', 'q3d.high': 'High',
    'cam3d.hint': 'Change camera (key B)', 'cam3d.toast': 'Camera: {n}', 'cam3d.keys': 'Change camera during a match: key B or Tab, gamepad Select, or the camera button at the top right.',
    'gfx3d.unavailable': '3D is not available on this device – using the 2D view.',
    'gfx3d.lost': 'Graphics not available – 2D view active.',
    'gfx3d.slow': 'The 3D graphics are running slowly. Tip: lower the graphics quality in Settings or choose 2D.',
  };
  Object.assign(FCK.I18N.de, de);
  Object.assign(FCK.I18N.en, en);
})((globalThis.FCK = globalThis.FCK || {}));
