// ==UserScript==
// @name         MKM ShippingCosts Injector v1.6
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Añade el coste de envío junto al precio de cada oferta en Cardmarket, sin usar MutationObserver masivo.
// @author
// @match        https://www.cardmarket.com/es/*/Products/Singles/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';

  const JSON_URL = 'https://raw.githubusercontent.com/lodan22/MKM/refs/heads/main/ShippingCosts.json';
  const DEST = 'Spain';
  const WEIGHT = 50; // gramos
  const countryMap = {
    'Austria': 'Austria',
    'Bélgica': 'Belgium',
    'Bulgaria': 'Bulgaria',
    'Croacia': 'Croatia',
    'Chipre': 'Cyprus',
    'República Checa': 'Czech Republic',
    'Dinamarca': 'Denmark',
    'Estonia': 'Estonia',
    'Finlandia': 'Finland',
    'Francia': 'France',
    'Alemania': 'Germany',
    'Grecia': 'Greece',
    'Hungría': 'Hungary',
    'Islandia': 'Iceland',
    'Irlanda': 'Ireland',
    'Italia': 'Italy',
    'Japón': 'Japan',
    'Letonia': 'Latvia',
    'Liechtenstein': 'Liechtenstein',
    'Lituania': 'Lithuania',
    'Luxemburgo': 'Luxembourg',
    'Malta': 'Malta',
    'Países Bajos': 'Netherlands',
    'Holanda': 'Netherlands',
    'Noruega': 'Norway',
    'Polonia': 'Poland',
    'Portugal': 'Portugal',
    'Rumanía': 'Romania',
    'Singapur': 'Singapore',
    'Eslovaquia': 'Slovakia',
    'Eslovenia': 'Slovenia',
    'España': 'Spain',
    'Suecia': 'Sweden',
    'Suiza': 'Switzerland',
    'Reino Unido': 'United Kingdom'
  };

  let shippingData = [];

  // 1) Cargamos la tabla de envíos
  GM_xmlhttpRequest({
    method: 'GET',
    url: JSON_URL,
    onload(res) {
      try {
        shippingData = JSON.parse(res.responseText);
        console.log(`📦 ShippingCosts.json cargado: ${shippingData.length} entradas`);
        // 2 llamadas espaciadas para darte tiempo a que cargue todo
        setTimeout(procesarFilas, 1000);
        setTimeout(procesarFilas, 2500);
      } catch (e) {
        console.error('❌ Error parseando ShippingCosts.json', e);
      }
    },
    onerror(err) {
      console.error('❌ Error cargando ShippingCosts.json', err);
    }
  });

  // Recorre todas las filas de oferta de la página
  function procesarFilas() {
    const rows = document.querySelectorAll('.article-row');
    if (!rows.length) return;
    console.log(`✅ MKM Injector v1.6 — procesando ${rows.length} filas`);
    rows.forEach(row => {
      // evitamos re-procesar
      if (row.querySelector('.tm-shipping-badge')) return;
      procesarRow(row);
    });
  }

  // Para cada oferta: extrae origen, extrae precio, filtra JSON y añade badge
  function procesarRow(row) {
    // a) País de origen
    const loc = row.querySelector('[aria-label^="Ubicación del artículo:"]');
    if (!loc) return;
    const fromEs = loc.getAttribute('aria-label').split(':')[1].trim();
    const from = countryMap[fromEs] || fromEs;

    // b) Lugar donde vamos a inyectar: buscamo el contenedor .d-flex.flex-column
    const priceWrapper = row.querySelector('.price-container .d-flex.flex-column')
                      || row.querySelector('.mobile-offer-container .d-flex.flex-column');
    if (!priceWrapper) return;

    // c) Precio del artículo
    const spanPrecio = priceWrapper.querySelector('span.color-primary');
    if (!spanPrecio) return;
    const raw = spanPrecio.textContent;
    const precioNum = parseFloat(raw.replace(/\s|€/g,'').replace(',','.'));
    if (isNaN(precioNum)) return;

    // d) Filtramos tu JSON
    const candidatos = shippingData
      .filter(o => o.from === from && o.to === DEST)
      .filter(o => parseInt(o.maxWeight_g,10) >= WEIGHT)
      .filter(o => {
        const mv = parseFloat(o.maxValue.replace(/\s|€/g,'').replace(',','.'));
        return precioNum <= mv;
      })
      .map(o => ({
        ...o,
        shipPriceNum: parseFloat(o.price.replace(/\s|€/g,'').replace(',','.'))
      }));
    if (!candidatos.length) {
      console.log(`⚠️ Sin envío para ${fromEs}→${DEST}, precio ${precioNum}`);
      return;
    }

    // e) Elegimos el más barato
    const best = candidatos.reduce((a,b) => a.shipPriceNum < b.shipPriceNum ? a : b);
    const texto = `+ Envío: ${best.shipPriceNum.toFixed(2)} €`;

    // f) Insertamos la badge
    const badge = document.createElement('div');
    badge.className = 'tm-shipping-badge';
    badge.textContent = texto;
    badge.style.fontSize   = '0.9em';
    badge.style.marginTop  = '4px';
    badge.style.textAlign  = 'right';
    priceWrapper.appendChild(badge);
  }

})();
