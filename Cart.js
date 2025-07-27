// ==UserScript==
// @name         MKM Copy Cart with Full Cost Allocation
// @namespace    https://gist.github.com/tuusuario/mkm-copy-cart-full-cost
// @version      1.0.3
// @description  Copia todos los artículos del carrito con precio final incluyendo gastos de envío y servicio TRUST, mostrando vendedor en columna separada.
// @match        https://www.cardmarket.com/*/Magic/ShoppingCart*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  /**
   * Construye líneas "cantidad\tnombre\tprecio_final\tvendedor",
   * donde precio_final = precio base + parte proporcional de
   * (envío + servicio TRUST).
   */
  function buildCartLines() {
    const lines = [];
    document.querySelectorAll('section.shipment-block').forEach(section => {
      const sellerLink  = section.querySelector('span.seller-name a');
      const seller      = sellerLink ? sellerLink.textContent.trim() : 'Desconocido';
      const shipCost    = parseFloat(section.dataset.shipCost)    || 0;
      const serviceCost = parseFloat(section.dataset.serviceCost) || 0;
      const totalValue  = parseFloat(section.dataset.itemValue)   || 0;
      const extraTotal  = shipCost + serviceCost;

      section.querySelectorAll('tr[data-amount][data-price][data-name]').forEach(tr => {
        const qty   = parseInt(tr.dataset.amount, 10) || 0;
        const price = parseFloat(tr.dataset.price)   || 0;
        const name  = tr.dataset.name.trim();

        // parte proporcional de (envío + servicio)
        let share = 0;
        if (totalValue > 0) {
          share = (qty * price) / totalValue * extraTotal;
        }
        const perUnitShare = qty > 0 ? share / qty : 0;
        const finalPrice   = price + perUnitShare;

        lines.push(`${qty}\t${name}\t${finalPrice.toFixed(2)}\t${seller}`);
      });
    });
    return lines.join('\r\n');
  }

  /**
   * Copia las líneas al portapapeles y da feedback en el botón.
   */
  function copyCart() {
    const text = buildCartLines();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '¡Copiado!';
      setTimeout(() => btn.textContent = orig, 2000);
    });
  }

  // Crear e insertar botón arriba de la primera sección de envío
  const btn = document.createElement('button');
  btn.textContent = 'Copiar carrito detallado';
  btn.className   = 'btn btn-sm btn-outline-primary';
  btn.style.margin = '8px';
  btn.addEventListener('click', copyCart);

  function insertButton() {
    const firstSection = document.querySelector('section.shipment-block');
    if (firstSection && firstSection.parentNode) {
      firstSection.parentNode.insertBefore(btn, firstSection);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertButton);
  } else {
    insertButton();
  }
})();
