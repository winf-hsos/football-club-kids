/* FCK - donateui.js : donation link, wish dialog (donation + wish by e-mail) and the periodic reminder (menus only, never during a match) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const T = (k, v) => FCK.T(k, v);

  const PAYPAL = 'https://paypal.me/Meseth';
  const MAIL = 'max.meseth@gmail.com';
  const TIERS = [1, 2, 5, 10];
  const EVERY_MS = 15 * 60 * 1000;

  const payUrl = (eur) => PAYPAL + (eur ? '/' + eur + 'EUR' : '');
  const openUrl = (url) => { try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { /* blocked */ } };

  UI.donateDialog = function () {
    let eur = 5;
    const name = h('input', { class: 'txt', type: 'text', maxlength: 40, placeholder: T('donate.name') });
    const wish = h('textarea', { class: 'code', rows: 4, maxlength: 400, placeholder: T('donate.wish.ph') });
    const chips = this.chips(TIERS.map((n) => ({ v: n, l: n + ' €' })).concat([{ v: 0, l: T('donate.free') }]), eur, (v) => { eur = v; }, 'scroll');
    const mail = () => {
      const subj = 'FCK Wunsch' + (eur ? ' (' + eur + ' €)' : '') + (name.value.trim() ? ' von ' + name.value.trim() : '');
      const body = wish.value.trim() + '\n\n' + T('donate.mail.sig', { eur: eur ? eur + ' €' : '?', name: name.value.trim() || '?' });
      try { window.location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body); } catch (e) { /* no mail client */ }
      try { navigator.clipboard.writeText(subj + '\n' + body).then(() => this.toast(T('donate.copied'))).catch(() => {}); } catch (e) { /* ignore */ }
    };
    const body = h('div', { class: 'donate-box' },
      h('p', { text: T('donate.txt') }),
      h('p', { class: 'fine', text: T('donate.prio') }),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('donate.amount') }), chips),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('donate.yourwish') }), wish),
      h('div', { class: 'field' }, name),
      h('div', { class: 'row' },
        this.btn('♥ ' + T('donate.go'), () => { openUrl(payUrl(eur)); }, 'primary'),
        this.btn('✉ ' + T('donate.mail'), mail, 'ghost')),
      h('p', { class: 'fine', text: T('donate.steps') }),
      h('p', { class: 'fine', text: T('donate.parents') }),
      h('div', { class: 'row' }, this.btn(T('close'), () => this.closeModal(), 'ghost')));
    return this.modal(T('donate.t'), body, { cls: 'donate-modal' });
  };

  UI.donateLink = function () {
    const b = h('button', { class: 'donate-link', type: 'button' }, '♥ ' + T('donate'), h('small', { text: T('donate.sub') }));
    b.addEventListener('click', () => { this.sfx('click'); this.donateDialog(); });
    return b;
  };

  // periodic reminder: only on the home menu, never while a match is running, every 15 minutes at most
  UI.donateReminder = function () {
    U.store.set('donate.next', Date.now() + EVERY_MS);
    const later = () => this.closeModal();
    const body = h('div', null,
      h('p', { text: T('donate.rem.txt') }),
      h('p', { class: 'fine', text: T('donate.parents') }),
      h('div', { class: 'row' },
        this.btn('♥ ' + T('donate.rem.go'), () => { this.donateDialog(); }, 'primary'),
        this.btn(T('donate.later'), later, 'ghost'),
        this.btn(T('donate.never'), () => { U.store.set('donate.off', true); this.closeModal(); }, 'ghost')));
    this.modal(T('donate.t'), body);
  };

  function tick() {
    try {
      if (U.store.get('donate.off', false)) return;
      if (!FCK.settings || !FCK.settings.welcomed) return;
      const next = U.store.get('donate.next', 0);
      if (!next) { U.store.set('donate.next', Date.now() + EVERY_MS); return; }
      if (Date.now() < next) return;
      if (UI.cur !== 'home' || UI.modalOpen || UI.screenEl.hidden || document.hidden) return;
      UI.donateReminder();
    } catch (e) { /* never break the game for a reminder */ }
  }
  setInterval(tick, 20000);
})((globalThis.FCK = globalThis.FCK || {}));
