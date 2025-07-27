// ==UserScript==
// @name         MKM Seller Status Highlight (v1.1.6)
// @namespace    https://gist.github.com/tuusuario/mkm-seller-status
// @version      1.1.6
// @description  Muestra “U” (UNPAID) y/o “C” (CART) junto al vendedor en la página de producto, con badges de igual tamaño.
// @match        https://www.cardmarket.com/*/Magic/Products/Singles/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(async function() {
  'use strict';
  const locale = window.location.pathname.split('/')[1] || 'es';

  // — Helpers —

  async function fetchText(path) {
    const res = await fetch(path, { credentials: 'include' });
    return res.ok ? res.text() : '';
  }

  function parseSellerNames(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out = new Set();
    doc.querySelectorAll('.seller-name').forEach(el => {
      let name = '';
      const a = el.querySelector('a');
      if (a) name = a.textContent.trim();
      else {
        for (let ch of el.children) {
          if (ch.tagName.toLowerCase()==='span' && !ch.classList.contains('icon')) {
            const i = ch.querySelector('span');
            name = (i ? i.textContent : ch.textContent).trim();
            if (name) break;
          }
        }
      }
      if (name) out.add(name);
    });
    return out;
  }

  function makeBadge(letter, bg) {
    const b = document.createElement('span');
    b.textContent = letter;
    b.style.cssText = [
      'display:inline-block',
      'width:1.2em',
      'line-height:1',
      'text-align:center',
      `background:${bg}`,
      'color:#fff',
      'padding:0.15em 0',
      'font-size:0.8em',
      'font-weight:bold',
      'margin-left:4px',
      'border-radius:2px',
      'vertical-align:middle'
    ].join(';');
    return b;
  }

  // — Main —

  const unpaidHtml = await fetchText(`/${locale}/Magic/Orders/Purchases/Unpaid`);
  const unpaidNames = parseSellerNames(unpaidHtml);

  const cartHtml = await fetchText(`/${locale}/Magic/ShoppingCart`);
  const cartNames = parseSellerNames(cartHtml);

  const badgeU = makeBadge('U', 'crimson');
  const badgeC = makeBadge('C', 'royalblue');

  document.querySelectorAll('div.article-row').forEach(row => {
    const sellerEl = row.querySelector('.seller-name');
    if (!sellerEl) return;

    let name = '';
    const a = sellerEl.querySelector('a');
    if (a) name = a.textContent.trim();
    else {
      for (let ch of sellerEl.children) {
        if (ch.tagName.toLowerCase()==='span' && !ch.classList.contains('icon')) {
          const i = ch.querySelector('span');
          name = (i ? i.textContent : ch.textContent).trim();
          if (name) break;
        }
      }
    }
    if (!name) return;

    const needsU = unpaidNames.has(name);
    const needsC = cartNames.has(name);
    if (!needsU && !needsC) return;

    const wrapper = document.createElement('span');
    wrapper.className = 'mkm-status-badges';
    if (needsU) wrapper.appendChild(badgeU.cloneNode(true));
    if (needsC) wrapper.appendChild(badgeC.cloneNode(true));
    sellerEl.insertAdjacentElement('afterend', wrapper);
  });
})();
