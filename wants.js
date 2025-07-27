// ==UserScript==
// @name         MKM Seller Offers Integration
// @namespace    https://gist.github.com/tuusuario/mkm-seller-offers-integration
// @version      1.0.3
// @description  En páginas de producto añade un botón “Wants” antes del precio; en páginas de Offers/Singles filtra automáticamente por “Amulet RESTANTE MIN”.
// @match        https://www.cardmarket.com/*/Magic/Products/Singles/*
// @match        https://www.cardmarket.com/*/Magic/Users/*/Offers/Singles*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  const WANT_LIST_NAME = 'Amulet RESTANTE MIN';

  // --- PRODUCT PAGE: insert "Wants" button before the price ---
  function insertWantsButtons() {
    document.querySelectorAll('div.article-row').forEach(row => {
      // avoid duplicates
      if (row.querySelector('a.view-seller-offers')) return;

      // locate seller link
      const sellerLink = row.querySelector('span.seller-name a');
      if (!sellerLink) return;

      // build Offers/Singles URL
      const offersUrl = sellerLink.href.replace(/\/$/, '') + '/Offers/Singles';

      // locate price container
      const priceContainer = row.querySelector('.price-container');
      if (!priceContainer) return;

      // create "Wants" button
      const btn = document.createElement('a');
      btn.href        = offersUrl;
      btn.target      = '_blank';
      btn.textContent = 'Wants';
      btn.className   = 'btn btn-sm btn-outline-info view-seller-offers';
      btn.style.marginRight = '0px';  // reducida para menor espacio

      // insert button before price container
      priceContainer.parentNode.insertBefore(btn, priceContainer);
    });
  }

  // --- SELLER OFFERS PAGE: auto-filter by Want List ---
  function autoFilterByWantList() {
    // don't override if already filtered
    if (/[?&]idWantslist=/.test(location.search)) return;

    const select = document.getElementById('idWantsListSelect');
    const form   = document.getElementById('UserInventoryFilterForm');
    if (!select || !form) return;

    // find matching option
    const opt = Array.from(select.options)
      .find(o => o.textContent.trim() === WANT_LIST_NAME);
    if (!opt) {
      console.warn(`No se encontró la opción “${WANT_LIST_NAME}”`);
      return;
    }

    select.value = opt.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    form.submit();
  }

  // --- INIT ---
  // On product pages
  if (/\/Magic\/Products\/Singles\//.test(location.pathname)) {
    insertWantsButtons();
    // observe dynamic loads
    const container = document.querySelector('div.table-body');
    if (container) {
      new MutationObserver(insertWantsButtons)
        .observe(container, { childList: true, subtree: true });
    }
  }

  // On seller offers pages
  if (/\/Magic\/Users\/.+\/Offers\/Singles/.test(location.pathname)) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoFilterByWantList);
    } else {
      autoFilterByWantList();
    }
  }

})();
