// ==UserScript==
// @name         MKM Helper + Dual Want Export
// @namespace    https://gist.github.com/n21lv/ca7dbefd5955afc7205049ad950aec96
// @updateUrl    https://gist.github.com/n21lv/ca7dbefd5955afc7205049ad950aec96/raw/mkm_helper.user.js
// @downloadUrl  https://gist.github.com/n21lv/ca7dbefd5955afc7205049ad950aec96/raw/mkm_helper.user.js
// @version      1.2.0
// @description  Various useful UI modifications for Cardmarket (Magic & FaB), plus two Want List export buttons (simple & with edition).
// @author       n21lv + tú
// @match        https://www.cardmarket.com/*/Magic/Products/*/*
// @match        https://www.cardmarket.com/*/FleshAndBlood/Products/*/*
// @match        https://www.cardmarket.com/*/Magic/Cards/*
// @match        https://www.cardmarket.com/*/FleshAndBlood/Cards/*
// @match        https://www.cardmarket.com/*/Magic/Wants/*
// @match        https://www.cardmarket.com/*/FleshAndBlood/Wants/*
// @match        https://www.cardmarket.com/*/Magic/Orders/*
// @match        https://www.cardmarket.com/*/FleshAndBlood/Orders/*
// @match        https://www.cardmarket.com/*/Magic/ShoppingCart
// @match        https://www.cardmarket.com/*/FleshAndBlood/ShoppingCart
// @match        https://www.cardmarket.com/*/Magic/Users/*/Offers/Singles*
// @match        https://www.cardmarket.com/*/FleshAndBlood/Users/*/Offers/Singles*
// @match        https://www.cardmarket.com/*/Magic/Orders/Search/Results*
// @match        https://www.cardmarket.com/*/FleshAndBlood/Orders/Search/Results*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=cardmarket.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /**
     * ============== CONSTANTS ==============
     */
    const SEARCH_PERIOD = 59; // days
    const HREF = window.location.href;
    const game = window.location.pathname.split('/')[2].toLowerCase();
    const cardNameRegexClean = /^([^(]*).*/;
    const fabCardNameRegex = /^([^(\n]*)\s?(\((red|yellow|blue)\))?/i;

    /**
     * ============== UTILITIES ==============
     */
    window.writeToClipboard = function (text, callback) {
        navigator.clipboard.writeText(text).then(callback);
    };

    /**
     * ============== ORIGINAL FEATURES ==============
     */
    // (A) Hide/Show Restricted Listings
    function processShowHideRestrictedClick(forceHide) {
        const btn = _j$('#toggleHideShowRestricted');
        const props = {
            hide: { css: { 'background-color': '#a5afc4', 'text-shadow': '1px 1px #222' }, title: 'Show Restricted' },
            show: { css: { 'background-color': '#012169', 'text-shadow': 'none' }, title: 'Hide Restricted' }
        };
        const articles = _j$('div.article-row:has(a.btn-grey)');
        const shouldHide = forceHide ?? window.hideRestricted;
        const action = shouldHide ? 'hide' : 'show';
        articles[action]();
        btn.css(props[action].css).html(props[action].title);
        window.hideRestricted = !shouldHide;
    }

    function processHideNewRestricted() {
        if (isLoggedIn && window.hideRestricted === false) {
            const arts = _j$('div.article-row:has(a.btn-grey)');
            if (arts.length) arts.hide();
        }
    }

    // (B) Search Icons
    function processAddSearchIcon() {
        const iconSize = isProductsSinglesPage ? ' small' : '';
        const PAST = 200;
        const sel = isWantsPage || isCartPage
            ? 'td.name'
            : isOffersSinglesPage
                ? 'div.col-seller:gt(0)'
                : '.page-title-container h1:first-child';

        _j$(sel).each(function () {
            const raw = isProductsSinglesPage
                ? _j$(this).contents().filter(n => n.nodeType === Node.TEXT_NODE).text()
                : _j$(this).text();
            const rx = (game === 'fleshandblood') ? fabCardNameRegex : cardNameRegexClean;
            const mN = (game === 'magic') ? 1 : 0;
            let clean = rx.exec(raw)[mN].trim();
            if (game === 'fleshandblood') clean = clean.replace(/[()]*/g, '').trim();
            if (!_j$(this).data('hasSearchIcon')) {
                const now = new Date();
                const maxD = now.toLocaleDateString('lt-LT');
                const minD = new Date(now.setDate(now.getDate() - SEARCH_PERIOD)).toLocaleDateString('lt-LT');
                const params = new URLSearchParams({ productName: clean, shipmentStatus: PAST, minDate: minD, maxDate: maxD }).toString();
                const html =
                    `<a href="/Orders/Search/Results?userType=buyer&${params}" target="_blank" title="Search in my recent shipments" style="text-decoration:none;">
                        <span class="fonticon-search mr-1${iconSize}" style="padding-right:4px;"></span>
                     </a>`;
                _j$(this).prepend(html).data('hasSearchIcon', true);
            }
        });
    }

    // (C) Search Pagination
    function navigateSearchResults(direction) {
        const p = new URLSearchParams(window.location.search);
        const orig = direction === 'back' ? p.get('minDate') : p.get('maxDate');
        const diff = direction === 'back' ? -SEARCH_PERIOD : SEARCH_PERIOD;
        const from = new Date(orig);
        let a = new Date(from).setDate(from.getDate() + diff);
        let b = new Date(from);
        if (direction !== 'back') [a, b] = [b, a];
        p.set('minDate', new Date(a).toLocaleDateString('lt-LT'));
        p.set('maxDate', new Date(b).toLocaleDateString('lt-LT'));
        window.location.search = p.toString();
    }

    // (D) Dynamic Node Processing
    function processNewNodes() {
        if (!refreshSearchIcons && !refreshRestricted) return;
        const key = refreshSearchIcons ? 'icons' : 'restricted';
        const cfg = {
            restricted: { handler: processHideNewRestricted, selector: 'section#table div.table-body' },
            icons: { handler: processAddSearchIcon, selector: isOffersSinglesPage ? 'div#UserOffersTable div.table-body' : isWantsPage ? '#WantsListTable tbody' : 'table[id^=ArticleTable] tbody' }
        };
        const node = document.querySelector(cfg[key].selector);
        if (!node) return;
        new MutationObserver(records => {
            records.forEach(r => { if (r.type === 'childList') cfg[key].handler(); });
        }).observe(node, { childList: true });
    }

    // (E) JSON2CSV / export helpers
    window.convertToCSV = function (arrObj) {
        const arr = (typeof arrObj !== 'object') ? JSON.parse(arrObj) : arrObj;
        return arr.map(r => Object.values(r).join(',')).join('\r\n') + '\r\n';
    };
    window.exportCSVFile = function (headers, items, title) {
        const a = Array.from(items);
        if (headers) a.unshift(headers);
        const csv = window.convertToCSV(a);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        if (navigator.msSaveBlob) navigator.msSaveBlob(blob, title + '.csv');
        else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = title + '.csv';
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    window.exportToText = function (arrObj) {
        const arr = (typeof arrObj !== 'object') ? JSON.parse(arrObj) : arrObj;
        let s = '';
        arr.forEach(o => s += o.Count + ' ' + o.Name.replace(/"*/g, '') + '\r\n');
        window.writeToClipboard(s, () => {
            const tip = document.getElementById('custom-tooltip');
            if (tip) { tip.classList.add('visible'); setTimeout(() => tip.classList.remove('visible'), 2000); }
        });
    };

    /**
     * ============== PAGE & FLAG DETECTION ==============
     */
    var _j$ = window.jQuery;
    var isProductsOrCardsPage = HREF.includes('/Products') || HREF.includes('/Cards');
    var isWantsPage           = HREF.includes('/Wants');
    var isCartPage            = HREF.includes('/ShoppingCart');
    var isOffersSinglesPage   = HREF.includes('Offers/Singles');
    var isProductsSinglesPage = HREF.includes('Products/Singles') || HREF.includes('/Cards');
    var isOrdersPage          = HREF.includes('/Orders') && !HREF.includes('/Search/Results');
    var isSearchResultsPage   = HREF.includes('/Search/Results');
    var isLoggedIn            = !_j$('#login-signup').length;
    var refreshSearchIcons    = isWantsPage || isCartPage || isOffersSinglesPage;
    var refreshRestricted     = isProductsOrCardsPage;

    // Tooltip style
    const ts = document.createElement('style');
    ts.textContent = `
      #custom-tooltip {
        position:absolute; display:inline-block; margin-left:8px;
        padding:4px 8px; background:black; color:white;
        border-radius:4px; visibility:hidden; opacity:0;
        transition:opacity .3s; font-size:.8em;
      }
      #custom-tooltip.visible { visibility:visible; opacity:1; }
    `;
    document.head.appendChild(ts);

    /**
     * ============== ORIGINAL IIFEs ==============
     */
    // (1) Hide Restricted toggle
    (function(){
        if (!isProductsOrCardsPage) return;
        const btn = document.createElement('button');
        btn.id = 'toggleHideShowRestricted';
        btn.textContent = 'Hide Restricted';
        Object.assign(btn.style, {
            position:'fixed',bottom:'3rem',right:'1rem',
            width:'110px',height:'32px',zIndex:'10000',
            backgroundColor:'#012169',color:'white',
            boxShadow:'0 4px 8px rgba(0,0,0,0.2)',border:'none',
            borderRadius:'4px',padding:'7px 12px',fontSize:'.8em',cursor:'pointer'
        });
        document.body.appendChild(btn);
        _j$('#toggleHideShowRestricted').on('click',()=>processShowHideRestrictedClick());
        if(isLoggedIn){ window.hideRestricted=true; _j$('#toggleHideShowRestricted').trigger('click'); }
    })();

    // (2) Search pagination
    window.searchBack = ()=>navigateSearchResults('back');
    window.searchForward = ()=>navigateSearchResults('forward');
    (function(){
        if(!isSearchResultsPage) return;
        const sec=_j$('section');
        sec.prepend(
            `<a href="#" class="btn btn-outline-primary" onclick="searchForward()" style="float:right;" title="Forward 2 months"><span><i class="fonticon-calendar"></i><i class="fonticon-chevron-right"></i></span></a>`,
            `<a href="#" class="btn btn-outline-primary ms-2" onclick="searchBack()" style="float:right;" title="Back 2 months"><span><i class="fonticon-chevron-left"></i><i class="fonticon-calendar"></i></span></a>`
        );
        const p=new URLSearchParams(window.location.search);
        const d={from:p.get('minDate'),to:p.get('maxDate')};
        const pag=_j$('section .pagination');
        if(pag.length)pag.first().before(`<div style="display:flex;justify-content:flex-end;"><div style="margin:-11.5px 0;font-size:.8em;color:var(--bs-gray-500);">${d.from} .. ${d.to}</div></div>`);
    })();

    // (3) Search icons & dynamic loading
    if(refreshSearchIcons||isProductsSinglesPage) processAddSearchIcon();
    if(refreshSearchIcons) processNewNodes();
    const lm=document.getElementById('loadMoreButton');
    if(lm) lm.addEventListener('click',()=>processNewNodes(true));

    // ============== WANT LIST EXPORT (dual buttons) ==============
    (function(){
        if(!isWantsPage) return;
        // locate toolbar
        const toolbar = document.querySelector('div.flex-column div:last-child');
        if(!toolbar) return;
        // insert simple button if missing
        if(!document.getElementById('CopyWantsToClipboard')) {
            const simple = document.createElement('a');
            simple.id = 'CopyWantsToClipboard';
            simple.href = '#';
            simple.role = 'button';
            simple.className = 'btn copyToClipboard-linkBtn btn-outline-primary me-3 mt-2 mt-lg-0';
            simple.textContent = 'Copy to Clipboard';
            toolbar.insertBefore(simple, toolbar.firstChild);
        }
        // insert edition button if missing
        if(!document.getElementById('CopyWantsWithEdition')) {
            const edit = document.createElement('a');
            edit.id = 'CopyWantsWithEdition';
            edit.href = '#';
            edit.role = 'button';
            edit.className = 'btn copyToClipboard-linkBtn btn-outline-secondary me-3 mt-2 mt-lg-0';
            edit.textContent = 'Copy with Edition';
            toolbar.insertBefore(edit, toolbar.firstChild);
        }
        // insert tooltip span if missing
        if(!document.getElementById('custom-tooltip')) {
            const tip = document.createElement('span');
            tip.id = 'custom-tooltip';
            tip.textContent = 'Copied!';
            toolbar.insertBefore(tip, toolbar.firstChild);
        }
        // bind simple
        document.getElementById('CopyWantsToClipboard').addEventListener('click', e => {
            e.preventDefault();
            let txt = '';
            document.querySelectorAll('#WantsListTable tbody tr[role="row"]').forEach(r => {
                const q = r.querySelector('td[data-amount]').dataset.amount;
                const n = r.querySelector('td.name a:last-child').textContent.trim();
                txt += `${q} ${n}\r\n`;
            });
            writeToClipboard(txt, ()=>{
                const tip = document.getElementById('custom-tooltip');
                tip.classList.add('visible');
                setTimeout(()=>tip.classList.remove('visible'),2000);
            });
        });
        // bind edition
        document.getElementById('CopyWantsWithEdition').addEventListener('click', e => {
            e.preventDefault();
            let txt = '';
            document.querySelectorAll('#WantsListTable tbody tr[role="row"]').forEach(r => {
                const q = r.querySelector('td[data-amount]').dataset.amount;
                const n = r.querySelector('td.name a:last-child').textContent.trim();
                const sp = r.querySelector('td.expansion span.visually-hidden');
                const ed = sp ? sp.textContent.trim() : '';
                txt += `${q} ${n}${ed ? ' (' + ed + ')' : ''}\r\n`;
            });
            writeToClipboard(txt, ()=>{
                const tip = document.getElementById('custom-tooltip');
                tip.classList.add('visible');
                setTimeout(()=>tip.classList.remove('visible'),2000);
            });
        });
        // render total price
        function renderTotalPrice() {
            const sec = document.querySelector('section#WantsListTable');
            if(!sec) return;
            let sum = 0;
            document.querySelectorAll('#WantsListTable tbody tr').forEach(r => {
                const a = parseInt(r.querySelector('td[data-amount]').dataset.amount,10);
                const p = parseFloat(r.querySelector('td[data-text]').dataset.text);
                sum += a*p;
            });
            const node = document.createElement('div');
            node.style.margin='-13.5px 0 7.5px';
            node.style.fontSize='0.9em';
            node.style.color='var(--gray)';
            node.innerText = `Approx. total price (using buy prices): ${sum.toFixed(2)} €`;
            sec.insertBefore(node, sec.firstChild.nextSibling);
        }
        renderTotalPrice();
    })();

    // ============== ORDERS PAGE EXPORT ==============
    (function(){
        if(!isOrdersPage) return;
        const cond = {1:'Mint',2:'Near Mint',3:'Near Mint',4:'Good (Lightly Played)',5:'Played',6:'Heavily Played',7:'Poor'};
        const lang = {1:'English',2:'French',3:'German',4:'Spanish',5:'Italian',6:'Simplified Chinese',7:'Japanese',8:'Portuguese',9:'Russian',10:'Korean',11:'Traditional Chinese'};
        const arr = [];
        _j$('table[id^=ArticleTable]>tbody tr').each(function(){
            const rx = game==='magic'?cardNameRegexClean:/(.*)/;
            const nm = rx.exec(_j$(this).data('name'))[1].replace('Æ','Ae').replace('æ','ae').trim();
            arr.push({
                Count:_j$(this).data('amount'),
                Name:`"${nm}"`,
                Edition:`"${_j$(this).data('expansion-name')}"`,
                'Card Number':_j$(this).data('number'),
                Condition:cond[_j$(this).data('condition')],
                Language:lang[_j$(this).data('language')],
                Foil:_j$(this).has('div.col-extras span[aria-label="Foil"]').length
            });
        });
        _j$('#collapsibleExport p.font-italic.small').text('Click here to export your articles to a CSV document or copy them to clipboard.');
        _j$('#collapsibleExport').append(`
          <input id="exportToText" type="submit" value="Copy to Clipboard" class="btn my-2 btn-block btn-sm btn-outline-primary">
          <span id="custom-tooltip">Copied!</span>
        `);
        if(game==='magic'){
            _j$('#collapsibleExport').append(`<input id="exportToDeckbox" type="submit" value="Export (Deckbox.org)" class="btn my-2 btn-block btn-sm btn-outline-primary">`);
            _j$('#exportToDeckbox').on('click',function(){
                const h=Object.keys(arr[0]);
                const oid=_j$('.page-title-container h1').text().replace(/[^0-9]/g,'');
                window.exportCSVFile(h,arr,`MKM Order ${oid}`,true);
            });
        }
        _j$('#exportToText').on('click',()=>window.exportToText(arr));
    })();

})();
