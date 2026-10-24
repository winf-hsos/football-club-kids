/* FCK - i18n_pad.js : texts for controller support (menu navigation hints, on-screen keyboard, settings, help) */
(function (FCK) {
  'use strict';
  const de = {
    // hint bar
    'pad.h.select': 'Auswählen', 'pad.h.open': 'Öffnen', 'pad.h.toggle': 'Umschalten', 'pad.h.type': 'Eingeben', 'pad.h.change': 'Ändern', 'pad.h.move': 'Bewegen',
    'pad.h.back': 'Zurück', 'pad.h.close': 'Schließen', 'pad.h.cancel': 'Abbrechen', 'pad.h.resume': 'Weiter', 'pad.h.tabs': 'Tabs', 'pad.h.scroll': 'Blättern',
    'pad.h.ok': 'Fertig', 'pad.h.del': 'Löschen', 'pad.h.space': 'Leerzeichen', 'pad.h.start': 'Start',
    // on-screen keyboard
    'pad.osk.title': 'Text eingeben', 'pad.osk.space': 'Leerzeichen', 'pad.osk.ok': 'OK', 'pad.osk.cancel': 'Abbrechen', 'pad.osk.shift': 'Groß/klein', 'pad.osk.del': 'Löschen',
    // events
    'pad.disconnected': 'Controller getrennt', 'pad.disconnected.pause': 'Controller getrennt – Spiel pausiert',
    // device line (mode screens)
    'pad.line': 'Steuerung', 'pad.line.p': 'Spieler {n}: {d}', 'pad.line.change': 'Ändern', 'pad.line.hint': 'Controller nicht erkannt? Drücke eine Taste am Controller.',
    'pad.line.pick': 'Bevorzugtes Gerät für Spieler 1',
    // settings
    'pad.set.title': 'Controller & Steuerung', 'pad.set.pref': 'Gerät für Spieler 1', 'pref.auto': 'Auto', 'pref.kb': 'Tastatur', 'pref.pad': 'Controller', 'pref.touch': 'Touch',
    'pad.set.help': 'Auto nimmt den Controller, sobald einer erkannt ist, sonst die Tastatur (bzw. Touch). Du kannst das Gerät im Freundschaftsspiel auch pro Spieler einstellen.',
    'pad.set.none': 'Kein Controller erkannt. Browser zeigen Controller erst, wenn du eine Taste am Controller drückst – drück jetzt eine beliebige Taste.',
    'pad.set.found': '{n} Controller erkannt', 'pad.set.slot': 'Controller {n}',
    // help
    'pad.help.menu': 'Controller in Menüs', 'pad.help.m.move': 'Auswahl bewegen', 'pad.help.m.ok': 'Bestätigen', 'pad.help.m.back': 'Zurück / Dialog schließen',
    'pad.help.m.tabs': 'Tab wechseln', 'pad.help.m.page': 'Seite blättern / Liste scrollen', 'pad.help.m.start': 'Hauptaktion (z. B. Anstoß, Weiter)', 'pad.help.m.change': 'Regler, Auswahl und Chips ändern',
    'pad.help.m.text': 'Textfeld: A öffnet die Bildschirmtastatur (Y löschen, X Leerzeichen, Start fertig)',
    'pad.help.play': 'Controller im Spiel', 'pad.help.p.att': 'Mit Ball', 'pad.help.p.att.v': 'A Pass · B Schuss (halten) · Y Steilpass · X Flanke/Lupfer (halten)',
    'pad.help.p.def': 'Ohne Ball', 'pad.help.p.def.v': 'A Spieler wechseln · B Tackling (mit Sprint: Grätsche) · Y Pressing · X Torwart rauskommen',
    'pad.help.p.sprint': 'Sprinten', 'pad.help.p.sprint.v': 'LB / RB / LT / RT',
    'pad.help.p.pause': 'Pause', 'pad.help.p.pause.v': 'Start oder Back (Menü: Start = weiter)',
  };
  const en = {
    'pad.h.select': 'Select', 'pad.h.open': 'Open', 'pad.h.toggle': 'Toggle', 'pad.h.type': 'Type', 'pad.h.change': 'Change', 'pad.h.move': 'Move',
    'pad.h.back': 'Back', 'pad.h.close': 'Close', 'pad.h.cancel': 'Cancel', 'pad.h.resume': 'Resume', 'pad.h.tabs': 'Tabs', 'pad.h.scroll': 'Scroll',
    'pad.h.ok': 'Done', 'pad.h.del': 'Delete', 'pad.h.space': 'Space', 'pad.h.start': 'Start',
    'pad.osk.title': 'Enter text', 'pad.osk.space': 'Space', 'pad.osk.ok': 'OK', 'pad.osk.cancel': 'Cancel', 'pad.osk.shift': 'Shift', 'pad.osk.del': 'Delete',
    'pad.disconnected': 'Controller disconnected', 'pad.disconnected.pause': 'Controller disconnected – game paused',
    'pad.line': 'Controls', 'pad.line.p': 'Player {n}: {d}', 'pad.line.change': 'Change', 'pad.line.hint': 'Controller not detected? Press any button on it.',
    'pad.line.pick': 'Preferred device for player 1',
    'pad.set.title': 'Controller & controls', 'pad.set.pref': 'Device for player 1', 'pref.auto': 'Auto', 'pref.kb': 'Keyboard', 'pref.pad': 'Controller', 'pref.touch': 'Touch',
    'pad.set.help': 'Auto uses the controller as soon as one is detected, otherwise the keyboard (or touch). In the friendly match you can also set the device per player.',
    'pad.set.none': 'No controller detected. Browsers only reveal a controller after you press a button on it – press any button now.',
    'pad.set.found': '{n} controller(s) detected', 'pad.set.slot': 'Controller {n}',
    'pad.help.menu': 'Controller in menus', 'pad.help.m.move': 'Move selection', 'pad.help.m.ok': 'Confirm', 'pad.help.m.back': 'Back / close dialog',
    'pad.help.m.tabs': 'Switch tab', 'pad.help.m.page': 'Page up/down / scroll lists', 'pad.help.m.start': 'Main action (e.g. kick-off, continue)', 'pad.help.m.change': 'Change sliders, selections and chips',
    'pad.help.m.text': 'Text field: A opens the on-screen keyboard (Y delete, X space, Start done)',
    'pad.help.play': 'Controller in the match', 'pad.help.p.att': 'With the ball', 'pad.help.p.att.v': 'A pass · B shoot (hold) · Y through ball · X cross/lob (hold)',
    'pad.help.p.def': 'Without the ball', 'pad.help.p.def.v': 'A switch player · B tackle (with sprint: slide) · Y press · X keeper rush',
    'pad.help.p.sprint': 'Sprint', 'pad.help.p.sprint.v': 'LB / RB / LT / RT',
    'pad.help.p.pause': 'Pause', 'pad.help.p.pause.v': 'Start or Back (menu: Start = resume)',
  };
  Object.assign(FCK.I18N.de, de);
  Object.assign(FCK.I18N.en, en);
})((globalThis.FCK = globalThis.FCK || {}));
