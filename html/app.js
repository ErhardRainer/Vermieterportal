// Immobilien-Portal JavaScript (JSON/PHP-basiert)
// Globaler Chart-Kontext
let bkChart = null;
let APP_DATA = null; // komplette Immo-Daten vom Server

document.addEventListener('DOMContentLoaded', function () {
  // ----- Smoke-Tests (einfach) -----
  function assert(cond, msg) {
    if (!cond) { console.error('TEST FAIL:', msg); } else { console.log('TEST OK:', msg); }
  }

  // ----- Daten laden (versuche API, fallback auf lokale JSON-Datei) -----
  async function loadData(immoId = '1001') {
    const apiUrl = `./api/getData.php?immoId=${encodeURIComponent(immoId)}`;
    try {
      console.log('Versuche API:', apiUrl);
      const res = await fetch(apiUrl, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          APP_DATA = json;
          console.log('Daten geladen von API');
          return APP_DATA;
        } catch (e) {
          console.warn('API-Antwort ist kein JSON, fallback auf lokale Datei', e);
        }
      } else {
        console.warn('API antwortete mit Status', res.status, 'fallback auf lokale Datei');
      }
    } catch (e) {
      console.warn('Fehler beim Aufrufen der API, fallback auf lokale Datei', e);
    }

    // Fallback: lokale JSON-Datei
    const localUrl = `./data/immo_${encodeURIComponent(immoId)}.json`;
    try {
      console.log('Versuche lokale Datei:', localUrl);
      const r2 = await fetch(localUrl, { cache: 'no-store' });
      if (!r2.ok) throw new Error(`Local ${r2.status}`);
      const json2 = await r2.json();
      APP_DATA = json2;
      console.log('Daten geladen von lokaler JSON-Datei');
      return APP_DATA;
    } catch (e) {
      console.error('Konnte Daten weder per API noch lokal laden:', e);
      throw e;
    }
  }

  // ----- Handwerker-Daten (aus APP_DATA) -----
  let tradesmen = [];

  // getIconSvg is provided by icon-utils.js (loaded before app.js)
  // Provide a local wrapper to avoid runtime errors if the module isn't loaded
  function getIconSvg(iconName) {
    try {
      if (window.getIconSvg) return window.getIconSvg(iconName);
    } catch (e) { /* ignore */ }
    return '';
  }

  function displayTradesmanDetails(tradesman) {
    const detailsContainer = document.getElementById('tradesman-details');
    if (!detailsContainer) return; // defensive
    if (!tradesman) {
      detailsContainer.innerHTML = '<p class="text-gray-500">Wählen Sie einen Dienstleister aus der Liste links, um seine Kontaktdaten anzuzeigen.</p>';
      return;
    }
    const phoneHtml = tradesman.phone ? `<div class="flex items-center text-gray-700">${getIconSvg('phone')}<a href="tel:${(tradesman.phone || '').replace(/\s/g, '')}" class="hover:underline">${tradesman.phone}</a></div>` : '';
    const mailHtml = tradesman.email ? `<div class="flex items-center text-gray-700">${getIconSvg('mail')}<a href="mailto:${tradesman.email}" class="hover:underline">${tradesman.email}</a></div>` : '';
    const websiteHtml = tradesman.website ? `<div class="flex items-center text-gray-700">${getIconSvg('globe')}<a href="${tradesman.website}" target="_blank" rel="noopener" class="ml-3 text-blue-600 hover:underline">${tradesman.website}</a></div>` : '';
    const commentHtml = tradesman.comment ? `<div class="mt-3 p-3 bg-gray-50 rounded border border-gray-200 text-gray-700">${escapeHtml(tradesman.comment)}</div>` : '';

    // mailto button: open mail client with prefilled to and subject (optional)
    const mailtoBtn = tradesman.email ? `<a href="mailto:${tradesman.email}?subject=${encodeURIComponent('Anfrage via Vermieterportal')}` + `" class="mt-6 block w-full text-center inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Anfrage per E-Mail senden</a>` : '';

    detailsContainer.innerHTML = `
      <h3 class="text-xl font-bold text-gray-900 mb-2">${escapeHtml(tradesman.name)}</h3>
      <p class="text-lg text-blue-600 mb-4">${escapeHtml(tradesman.specialty || '')}</p>
      <div class="space-y-3">
        ${phoneHtml}
        ${mailHtml}
        ${websiteHtml}
        <div class="flex items-center text-gray-700">${getIconSvg('map-pin')}<span class="ml-3">Region Berlin/Brandenburg</span></div>
      </div>
      ${commentHtml}
      ${mailtoBtn}
    `;
  }

  // simple HTML escape for comments (avoid XSS from JSON content)
  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function initializeTradesmenList() {
    const listContainer = document.getElementById('tradesmen-list');
    if (!listContainer) return;
    // Rebuild list each time to reflect changes
    listContainer.innerHTML = '';
    if (!tradesmen || tradesmen.length === 0) return;
    tradesmen.forEach((t) => {
      const listItem = document.createElement('li');
      listItem.classList.add('tradesman-item', 'p-3', 'rounded-lg', 'cursor-pointer', 'transition-all', 'duration-150', 'flex', 'items-center', 'justify-between');
      listItem.dataset.id = t.id;
      listItem.innerHTML = `
        <div class="flex items-center">
          ${getIconSvg(t.icon)}
          <div><p class="font-medium text-gray-900">${t.name}</p><p class="text-sm text-gray-500">${t.specialty}</p></div>
        </div>
        <div class="ml-4 flex items-center gap-2">
          <button class="tradesman-edit text-sm text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50" data-id="${t.id}">Bearbeiten</button>
        </div>`;
      listContainer.appendChild(listItem);
    });

    // Click handling: select item or edit
    listContainer.addEventListener('click', (event) => {
      const editBtn = event.target.closest('.tradesman-edit');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const selected = tradesmen.find((x) => x.id === id);
        openTradesmanModal('edit', selected);
        return;
      }
      const listItem = event.target.closest('li.tradesman-item');
      if (!listItem) return;
      Array.from(listContainer.children).forEach((item) => item.classList.remove('tradesman-active'));
      listItem.classList.add('tradesman-active');
      const selected = tradesmen.find((t) => t.id === listItem.dataset.id);
      displayTradesmanDetails(selected);
    });
  }

  // ----- Bildergalerie -----
  let images = [];
  let currentImageIndex = 0;
  const galleryContainer = document.getElementById('image-gallery');
  const prevButton = document.getElementById('prev-image');
  const nextButton = document.getElementById('next-image');
  const imageCounter = document.getElementById('image-counter');

  function buildGallery() {
    if (!galleryContainer) return;
    galleryContainer.innerHTML = '';
    if (!images || images.length === 0) return;
    images.forEach((img, index) => {
      const imgElement = document.createElement('img');
      imgElement.src = img.src;
      imgElement.alt = img.alt || '';
      imgElement.loading = 'lazy';
      imgElement.className = 'absolute inset-0 w-full h-full object-cover';
      if (index !== 0) imgElement.classList.add('hidden');
      galleryContainer.appendChild(imgElement);
    });
    currentImageIndex = 0;
    updateGallery();
  }

  function updateGallery() {
    if (!galleryContainer) return;
    Array.from(galleryContainer.children).forEach((img, index) => {
      img.classList.toggle('hidden', index !== currentImageIndex);
    });
    if (imageCounter) {
      if (images && images.length > 0) {
        imageCounter.textContent = `${currentImageIndex + 1} / ${images.length}`;
        imageCounter.classList.remove('hidden');
      } else {
        imageCounter.textContent = '';
        imageCounter.classList.add('hidden');
      }
    }
  }

  if (prevButton) prevButton.addEventListener('click', () => {
    if (!images || images.length === 0) return;
    currentImageIndex = currentImageIndex > 0 ? currentImageIndex - 1 : images.length - 1;
    updateGallery();
  });
  if (nextButton) nextButton.addEventListener('click', () => {
    if (!images || images.length === 0) return;
    currentImageIndex = currentImageIndex < images.length - 1 ? currentImageIndex + 1 : 0;
    updateGallery();
  });

  // ----- Tab-System -----
  const tabButtonsContainer = document.getElementById('tab-buttons');
  const tabContentContainer = document.getElementById('tab-content');
  if (tabButtonsContainer && tabContentContainer) {
    tabButtonsContainer.addEventListener('click', (event) => {
      const clickedButton = event.target.closest('button.tab-button');
      if (!clickedButton) return;
      const tabToActivate = clickedButton.dataset.tab;
      Array.from(tabButtonsContainer.children).forEach((button) => {
        // mark inactive
        button.classList.remove('tab-active');
        button.classList.add('tab-inactive');
        // ensure border is transparent for inactive tabs
        button.classList.add('border-transparent');
        button.setAttribute('aria-selected', 'false');
      });
      // activate clicked
      clickedButton.classList.add('tab-active');
      clickedButton.classList.remove('tab-inactive');
      // remove transparent border so active rule (tab-active) can show color
      clickedButton.classList.remove('border-transparent');
      clickedButton.setAttribute('aria-selected', 'true');
      Array.from(tabContentContainer.children).forEach((pane) => pane.classList.add('hidden'));
      const contentToShow = tabContentContainer.querySelector(`[data-tab-content="${tabToActivate}"]`);
      if (contentToShow) {
        contentToShow.classList.remove('hidden');
        if (tabToActivate === 'handwerker') {
          initializeTradesmenList();
          displayTradesmanDetails(null);
        }
        if (tabToActivate === 'betriebskosten') {
          updateBetriebskosten(document.getElementById('year-select').value);
        }
        if (tabToActivate === 'maengelliste') {
          renderDefectsTable();
        }
      }
    });
  }

  // ----- Mängelliste-Logik -----
  let defects = {};

  // Räume für Filter (wird aus defects befüllt)
  function fillRoomFilter() {
    try {
      const sel = document.getElementById('room-filter');
      if (!sel) return;
      // Sammle eindeutige, nicht-leere Raum-Namen
      const rooms = Array.from(new Set(Object.values(defects).map(d => (d && d.room) ? String(d.room).trim() : '').filter(Boolean))).sort((a,b) => a.localeCompare(b));
      // Bewahre aktuelle Auswahl
      const current = sel.value;
      sel.innerHTML = '';
      const optAll = document.createElement('option'); optAll.value = ''; optAll.textContent = 'Alle Räume';
      sel.appendChild(optAll);
      rooms.forEach(r => {
        const o = document.createElement('option'); o.value = r; o.textContent = r; sel.appendChild(o);
      });
      // Versuche, vorherige Auswahl wiederherzustellen falls noch vorhanden
      if (current) {
        const match = Array.from(sel.options).find(o => o.value === current);
        if (match) sel.value = current;
      }
    } catch (e) { console.warn('fillRoomFilter failed', e); }
  }

  function renderDefectsTable(filterRoom) {
    const tbody = document.getElementById('defects-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let list = Object.values(defects);
    // Wenn kein Argument übergeben wurde, benutze UI-Auswahl falls vorhanden
    if (typeof filterRoom === 'undefined') {
      const sel = document.getElementById('room-filter');
      filterRoom = sel ? sel.value : '';
    }
    if (filterRoom) {
      list = list.filter(d => (d && d.room) ? String(d.room).trim() === String(filterRoom).trim() : false);
    }

    if (list.length === 0) {
      const trEmpty = document.createElement('tr');
      trEmpty.innerHTML = `<td class="px-4 py-6 text-gray-500" colspan="3">Keine Mängel gefunden.</td>`;
      tbody.appendChild(trEmpty);
      return;
    }

    list.forEach((d) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-3 text-gray-800">${d.title}</td>
        <td class="px-4 py-3 text-gray-600">${d.room}</td>
        <td class="px-4 py-3">
          <button class="defect-view-btn inline-flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-700" data-defect-id="${d.id}" aria-label="Bilder anzeigen">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-images mr-2"><path d="M3 7v10a2 2 0 0 0 2 2h12"/><path d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/><path d="m21 15-5-5L5 21"/><path d="M5 16l3-3"/></svg>
            Bilder
          </button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  let currentDefectId = null;
  let currentDefectImageIndex = 0;

  const defectViewer = document.getElementById('defect-viewer');
  const defectImgEl = document.getElementById('defect-viewer-image');
  const defectDescEl = document.getElementById('defect-viewer-description');
  const defectTitleEl = document.getElementById('defect-viewer-title');
  const defectCounterEl = document.getElementById('defect-counter');
  const defectPrevBtn = document.getElementById('defect-prev');
  const defectNextBtn = document.getElementById('defect-next');
  const defectCloseBtn = document.getElementById('defect-viewer-close');
  const defectCloseBtn2 = document.getElementById('defect-viewer-close-2');

  function updateDefectViewerImage() {
    if (!currentDefectId || !defectImgEl) return;
    const d = defects[currentDefectId];
    if (!d) return;
    const total = d.images.length;
    currentDefectImageIndex = (currentDefectImageIndex + total) % total;
    const src = d.images[currentDefectImageIndex];
    defectImgEl.src = src;
    defectImgEl.alt = `${d.title} – Bild ${currentDefectImageIndex + 1}/${total}`;
    if (defectCounterEl) defectCounterEl.textContent = `${currentDefectImageIndex + 1} / ${total}`;
  }

  function openDefectViewer(defectId) {
    const d = defects[defectId];
    if (!d || !defectViewer) return;
    currentDefectId = defectId;
    currentDefectImageIndex = 0;
    if (defectTitleEl) defectTitleEl.textContent = `Mangel – ${d.title} (${d.room})`;
    if (defectDescEl) defectDescEl.textContent = d.description;
    updateDefectViewerImage();
    defectViewer.classList.remove('hidden');
    defectViewer.classList.add('flex');
  }

  function closeDefectViewer() {
    if (!defectViewer) return;
    defectViewer.classList.add('hidden');
    defectViewer.classList.remove('flex');
    currentDefectId = null;
    currentDefectImageIndex = 0;
  }

  if (defectPrevBtn) defectPrevBtn.addEventListener('click', () => {
    if (!currentDefectId) return;
    currentDefectImageIndex -= 1;
    updateDefectViewerImage();
  });
  if (defectNextBtn) defectNextBtn.addEventListener('click', () => {
    if (!currentDefectId) return;
    currentDefectImageIndex += 1;
    updateDefectViewerImage();
  });
  if (defectCloseBtn) defectCloseBtn.addEventListener('click', closeDefectViewer);
  if (defectCloseBtn2) defectCloseBtn2.addEventListener('click', closeDefectViewer);
  if (defectViewer) defectViewer.addEventListener('click', (e) => {
    // Klick auf Overlay schließt, nicht aber auf den Content-Container
    if (e.target === defectViewer) closeDefectViewer();
  });
  document.addEventListener('keydown', (e) => {
    if (defectViewer && !defectViewer.classList.contains('hidden')) {
      if (e.key === 'Escape') closeDefectViewer();
      if (e.key === 'ArrowLeft') { currentDefectImageIndex -= 1; updateDefectViewerImage(); }
      if (e.key === 'ArrowRight') { currentDefectImageIndex += 1; updateDefectViewerImage(); }
    }
  });

  // Delegierter Klick-Handler für die Bild-Buttons in der Tabelle
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.defect-view-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-defect-id');
    if (id) openDefectViewer(id);
  });

  // ----- Betriebskosten-Logik -----
  let betriebskostenData = {};

  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  function createWaterfallData(data) {
    const monthlyArr = Array.isArray(data.monthlyPrepayments) && data.monthlyPrepayments.length === 12
      ? data.monthlyPrepayments.map(Number)
      : new Array(12).fill(Number(data.monthlyPrepayment || 0));
    const totalPrepayment = monthlyArr.reduce((s, n) => s + n, 0);
    const actualTotalCost = Number(data.actualTotalCost || 0);
    const settlement = totalPrepayment - actualTotalCost; // >0 Guthaben, <0 Nachzahlung

    // Basis: kumulative Summe der Vormonate
    const baseData = [];
    let cum = 0;
    for (let i = 0; i < 12; i++) {
      baseData.push(cum);
      cum += monthlyArr[i];
    }
    baseData.push(0); // Vorauszahlungen (Gesamt) als separater Balken bei 0
  // Differenz (Guthaben/Nachzahlung):
  // - Nachzahlung (delta >= 0): Start auf Höhe der Vorauszahlungen
  // - Guthaben (delta < 0): Start unterhalb der Vorauszahlungen, sodass der Balken bis zur Vorauszahlungen-Höhe reicht
  //   (d. h. der Balken wird "von der Höhe der Vorauszahlungen abgezogen").
  // Platzhalter; tatsächliche Startbasis setzen wir nach Berechnung von deltaToActual unten.
  baseData.push(null);
  baseData.push(0); // Jahresgesamtkosten als eigenständiger Balken bei 0

    const visibleData = monthlyArr.slice();
    visibleData.push(totalPrepayment); // Vorauszahlungen Gesamt
    const deltaToActual = actualTotalCost - totalPrepayment; // + Nachzahlung, - Guthaben
    // Setze Basis und Höhe für den Differenzbalken abhängig vom Vorzeichen
    if (deltaToActual >= 0) {
      // Nachzahlung: Balken startet bei Vorauszahlungen und geht nach oben
      baseData[13] = totalPrepayment;
      visibleData.push(deltaToActual);
    } else {
      // Guthaben: Balken startet unterhalb der Vorauszahlungen und reicht bis zu deren Höhe
      baseData[13] = totalPrepayment + deltaToActual; // niedriger Start
      visibleData.push(-deltaToActual); // positive Höhe (Absolutwert)
    }
    visibleData.push(actualTotalCost); // Jahresgesamtkosten als Gesamtbalken

    const deltaLabel = settlement > 0 ? 'Guthaben' : (settlement < 0 ? 'Nachzahlung' : 'Ausgleich');
    const dynamicLabels = [...months, 'Vorauszahlungen', deltaLabel, 'Jahresgesamtkosten'];

  return { base: baseData, visible: visibleData, labels: dynamicLabels, totalPrepayment, actualTotalCost, settlement };
  }

  function getColors(settlement) {
    const colors = [];
    for (let i = 0; i < 12; i++) colors.push('rgb(107, 114, 128)'); // Monate
    colors.push('rgb(59, 130, 246)'); // Vorauszahlungen gesamt (blau)
    if (settlement < 0) colors.push('rgb(239, 68, 68)'); // Nachzahlung (rot)
    else if (settlement > 0) colors.push('rgb(16, 185, 129)'); // Guthaben (grün)
    else colors.push('rgb(59, 130, 246)'); // Ausgleich (blau)
    colors.push('rgb(99, 102, 241)'); // Jahresgesamtkosten (indigo)
    return colors;
  }

  function createWaterfallChart(chartData) {
    const canvas = document.getElementById('waterfallChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const colors = getColors(chartData.settlement);
    if (bkChart) bkChart.destroy();
    bkChart = new Chart(ctx, {
      type: 'bar',
      data: { labels: chartData.labels, datasets: [
        { label: 'Basis (versteckt)', data: chartData.base, backgroundColor: 'rgba(0,0,0,0)', hoverBackgroundColor: 'rgba(0,0,0,0)', stack: 'Stack 1', borderSkipped: false },
        { label: 'Abrechnungsbetrag', data: chartData.visible, backgroundColor: colors, borderColor: colors.map((c) => c.replace('rgb', 'rgba').replace(')', ', 0.5)')), borderWidth: 1, stack: 'Stack 1', borderSkipped: false }
      ]},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: (ctx) => ctx[0].label, label: (ctx) => {
            const idx = ctx.dataIndex;
            const value = ctx.parsed.y;
            if (idx === 12) {
              return `Summe Vorauszahlungen: ${Number(chartData.totalPrepayment).toFixed(2)} €`;
            }
            if (idx === 13) {
              const absValue = Math.abs(chartData.settlement);
              const prefix = chartData.settlement < 0 ? 'Nachzahlung' : (chartData.settlement > 0 ? 'Guthaben' : 'Ausgleich');
              return `${prefix}: ${absValue.toFixed(2)} €`;
            }
            if (idx === 14) {
              return `Jahresgesamtkosten: ${Number(chartData.actualTotalCost).toFixed(2)} €`;
            }
            return `Betrag: ${Number(value).toFixed(2)} €`;
          }}}
        },
        scales: {
          x: { stacked: true, title: { display: true, text: 'Monat / Ergebnis' } },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Betrag in €' }, ticks: { callback: (v) => `${v} €` } }
        }
      }
    });
  }

  function updateSummary(data, settlement) {
    const summaryCard = document.getElementById('summary-card');
    const actualTotalCostEl = document.getElementById('actual-total-cost');
    const prepaymentTotalEl = document.getElementById('prepayment-total');
    const finalSettlementEl = document.getElementById('final-settlement');
    if (!summaryCard || !actualTotalCostEl || !prepaymentTotalEl || !finalSettlementEl) return;

  actualTotalCostEl.textContent = `${Number(data.actualTotalCost).toFixed(2)} €`;
  prepaymentTotalEl.textContent = `${Number(data.totalPrepayment).toFixed(2)} €`;

    const isRefund = settlement > 0;
    let cardClasses = 'p-4 rounded-lg mb-6 shadow-md transition-all duration-300 ';
    if (isRefund) {
      cardClasses += 'bg-green-50 border-l-4 border-green-500';
      finalSettlementEl.classList.remove('text-red-600');
      finalSettlementEl.classList.add('text-green-600');
      finalSettlementEl.textContent = `Guthaben: ${Math.abs(settlement).toFixed(2)} €`;
    } else if (settlement < 0) {
      cardClasses += 'bg-red-50 border-l-4 border-red-500';
      finalSettlementEl.classList.remove('text-green-600');
      finalSettlementEl.classList.add('text-red-600');
      finalSettlementEl.textContent = `Nachzahlung: ${Math.abs(settlement).toFixed(2)} €`;
    } else {
      cardClasses += 'bg-gray-50 border-l-4 border-gray-400';
      finalSettlementEl.classList.remove('text-green-600', 'text-red-600');
      finalSettlementEl.classList.add('text-blue-600');
      finalSettlementEl.textContent = 'Ausgeglichen (0,00 €)';
    }
    summaryCard.className = cardClasses;
  }

  function updateBetriebskosten(year) {
    const data = betriebskostenData[year];
    if (!data) return;
    const { base, visible, labels, totalPrepayment, actualTotalCost, settlement } = createWaterfallData({ monthlyPrepayments: data.monthlyPrepayments, monthlyPrepayment: data.monthlyPrepayment, actualTotalCost: data.actualTotalCost });
    createWaterfallChart({ base, visible, labels, totalPrepayment, actualTotalCost, settlement });
    updateSummary({ totalPrepayment, actualTotalCost }, settlement);
    renderCostsDocuments(year);
  }

  // Dropdown-Listener
  const yearSelect = document.getElementById('year-select');
  if (yearSelect) {
    yearSelect.addEventListener('change', (ev) => updateBetriebskosten(ev.target.value));
  }

  function fillYearOptions() {
    if (!yearSelect) return;
    const years = Object.keys(betriebskostenData).sort((a,b) => b.localeCompare(a));
    yearSelect.innerHTML = '';
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      yearSelect.appendChild(opt);
    });
    if (years.length) updateBetriebskosten(years[0]);
  }

  function setHeaderAndAddress() {
    const tDesk = document.getElementById('title-desktop');
    const tMob = document.getElementById('title-mobile');
    const rDesk = document.getElementById('rent-desktop');
    const rMob = document.getElementById('rent-mobile');
    const aDesk = document.getElementById('address-text-desktop');
    const aMob = document.getElementById('address-text-mobile');
    const aLage = document.getElementById('address-text-lage');
    const mapIframe = document.getElementById('map-iframe');
    if (tDesk) tDesk.textContent = APP_DATA.title || tDesk.textContent;
    if (tMob) tMob.textContent = APP_DATA.title || tMob.textContent;
    if (rDesk) rDesk.textContent = APP_DATA.rentText || rDesk.textContent;
    if (rMob) rMob.textContent = APP_DATA.rentText || rMob.textContent;
    const address = APP_DATA?.address?.full || '';
    if (aDesk) aDesk.textContent = address;
    if (aMob) aMob.textContent = address;
    if (aLage) aLage.textContent = address;
    // Update map links
    try {
      const mapDesk = document.getElementById('map-link-desktop');
      const mapMob = document.getElementById('map-link-mobile');
      const url = address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address) : null;
      if (url && mapDesk) mapDesk.href = url;
      if (url && mapMob) mapMob.href = url;
      const embed = APP_DATA?.address?.mapEmbedUrl;
      if (mapIframe && embed) mapIframe.src = embed;
    } catch (e) { console.warn('Map update failed', e); }
  }

  function setOverview() {
    const list = document.getElementById('overview-list');
    const desc = document.getElementById('description');
    if (!list) return;
    list.innerHTML = '';

    const iconMap = {
      livingArea: 'home',
      rooms: 'bed-double',
      bathrooms: 'bath'
    };

    const ov = APP_DATA?.overview;
    let attrs = [];
    let descriptionText = '';

    if (Array.isArray(ov)) {
      ov.forEach(a => {
        if (!a) return;
        if ((a.id && a.id.toLowerCase() === 'description') || a.type === 'description') {
          descriptionText = a.value ?? a.text ?? '';
        } else {
          attrs.push(a);
        }
      });
    } else if (ov && typeof ov === 'object') {
      // Legacy support: convert known fields to attributes
      if (ov.livingArea != null) attrs.push({ id: 'livingArea', displayName: 'Wohnfläche', value: ov.livingArea });
      if (ov.rooms != null) attrs.push({ id: 'rooms', displayName: 'Zimmer', value: ov.rooms });
      if (ov.bathrooms != null) attrs.push({ id: 'bathrooms', displayName: 'Badezimmer', value: ov.bathrooms });
      if (ov.description) descriptionText = ov.description;
    }

    attrs.forEach(a => {
      const li = document.createElement('li');
      li.className = 'flex items-center';
      const icon = getIconSvg(a.icon || iconMap[a.id] || 'info');
      const span = document.createElement('span');
      span.className = 'ml-3';
      const label = a.displayName || a.id || '';
      const symbol = a.symbol || a.unit || '';
      const val = a.value != null ? a.value : '';
      span.textContent = `${label}: ${val}${symbol ? ' ' + symbol : ''}`;
      li.innerHTML = icon + span.outerHTML;
      list.appendChild(li);
    });

    if (desc) {
      desc.innerHTML = descriptionText || '';
    }
  }

  // ----- Nachrichten-Logik mit Thread-Support -----
  let replyToMessageId = null; // Track current reply context

  function buildMessageThread(messages) {
    // Organize messages into threads (parent messages with their replies)
    const messageMap = {};
    const rootMessages = [];
    
    // First pass: create map and identify root messages
    messages.forEach(m => {
      if (!m.id) {
        // Generate temporary ID for messages without one
        m.id = 'temp_' + Math.random().toString(36).substr(2, 9);
      }
      messageMap[m.id] = { ...m, replies: [] };
      if (!m.replyTo) {
        rootMessages.push(m.id);
      }
    });
    
    // Second pass: build reply chains
    messages.forEach(m => {
      if (m.replyTo && messageMap[m.replyTo]) {
        messageMap[m.replyTo].replies.push(m.id);
      }
    });
    
    return { messageMap, rootMessages };
  }

  function renderMessageItem(messageData, depth = 0) {
    const m = messageData;
    const isMieter = (m.by || '').toLowerCase() === 'mieter';
    const li = document.createElement('li');
    
    // Add left margin for nested replies
    const marginClass = depth > 0 ? `ml-${Math.min(depth * 8, 16)} border-l-2 border-gray-300 pl-4` : '';
    const bgClass = isMieter ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200';
    
    li.className = `p-3 ${bgClass} rounded-lg border ${marginClass}`;
    
    const categoryBadge = m.category ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">${m.category}</span>` : '';
    
    // Reply indicator if this is a reply
    let replyIndicator = '';
    if (m.replyTo && depth > 0) {
      replyIndicator = '<span class="inline-flex items-center text-xs text-gray-500 mr-2">↳ Antwort</span>';
    }
    
    const refBadge = m.ref ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800">Ref: ${escapeHtml(m.ref)}</span>` : '';

    li.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-500">
          ${replyIndicator}${formatDate(m.date)} • ${m.by}${categoryBadge}${refBadge}
        </div>
        <button class="reply-btn text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50" data-message-id="${m.id}" data-message-by="${m.by}">
          Antworten
        </button>
      </div>
      <div class="text-gray-800 mt-1">${m.text}</div>
    `;
    
    return li;
  }

  function renderMessages() {
    const list = document.getElementById('messages-list');
    if (!list) return;
    list.innerHTML = '';
    
    const msgs = APP_DATA?.messages || [];
    const { messageMap, rootMessages } = buildMessageThread(msgs);
    
    // Render messages recursively
    function renderThread(messageId, depth = 0) {
      const msgData = messageMap[messageId];
      if (!msgData) return;
      
      const li = renderMessageItem(msgData, depth);
      list.appendChild(li);
      
      // Render replies
      if (msgData.replies && msgData.replies.length > 0) {
        msgData.replies.forEach(replyId => {
          renderThread(replyId, depth + 1);
        });
      }
    }
    
    // Render all root messages and their threads
    rootMessages.forEach(rootId => {
      renderThread(rootId);
    });
    
    // Attach reply button handlers (use currentTarget to avoid clicks on inner elements)
    list.querySelectorAll('.reply-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget || e.target.closest('.reply-btn');
        if (!el) return;
        const msgId = el.getAttribute('data-message-id');
        const msgBy = el.getAttribute('data-message-by');
        setReplyMode(msgId, msgBy);
      });
    });
  }

  function setReplyMode(messageId, messageBy) {
    replyToMessageId = messageId;
    
    // Update form UI to show reply context
    const form = document.querySelector('#tab-content form');
    if (!form) return;
    
    // Remove existing reply indicator if any
    const existingIndicator = form.querySelector('.reply-indicator');
    if (existingIndicator) existingIndicator.remove();
    
    // Add reply indicator
    const indicator = document.createElement('div');
    indicator.className = 'reply-indicator mb-3 p-2 bg-blue-50 border border-blue-200 rounded flex items-center justify-between';
    indicator.innerHTML = `
      <span class="text-sm text-gray-700">
        <strong>Antwort auf:</strong> Nachricht von ${messageBy}
      </span>
      <button type="button" class="cancel-reply text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
        ✕ Abbrechen
      </button>
    `;
    
    const firstInput = form.querySelector('.space-y-4');
    if (firstInput) {
      firstInput.insertBefore(indicator, firstInput.firstChild);
    }
    
    // Attach cancel handler
    indicator.querySelector('.cancel-reply').addEventListener('click', cancelReplyMode);
    
    // Focus textarea
    const textarea = document.getElementById('nachricht_formular');
    if (textarea) textarea.focus();

    // Prefill reference if the original message had one
    try {
      const original = (APP_DATA?.messages || []).find(m => m.id === messageId);
      if (original && original.ref) {
        const refInput = document.getElementById('nachricht_ref');
        if (refInput && !refInput.value) {
          refInput.value = original.ref;
        }
      }
    } catch (e) { /* ignore */ }
  }

  function cancelReplyMode() {
    replyToMessageId = null;
    const indicator = document.querySelector('.reply-indicator');
    if (indicator) indicator.remove();
  }

  async function sendMessage(category, text) {
    if (!text || text.trim() === '') {
      // validation should be handled by the form; here just bail out silently
      return false;
    }
    
    const apiUrl = './api/getData.php';
    const messagePayload = {
      by: 'Mieter',
      text: text.trim(),
      category: category || 'allgemein'
    };
    
    // Add replyTo if in reply mode
    if (replyToMessageId) {
      messagePayload.replyTo = replyToMessageId;
    }
    // Optional reference field
    const refInput = document.getElementById('nachricht_ref');
    const refVal = refInput ? refInput.value.trim() : '';
    if (refVal) messagePayload.ref = refVal;
    
    const payload = {
      immoId: '1001',
      message: messagePayload
    };

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const result = await res.json();
      if (result.error) {
        throw new Error(result.message || 'Unknown error');
      }

      // Reload data and re-render messages
      await loadData('1001');
      renderMessages();
      
      // Clear reply mode
      cancelReplyMode();
      
      return true;
    } catch (e) {
      console.error('Fehler beim Senden der Nachricht:', e);
      alert('Nachricht konnte nicht gesendet werden: ' + e.message);
      return false;
    }
  }

  function initMessageForm() {
    const form = document.querySelector('#tab-content form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const categorySelect = document.getElementById('kategorie');
      const textArea = document.getElementById('nachricht_formular');
      const refInput = document.getElementById('nachricht_ref');
      const submitBtn = form.querySelector('button[type="submit"]');
      
      if (!categorySelect || !textArea) return;
      
      const category = categorySelect.value;
      const text = textArea.value;

      // client-side validation: show inline error instead of alert
      const trimmed = text.trim();
      const existingError = form.querySelector('.message-error');
      if (!trimmed) {
        if (!existingError) {
          const err = document.createElement('div');
          err.className = 'message-error mt-1 text-sm text-red-600';
          err.textContent = 'Bitte geben Sie eine Nachricht ein.';
          // insert error after textarea's parent
          const taParent = textArea.parentElement || textArea;
          taParent.appendChild(err);
        }
        textArea.focus();
        return;
      }
      if (existingError) existingError.remove();
      
      // Disable form during submission
      submitBtn.disabled = true;
      submitBtn.textContent = 'Wird gesendet...';
      
      const success = await sendMessage(category, text);
      
      if (success) {
        // Clear form
        textArea.value = '';
        categorySelect.value = 'allgemein';
        if (refInput) refInput.value = '';
        // remove any existing error
        const existingError2 = form.querySelector('.message-error');
        if (existingError2) existingError2.remove();
        
        // Show success feedback
        const feedback = document.createElement('div');
        feedback.className = 'mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700';
        feedback.textContent = '✓ Nachricht erfolgreich gesendet';
        form.appendChild(feedback);
        setTimeout(() => feedback.remove(), 3000);
      }
      
      // Re-enable form
      submitBtn.disabled = false;
      submitBtn.textContent = 'Senden';
    });
  }

  function formatDate(s) {
    try { const d = new Date(s); return d.toLocaleDateString('de-DE'); } catch { return s; }
  }

  async function init() {
    try {
      await loadData('1001');
      // Daten in lokale Variablen mappen
      tradesmen = APP_DATA.tradesmen || [];
      images = APP_DATA.images || [];
      betriebskostenData = APP_DATA.costs || {};
      defects = (APP_DATA.defects || []).reduce((acc, d) => { acc[d.id] = d; return acc; }, {});

      // UI befüllen
      setHeaderAndAddress();
      setOverview();
      buildGallery();
  // Befülle Raum-Filter und rendere die Tabelle (wiederverwendbar)
  fillRoomFilter();
  // Listener für Filter-Select
  const roomFilterEl = document.getElementById('room-filter');
  if (roomFilterEl) roomFilterEl.addEventListener('change', () => renderDefectsTable());
  renderDefectsTable();
      fillYearOptions();
      renderMessages();
      renderApartmentDocuments();
      renderContractsGeneral();
      renderContractsDocuments();
  renderManuals();
      renderContacts();
      initMessageForm();
    initContactEditModal();
    initTradesmanModal();
    initGeneralEditModal();

      // Icon-Init (Paperclip etc.)
      if (window.lucide && lucide.createIcons) { lucide.createIcons(); }

      // Bestimme initialen Tab aus URL-Parameter `?tab=...` oder benutze Standard 'allgemein'
      try {
        const params = new URLSearchParams(window.location.search);
        const paramTab = params.get('tab');
        let desiredTab = 'allgemein';
        if (paramTab) {
          const lower = String(paramTab).toLowerCase();
          const btns = Array.from(document.querySelectorAll('#tab-buttons button.tab-button'));
          // 1) try exact match against data-tab
          let match = btns.find(b => b.dataset && b.dataset.tab && b.dataset.tab.toLowerCase() === lower);
          // 2) fallback: try matching the visible label text (exact or contains)
          if (!match) {
            match = btns.find(b => {
              const txt = (b.textContent || '').trim().toLowerCase();
              return txt === lower || txt.includes(lower);
            });
          }
          if (match) desiredTab = match.dataset.tab;
        }
        const btnToClick = document.querySelector(`#tab-buttons button.tab-button[data-tab="${desiredTab}"]`);
        if (btnToClick) {
          // Verwende click(), damit vorhandene Listener ausgeführt werden
          btnToClick.click();
        }
      } catch (e) {
        console.warn('Initial tab selection failed', e);
      }

      // Smoke-Tests
      assert(!!document.getElementById('image-gallery'), '#image-gallery existiert');
      assert(!!document.getElementById('waterfallChart'), '#waterfallChart existiert');
      assert(document.body.textContent.includes('Mietkosten'), 'Preistext zeigt Mietkosten');
    } catch (e) {
      console.error('Initialisierung fehlgeschlagen:', e);
    }
  }
  function renderApartmentDocuments() {
    const list = document.getElementById('apartment-documents-list');
    if (!list) return;
    list.innerHTML = '';
    const docs = (APP_DATA?.documents?.apartment || []).filter(d => !d.deletedAt);
    docs.forEach(doc => {
      const li = document.createElement('li');
      const icon = getIconSvg(doc.icon || 'file-text').replace('mr-3', 'mr-3 text-blue-500');
      const url = doc.url || '#';
      li.innerHTML = `
        <a href="${url}" target="_blank" rel="noopener" class="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition duration-150">
          ${icon}
          <span class="font-medium text-gray-800">${doc.title}</span>
        </a>`;
      list.appendChild(li);
    });
  }

  function renderContractsGeneral() {
    const list = document.getElementById('contracts-general-list');
    if (!list) return;
    list.innerHTML = '';
    const g = APP_DATA?.contracts?.general || {};
    const rows = [
      { label: 'Beginn des Mietvertrages:', value: g.beginDate || '—' },
      { label: 'Befristung des Mietvertrages:', value: g.fixedTerm ?? '—' },
      { label: 'Verlängerung des Mietvertrages am:', value: g.extensionDate || '—' }
    ];
    rows.forEach(r => {
      const li = document.createElement('li');
      li.className = 'flex items-center';
      li.innerHTML = `<span class="w-56 text-gray-500">${r.label}</span><span>${r.value}</span>`;
      list.appendChild(li);
    });
  }

  function renderContractsDocuments() {
    const list = document.getElementById('contracts-documents-list');
    if (!list) return;
    list.innerHTML = '';
    const docs = APP_DATA?.contracts?.documents || [];
    docs.forEach(doc => {
      const li = document.createElement('li');
      const icon = getIconSvg(doc.icon || 'file-text').replace('mr-3', 'mr-3 text-blue-500');
      const url = doc.url || '#';
      li.innerHTML = `
        <a href="${url}" target="_blank" rel="noopener" class="flex items-center p-3 bg-white rounded-lg hover:bg-gray-50 transition duration-150 border border-gray-200">
          ${icon}
          <span class="font-medium text-gray-800">${doc.title}</span>
        </a>`;
      list.appendChild(li);
    });
  }

  function renderManuals() {
    const list = document.getElementById('manuals-list');
    if (!list) return;
    list.innerHTML = '';
    const manuals = APP_DATA?.manuals || [];
    manuals.forEach(doc => {
      const li = document.createElement('li');
      const icon = getIconSvg(doc.icon || 'file-text').replace('mr-3', 'mr-3 text-blue-500');
      const url = doc.url || '#';
      li.innerHTML = `
        <a href="${url}" target="_blank" rel="noopener" class="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition duration-150">
          ${icon}
          <span class="font-medium text-gray-800">${doc.title}</span>
        </a>`;
      list.appendChild(li);
    });
  }

  function renderCostsDocuments(year) {
    const list = document.getElementById('costs-documents-list');
    if (!list) return;
    list.innerHTML = '';
    const docs = APP_DATA?.costs?.[year]?.documents || [];
    docs.forEach(doc => {
      const li = document.createElement('li');
      const icon = getIconSvg(doc.icon || 'file-text').replace('mr-3', 'mr-3 text-blue-500');
      const url = doc.url || '#';
      li.innerHTML = `
        <a href="${url}" target="_blank" rel="noopener" class="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition duration-150">
          ${icon}
          <span class="font-medium text-gray-800">${doc.title}</span>
        </a>`;
      list.appendChild(li);
    });
  }

  function renderContacts() {
    const landlordEl = document.getElementById('landlord-contact');
    const tenantEl = document.getElementById('tenant-contact');
    const contacts = APP_DATA?.contacts || {};
    if (landlordEl) {
      landlordEl.innerHTML = '';
      const l = contacts.landlord || {};
      landlordEl.appendChild(makeContactLi('Name:', l.name));
      landlordEl.appendChild(makeContactLi('Adresse:', l.address));
      landlordEl.appendChild(makeContactLi('Telefon:', l.phone, 'tel'));
      landlordEl.appendChild(makeContactLi('Email:', l.email, 'mailto'));
    }
    if (tenantEl) {
      tenantEl.innerHTML = '';
      const t = contacts.tenant || {};
      tenantEl.appendChild(makeContactLi('Name:', t.name));
      tenantEl.appendChild(makeContactLi('Adresse:', t.address));
      tenantEl.appendChild(makeContactLi('Telefon:', t.phone, 'tel'));
      tenantEl.appendChild(makeContactLi('Email:', t.email, 'mailto'));
    }
  }

  // ----- Kontakt-Bearbeitung -----
  let currentEditContactType = null;

  function openContactEditModal(contactType) {
    const modal = document.getElementById('contact-edit-modal');
    const title = document.getElementById('contact-edit-title');
    const form = document.getElementById('contact-edit-form');
    if (!modal || !form) return;

    currentEditContactType = contactType;
    const contacts = APP_DATA?.contacts || {};
    const contact = contacts[contactType] || {};

    // Update modal title
    const typeLabel = contactType === 'landlord' ? 'Vermieter' : 'Mieter';
    if (title) title.textContent = `Kontakt bearbeiten: ${typeLabel}`;

    // Fill form with current data
    document.getElementById('contact-name').value = contact.name || '';
    document.getElementById('contact-address').value = contact.address || '';
    document.getElementById('contact-phone').value = contact.phone || '';
    document.getElementById('contact-email').value = contact.email || '';

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeContactEditModal() {
    const modal = document.getElementById('contact-edit-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    currentEditContactType = null;
  }

  async function saveContactEdit(contactData) {
    if (!currentEditContactType) return false;

    const apiUrl = './api/getData.php';
    const payload = {
      immoId: '1001',
      contactType: currentEditContactType,
      contactData: contactData
    };

    try {
      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const result = await res.json();
      if (result.error) {
        throw new Error(result.message || 'Unknown error');
      }

      // Reload data and re-render contacts
      await loadData('1001');
      renderContacts();
      return true;
    } catch (e) {
      console.error('Fehler beim Speichern des Kontakts:', e);
      alert('Kontakt konnte nicht gespeichert werden: ' + e.message);
      return false;
    }
  }

  function initContactEditModal() {
    const modal = document.getElementById('contact-edit-modal');
    const form = document.getElementById('contact-edit-form');
    const closeBtn = document.getElementById('contact-edit-close');
    const cancelBtn = document.getElementById('contact-edit-cancel');
    const landlordBtn = document.getElementById('edit-landlord-btn');
    const tenantBtn = document.getElementById('edit-tenant-btn');

    if (!modal || !form) return;

    // Edit buttons
    if (landlordBtn) {
      landlordBtn.addEventListener('click', () => openContactEditModal('landlord'));
    }
    if (tenantBtn) {
      tenantBtn.addEventListener('click', () => openContactEditModal('tenant'));
    }

    // Close buttons
    if (closeBtn) closeBtn.addEventListener('click', closeContactEditModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeContactEditModal);

    // Click outside modal to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeContactEditModal();
    });

    // Form submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const contactData = {
        name: document.getElementById('contact-name').value.trim(),
        address: document.getElementById('contact-address').value.trim(),
        phone: document.getElementById('contact-phone').value.trim(),
        email: document.getElementById('contact-email').value.trim()
      };

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Wird gespeichert...';

      const success = await saveContactEdit(contactData);

      if (success) {
        closeContactEditModal();
      }

      submitBtn.disabled = false;
      submitBtn.textContent = 'Speichern';
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        closeContactEditModal();
      }
    });
  }

  function makeContactLi(label, value, kind) {
    const li = document.createElement('li');
    li.className = 'flex items-center gap-1';
    const left = document.createElement('span');
    left.className = 'text-gray-500';
    left.textContent = label;
    li.appendChild(left);
    if (!value) {
      li.appendChild(document.createTextNode('—'));
      return li;
    }
    if (kind === 'tel') {
      const a = document.createElement('a');
      a.className = 'text-blue-600 hover:underline';
      a.href = 'tel:' + value.replace(/\s/g, '');
      a.textContent = value;
      li.appendChild(a);
    } else if (kind === 'mailto') {
      const a = document.createElement('a');
      a.className = 'text-blue-600 hover:underline';
      a.href = 'mailto:' + value;
      a.textContent = value;
      li.appendChild(a);
    } else {
      li.appendChild(document.createTextNode(value));
    }
    return li;
  }

  // ----- Allgemein-Editor (Modal) -----
  let quill = null;

  function openGeneralEditModal() {
    const modal = document.getElementById('general-edit-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Tabs
    const tabs = document.querySelectorAll('#general-edit-tabs .tab-button');
    const panes = document.querySelectorAll('#general-edit-content .gen-pane');
    function activate(tabName) {
      tabs.forEach(b => {
        const active = b.dataset.tab === tabName;
        if (active) {
          b.classList.add('tab-active');
          b.classList.remove('tab-inactive');
          b.classList.add('border-b-2');
          b.classList.remove('border-transparent');
          b.setAttribute('aria-selected', 'true');
        } else {
          b.classList.remove('tab-active');
          b.classList.add('tab-inactive');
          b.classList.add('border-transparent');
          b.setAttribute('aria-selected', 'false');
        }
      });
      panes.forEach(p => p.classList.toggle('hidden', p.getAttribute('data-tab-content') !== tabName));
    }
    tabs.forEach(b => b.addEventListener('click', () => activate(b.dataset.tab)));
    activate('edit-ueberblick');

    // Populate Überblick list
    const editList = document.getElementById('overview-edit-list');
    if (editList) {
      const ov = APP_DATA?.overview;
      const attrs = Array.isArray(ov) ? ov.filter(x => (x?.id || '').toLowerCase() !== 'description') : [];
      let html = `
        <div class="overflow-x-auto bg-white rounded-lg border border-gray-200">
          <table class="min-w-full divide-y divide-gray-200" aria-label="Überblick-Attribute">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Anzeigename</th>
                <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Icon</th>
                <th scope="col" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wert</th>
              </tr>
            </thead>
            <tbody id="overview-edit-tbody" class="bg-white divide-y divide-gray-200"></tbody>
          </table>
        </div>`;
      editList.innerHTML = html;
      const tbody = document.getElementById('overview-edit-tbody');
      if (tbody) {
        attrs.forEach((a) => {
          const tr = document.createElement('tr');
          tr.className = 'ov-row';
          tr.innerHTML = `
            <td class="px-4 py-2"><input class="ov-input-id mt-0.5 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value="${escapeHtml(a.id || '')}" /></td>
            <td class="px-4 py-2"><input class="ov-input-display mt-0.5 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value="${escapeHtml(a.displayName || '')}" /></td>
            <td class="px-4 py-2"><input class="ov-input-icon mt-0.5 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value="${escapeHtml(a.icon || '')}" placeholder="z.B. home" /></td>
            <td class="px-4 py-2"><input class="ov-input-value mt-0.5 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value="${escapeHtml(String(a.value ?? ''))}" /></td>`;
          tbody.appendChild(tr);
        });
      }
    }

    // Quill init
    const ov = APP_DATA?.overview;
    const descEntry = (Array.isArray(ov) ? ov : []).find(x => (x?.id || '').toLowerCase() === 'description');
    const initialHtml = descEntry?.value || '';
    const editorEl = document.getElementById('desc-editor');
    if (editorEl && !quill && window.Quill) {
      quill = new Quill('#desc-editor', { theme: 'snow' });
    }
    if (quill) {
      quill.root.innerHTML = initialHtml;
    }

    // Docs list (soft delete)
    const docsList = document.getElementById('apt-docs-edit-list');
    if (docsList) {
      docsList.innerHTML = '';
      const docs = (APP_DATA?.documents?.apartment || []).filter(d => !d.deletedAt);
      docs.forEach(doc => {
        const li = document.createElement('li');
        const icon = getIconSvg(doc.icon || 'file-text').replace('mr-3', 'mr-2 text-blue-500');
        li.className = 'flex items-center justify-between p-2 bg-white border rounded';
        li.innerHTML = `<div class="flex items-center">${icon}<a href="${doc.url}" target="_blank" rel="noopener" class="text-blue-600 hover:underline">${escapeHtml(doc.title || doc.url)}</a></div>
          <button class="doc-del px-2 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded" data-doc-id="${doc.id || ''}" data-doc-url="${doc.url || ''}">Entfernen</button>`;
        docsList.appendChild(li);
      });
      docsList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.doc-del');
        if (!btn) return;
        const ident = { id: btn.getAttribute('data-doc-id') || undefined, url: btn.getAttribute('data-doc-url') || undefined };
        try {
          await softDeleteDoc(ident);
          await loadData('1001');
          openGeneralEditModal();
        } catch (err) { alert('Löschen fehlgeschlagen: ' + err.message); }
      }, { once: true });
    }
  }

  function closeGeneralEditModal() {
    const modal = document.getElementById('general-edit-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  async function saveOverviewAddAndPersist() {
    // Keep description entry, rebuild attributes from editable rows
    const ov = Array.isArray(APP_DATA?.overview) ? APP_DATA.overview : [];
    const descEntry = ov.find(x => (x?.id || '').toLowerCase() === 'description' || x.type === 'description');

    const attrs = [];
    const rows = document.querySelectorAll('#overview-edit-tbody tr.ov-row');
    rows.forEach(row => {
      const id = row.querySelector('.ov-input-id')?.value.trim();
      const displayName = row.querySelector('.ov-input-display')?.value.trim();
      const icon = row.querySelector('.ov-input-icon')?.value.trim();
      const value = row.querySelector('.ov-input-value')?.value.trim();
      if (id && value) attrs.push({ id, displayName, icon, value });
    });

    // Include the add-form values if present
    const addId = (document.getElementById('ov-id')?.value || '').trim();
    const addDisplay = (document.getElementById('ov-display')?.value || '').trim();
    const addIcon = (document.getElementById('ov-icon')?.value || '').trim();
    const addValue = (document.getElementById('ov-value')?.value || '').trim();
    if (addId && addValue) attrs.push({ id: addId, displayName: addDisplay, icon: addIcon, value: addValue });

    // Compose full overview (attributes + description if it existed)
    const fullOverview = descEntry ? [...attrs, descEntry] : attrs;
    const payload = { immoId: '1001', overviewUpdate: { attributes: fullOverview } };
    const res = await fetch('./api/getData.php', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('API error ' + res.status);
    const j = await res.json(); if (j.error) throw new Error(j.message || 'Fehler');
    await loadData('1001');
    setOverview();
    // Re-render edit table with latest data
    openGeneralEditModal();
    if (document.getElementById('ov-id')) document.getElementById('ov-id').value = '';
    if (document.getElementById('ov-display')) document.getElementById('ov-display').value = '';
    if (document.getElementById('ov-icon')) document.getElementById('ov-icon').value = '';
    if (document.getElementById('ov-value')) document.getElementById('ov-value').value = '';
  }

  async function saveDescriptionHtml() {
    const html = quill ? quill.root.innerHTML : '';
    const payload = { immoId: '1001', descriptionHtml: html };
    const res = await fetch('./api/getData.php', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('API error ' + res.status);
    const j = await res.json(); if (j.error) throw new Error(j.message || 'Fehler');
    await loadData('1001');
    setOverview();
  }

  async function uploadApartmentDoc() {
    const title = (document.getElementById('doc-title')?.value || '').trim();
    const icon = (document.getElementById('doc-icon')?.value || '').trim();
    const fileInput = document.getElementById('doc-file');
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) throw new Error('Keine Datei gewählt');
    const fd = new FormData();
    fd.append('immoId', '1001');
    fd.append('title', title);
    fd.append('icon', icon || 'file-text');
    fd.append('file', file);
    const res = await fetch('./api/getData.php', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Upload fehlgeschlagen ' + res.status);
    const j = await res.json(); if (j.error) throw new Error(j.message || 'Fehler');
    await loadData('1001');
    renderApartmentDocuments();
  }

  async function softDeleteDoc(ident) {
    const payload = { immoId: '1001', deleteDocument: ident };
    const res = await fetch('./api/getData.php', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('API error ' + res.status);
    const j = await res.json(); if (j.error) throw new Error(j.message || 'Fehler');
  }

  function initGeneralEditModal() {
    const btn = document.getElementById('general-edit-btn');
    const modal = document.getElementById('general-edit-modal');
    const closeBtn = document.getElementById('general-edit-close');
    const cancelBtn = document.getElementById('general-edit-cancel');
    const ovAddBtn = document.getElementById('ov-add-btn');
    const ovSaveBtn = document.getElementById('ov-save-btn');
    const descSaveBtn = document.getElementById('desc-save-btn');
    const docUploadBtn = document.getElementById('doc-upload-btn');

    if (btn) btn.addEventListener('click', openGeneralEditModal);
    if (closeBtn) closeBtn.addEventListener('click', closeGeneralEditModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeGeneralEditModal);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeGeneralEditModal(); });
    if (ovAddBtn) ovAddBtn.addEventListener('click', async () => {
      const id = (document.getElementById('ov-id')?.value || '').trim();
      const displayName = (document.getElementById('ov-display')?.value || '').trim();
      const icon = (document.getElementById('ov-icon')?.value || '').trim();
      const value = (document.getElementById('ov-value')?.value || '').trim();
      if (!id || !value) return;
      const tbody = document.getElementById('overview-edit-tbody');
      if (tbody) {
        const tr = document.createElement('tr');
        tr.className = 'ov-row';
        tr.innerHTML = `
          <td class="px-4 py-2"><input class="ov-input-id mt-0.5 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value="${escapeHtml(id)}" /></td>
          <td class="px-4 py-2"><input class="ov-input-display mt-0.5 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value="${escapeHtml(displayName)}" /></td>
          <td class="px-4 py-2"><input class="ov-input-icon mt-0.5 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value="${escapeHtml(icon)}" placeholder="z.B. home" /></td>
          <td class="px-4 py-2"><input class="ov-input-value mt-0.5 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value="${escapeHtml(value)}" /></td>`;
        tbody.appendChild(tr);
      }
      // clear add form inputs
      const idEl = document.getElementById('ov-id'); if (idEl) idEl.value = '';
      const dEl = document.getElementById('ov-display'); if (dEl) dEl.value = '';
      const iEl = document.getElementById('ov-icon'); if (iEl) iEl.value = '';
      const vEl = document.getElementById('ov-value'); if (vEl) vEl.value = '';
    });
    if (ovSaveBtn) ovSaveBtn.addEventListener('click', async () => {
      try { await saveOverviewAddAndPersist(); } catch (e) { alert('Speichern fehlgeschlagen: ' + e.message); }
    });
    if (descSaveBtn) descSaveBtn.addEventListener('click', async () => {
      try { await saveDescriptionHtml(); } catch (e) { alert('Speichern fehlgeschlagen: ' + e.message); }
    });
    if (docUploadBtn) docUploadBtn.addEventListener('click', async () => {
      try { await uploadApartmentDoc(); openGeneralEditModal(); } catch (e) { alert('Upload fehlgeschlagen: ' + e.message); }
    });
  }

  // ----- Handwerker Modal & Save-Logic -----
  let currentTradesmanMode = 'add'; // 'add' | 'edit'
  let currentTradesmanEditId = null;

  function openTradesmanModal(mode = 'add', tradesman = null) {
    const modal = document.getElementById('tradesman-modal');
    if (!modal) return;
    currentTradesmanMode = mode;
    currentTradesmanEditId = tradesman ? tradesman.id : null;
    const title = document.getElementById('tradesman-modal-title');
    const form = document.getElementById('tradesman-form');
    if (title) title.textContent = mode === 'edit' ? 'Handwerker bearbeiten' : 'Handwerker hinzufügen';

    // Fill form fields
  // HTML uses ids: tr-name, tr-specialty, tr-phone, tr-email, tr-icon
  const nameEl = document.getElementById('tr-name');
  const specialtyEl = document.getElementById('tr-specialty');
  const phoneEl = document.getElementById('tr-phone');
  const emailEl = document.getElementById('tr-email');
  const iconEl = document.getElementById('tr-icon');
  const websiteEl = document.getElementById('tr-website');
  const commentEl = document.getElementById('tr-comment');
  if (nameEl) nameEl.value = tradesman ? (tradesman.name || '') : '';
  if (specialtyEl) specialtyEl.value = tradesman ? (tradesman.specialty || '') : '';
  if (phoneEl) phoneEl.value = tradesman ? (tradesman.phone || '') : '';
  if (emailEl) emailEl.value = tradesman ? (tradesman.email || '') : '';
  if (iconEl) iconEl.value = tradesman ? (tradesman.icon || 'tool') : 'tool';
  if (websiteEl) websiteEl.value = tradesman ? (tradesman.website || '') : '';
  if (commentEl) commentEl.value = tradesman ? (tradesman.comment || '') : '';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    // focus name input (we already have nameEl)
    if (nameEl) nameEl.focus();
  }

  function closeTradesmanModal() {
    const modal = document.getElementById('tradesman-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    currentTradesmanMode = 'add';
    currentTradesmanEditId = null;
  }

  async function saveTradesman(tradesmanData) {
    const apiUrl = './api/getData.php';
    try {
      let res;
      if (currentTradesmanMode === 'add') {
        const payload = { immoId: '1001', tradesman: tradesmanData };
        res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        const payload = { immoId: '1001', tradesmanUpdate: { id: currentTradesmanEditId, data: tradesmanData } };
        res = await fetch(apiUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }

      if (!res.ok) throw new Error('API Fehler: ' + res.status);
      const result = await res.json();
      if (result.error) throw new Error(result.message || 'Unbekannter Fehler');

      // Reload data and refresh tradesmen
      await loadData('1001');
      tradesmen = APP_DATA.tradesmen || [];
      initializeTradesmenList();
      displayTradesmanDetails(null);
      return true;
    } catch (e) {
      console.error('Fehler beim Speichern des Handwerkers:', e);
      alert('Handwerker konnte nicht gespeichert werden: ' + e.message);
      return false;
    }
  }

  function initTradesmanModal() {
    const addBtn = document.getElementById('add-tradesman-btn');
    const modal = document.getElementById('tradesman-modal');
    const closeBtn = document.getElementById('tradesman-modal-close');
    const cancelBtn = document.getElementById('tradesman-cancel');
    const form = document.getElementById('tradesman-form');

    if (addBtn) addBtn.addEventListener('click', () => openTradesmanModal('add', null));
    if (closeBtn) closeBtn.addEventListener('click', closeTradesmanModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeTradesmanModal);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeTradesmanModal(); });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
          name: (document.getElementById('tr-name') && document.getElementById('tr-name').value.trim()) || '',
          specialty: (document.getElementById('tr-specialty') && document.getElementById('tr-specialty').value.trim()) || '',
          phone: (document.getElementById('tr-phone') && document.getElementById('tr-phone').value.trim()) || '',
          email: (document.getElementById('tr-email') && document.getElementById('tr-email').value.trim()) || '',
          website: (document.getElementById('tr-website') && document.getElementById('tr-website').value.trim()) || '',
          comment: (document.getElementById('tr-comment') && document.getElementById('tr-comment').value.trim()) || '',
          icon: (document.getElementById('tr-icon') && document.getElementById('tr-icon').value) || 'tool'
        };
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true; submitBtn.textContent = currentTradesmanMode === 'edit' ? 'Speichert...' : 'Hinzufügen...';
        const ok = await saveTradesman(data);
        submitBtn.disabled = false; submitBtn.textContent = currentTradesmanMode === 'edit' ? 'Speichern' : 'Hinzufügen';
        if (ok) closeTradesmanModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeTradesmanModal();
    });
  }

  // Start
  init();
});