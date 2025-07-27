// ==UserScript==
// @name         MKM Shipping Widget Scraper + Download
// @namespace    https://your.homepage/
// @version      1.0
// @description  Añade botón para scrapear y descargar ShippingCosts.json desde la página de ShippingCosts de Cardmarket
// @match        https://help.cardmarket.com/en/ShippingCosts*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- UTIL: espera hasta que aparezca un selector y retórnalo ---
    function waitForSelector(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const timer = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(timer);
                    resolve(el);
                } else if (Date.now() - start > timeout) {
                    clearInterval(timer);
                    reject(new Error('Timeout waiting for selector ' + selector));
                }
            }, 200);
        });
    }

    // --- UTIL: espera hasta que el widget deje de mostrar loader y tenga filas, o timeout ---
    async function waitForData() {
        const MAX = 10000;
        const start = Date.now();
        while (Date.now() - start < MAX) {
            const rows = document.querySelectorAll('.u-shipping-widget__data tbody tr');
            const loader = document.querySelector('.u-shipping-widget__loader');
            if ((!loader || loader.style.display === 'none') && rows.length > 0) {
                return rows;
            }
            await new Promise(r => setTimeout(r, 200));
        }
        console.warn('⚠️ Tiempo excedido esperando datos del widget');
        return [];
    }

    // --- función que parsea las filas en objetos JSON ---
    function parseRows(rows) {
        return Array.from(rows).map(tr => {
            const cells = tr.querySelectorAll('td');
            return {
                from:    document.querySelector('.u-shipping-widget__from .u-select__inner input').value,
                to:      document.querySelector('.u-shipping-widget__to .u-select__inner input').value,
                method:  cells[0].textContent.trim(),
                tracked: cells[1].textContent.trim(),
                maxValue:    cells[2].textContent.trim(),
                maxWeight_g: cells[3].textContent.trim(),
                stampPrice:  cells[4].textContent.trim(),
                price:       cells[5].textContent.trim(),
                avgDays:     cells[6].textContent.trim()
            };
        });
    }

    // --- disparar un evento click sobre una opción de <ul> según su índice ---
    function selectOption(selectEl, value) {
        // abrir
        selectEl.querySelector('.u-select__inner').click();
        const option = Array.from(selectEl.querySelectorAll('li')).find(li => li.getAttribute('value') === String(value));
        if (option) option.click();
    }

    // --- recopila datos iterando orígenes 1..n, destino fijo a España (value=10) ---
    async function fetchAll() {
        const fromSelect = document.querySelector('.u-shipping-widget__from .u-select');
        const toSelect   = document.querySelector('.u-shipping-widget__to .u-select');

        // valor "10" corresponde a Spain
        selectOption(toSelect, 10);
        await waitForData(); // espera la primera carga

        const out = [];
        // recorremos todos los valores excepto 0 (el “–”)
        const fromOptions = Array.from(fromSelect.querySelectorAll('li'))
                                 .map(li => li.getAttribute('value'))
                                 .filter(val => val !== '0');

        for (const val of fromOptions) {
            selectOption(fromSelect, val);
            await waitForData();
            const rows = document.querySelectorAll('.u-shipping-widget__data tbody tr');
            out.push(...parseRows(rows));
        }
        return out;
    }

    // --- fuerza la descarga del JSON en ~/Downloads/ShippingCosts.json ---
    function downloadJSON(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'ShippingCosts.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- creamos e inyectamos el botón “Fetch” ---
    const btn = document.createElement('button');
    btn.textContent = 'Fetch';
    Object.assign(btn.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 9999,
        padding: '8px 12px',
        background: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    });
    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Fetching…';
        try {
            const data = await fetchAll();
            console.log('⏬ Shipping data:', data);
            downloadJSON(data);
            btn.textContent = 'Done!';
        } catch (e) {
            console.error(e);
            btn.textContent = 'Error';
        }
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = 'Fetch';
        }, 3000);
    });
    document.body.appendChild(btn);

    // --- listo ---
    console.log('🛠️ MKM Shipping Widget Scraper loaded');
})();
