// Immobilien-Portal JavaScript
// Globaler Chart-Kontext
let bkChart = null;

document.addEventListener('DOMContentLoaded', function () {
  // ----- Smoke-Tests (einfach) -----
  function assert(cond, msg) {
    if (!cond) { console.error('TEST FAIL:', msg); } else { console.log('TEST OK:', msg); }
  }

  // ----- Handwerker-Daten -----
  const tradesmen = [
    { id: 'elektro', name: 'Klaus Schmidt', specialty: 'Elektriker', phone: '030 111 222', email: 'klaus.schmidt@elektro.de', icon: 'zap' },
    { id: 'maler', name: 'Erika Wagner', specialty: 'Malerin & Lackiererin', phone: '030 333 444', email: 'erika.wagner@maler.de', icon: 'paint-roller' },
    { id: 'sanitaer', name: 'Hans Müller', specialty: 'Sanitär & Heizung', phone: '030 555 666', email: 'hans.mueller@sanitaer.de', icon: 'wrench' },
    { id: 'boden', name: 'Petra Meyer', specialty: 'Bodenlegerin', phone: '030 777 888', email: 'petra.meyer@boden.de', icon: 'ruler' }
  ];

  // Lucide: sicheres SVG aus der Icon-Registry generieren
  function getIconSvg(iconName) {
    try {
      return lucide && lucide.icons && lucide.icons[iconName]
        ? lucide.icons[iconName].toSvg({ class: 'w-5 h-5 mr-3 text-blue-500' })
        : '';
    } catch (e) { return ''; }
  }

  function displayTradesmanDetails(tradesman) {
    const detailsContainer = document.getElementById('tradesman-details');
    if (!detailsContainer) return; // defensive
    if (!tradesman) {
      detailsContainer.innerHTML = '<p class="text-gray-500">Wählen Sie einen Dienstleister aus der Liste links, um seine Kontaktdaten anzuzeigen.</p>';
      return;
    }
    detailsContainer.innerHTML = `
      <h3 class="text-xl font-bold text-gray-900 mb-2">${tradesman.name}</h3>
      <p class="text-lg text-blue-600 mb-4">${tradesman.specialty}</p>
      <div class="space-y-3">
        <div class="flex items-center text-gray-700">${getIconSvg('phone')}<a href="tel:${tradesman.phone.replace(/\s/g, '')}" class="hover:underline">${tradesman.phone}</a></div>
        <div class="flex items-center text-gray-700">${getIconSvg('mail')}<a href="mailto:${tradesman.email}" class="hover:underline">${tradesman.email}</a></div>
        <div class="flex items-center text-gray-700">${getIconSvg('map-pin')}<span class="ml-3">Region Berlin/Brandenburg</span></div>
      </div>
      <button class="mt-6 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Anfrage per E-Mail senden</button>
    `;
  }

  function initializeTradesmenList() {
    const listContainer = document.getElementById('tradesmen-list');
    if (!listContainer) return;
    if (listContainer.children.length > 0) return; // idempotent
    listContainer.innerHTML = '';
    tradesmen.forEach((t) => {
      const listItem = document.createElement('li');
      listItem.classList.add('tradesman-item', 'p-3', 'rounded-lg', 'cursor-pointer', 'transition-all', 'duration-150');
      listItem.dataset.id = t.id;
      listItem.innerHTML = `
        <div class="flex items-center">${getIconSvg(t.icon)}
          <div><p class="font-medium text-gray-900">${t.name}</p><p class="text-sm text-gray-500">${t.specialty}</p></div>
        </div>`;
      listContainer.appendChild(listItem);
    });
    listContainer.addEventListener('click', (event) => {
      const listItem = event.target.closest('li.tradesman-item');
      if (!listItem) return;
      Array.from(listContainer.children).forEach((item) => item.classList.remove('tradesman-active'));
      listItem.classList.add('tradesman-active');
      const selected = tradesmen.find((t) => t.id === listItem.dataset.id);
      displayTradesmanDetails(selected);
    });
  }

  // ----- Bildergalerie -----
  const images = [
    { src: 'https://placehold.co/1200x800/3b82f6/ffffff?text=Wohnzimmer', alt: 'Wohnzimmer' },
    { src: 'https://placehold.co/1200x800/10b981/ffffff?text=Küche', alt: 'Küche' },
    { src: 'https://placehold.co/1200x800/ef4444/ffffff?text=Schlafzimmer', alt: 'Schlafzimmer' },
    { src: 'https://placehold.co/1200x800/f59e0b/ffffff?text=Balkon', alt: 'Balkon' }
  ];
  let currentImageIndex = 0;
  const galleryContainer = document.getElementById('image-gallery');
  const prevButton = document.getElementById('prev-image');
  const nextButton = document.getElementById('next-image');
  const imageCounter = document.getElementById('image-counter');

  if (galleryContainer) {
    images.forEach((img, index) => {
      const imgElement = document.createElement('img');
      imgElement.src = img.src;
      imgElement.alt = img.alt;
      imgElement.loading = 'lazy';
      imgElement.className = 'absolute inset-0 w-full h-full object-cover';
      if (index !== 0) imgElement.classList.add('hidden');
      galleryContainer.appendChild(imgElement);
    });

    function updateGallery() {
      Array.from(galleryContainer.children).forEach((img, index) => {
        img.classList.toggle('hidden', index !== currentImageIndex);
      });
      if (imageCounter) imageCounter.textContent = `${currentImageIndex + 1} / ${images.length}`;
    }

    if (prevButton) prevButton.addEventListener('click', () => {
      currentImageIndex = currentImageIndex > 0 ? currentImageIndex - 1 : images.length - 1;
      updateGallery();
    });
    if (nextButton) nextButton.addEventListener('click', () => {
      currentImageIndex = currentImageIndex < images.length - 1 ? currentImageIndex + 1 : 0;
      updateGallery();
    });
    updateGallery();
  }

  // ----- Tab-System -----
  const tabButtonsContainer = document.getElementById('tab-buttons');
  const tabContentContainer = document.getElementById('tab-content');
  if (tabButtonsContainer && tabContentContainer) {
    tabButtonsContainer.addEventListener('click', (event) => {
      const clickedButton = event.target.closest('button.tab-button');
      if (!clickedButton) return;
      const tabToActivate = clickedButton.dataset.tab;
      Array.from(tabButtonsContainer.children).forEach((button) => {
        button.classList.remove('tab-active');
        button.classList.add('tab-inactive');
        button.setAttribute('aria-selected', 'false');
      });
      clickedButton.classList.add('tab-active');
      clickedButton.classList.remove('tab-inactive');
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
      }
    });
  }

  // ----- Mängelliste-Logik -----
  const defects = {
    def1: {
      id: 'def1',
      title: 'Kratzer am Parkett nahe Balkontür',
      room: 'Wohnzimmer',
      description: 'Deutliche Kratzspur auf ca. 20 cm Länge in unmittelbarer Nähe zur Balkontür. Vermutlich durch Möbelrücken entstanden.',
      images: [
        'https://placehold.co/1200x800/ef4444/ffffff?text=Parkett+Kratzer+1',
        'https://placehold.co/1200x800/f97316/ffffff?text=Parkett+Kratzer+2'
      ]
    },
    def2: {
      id: 'def2',
      title: 'Lose Silikonfuge an der Dusche',
      room: 'Bad',
      description: 'Silikonfuge zwischen Duschwanne und Fliesen ist teilweise lose. Gefahr von Wassereintritt – Neu verfugen empfohlen.',
      images: [
        'https://placehold.co/1200x800/3b82f6/ffffff?text=Fuge+1',
        'https://placehold.co/1200x800/10b981/ffffff?text=Fuge+2',
        'https://placehold.co/1200x800/0ea5e9/ffffff?text=Fuge+3'
      ]
    },
    def3: {
      id: 'def3',
      title: 'Schublade links klemmt',
      room: 'Küche',
      description: 'Die linke Schublade läuft schwergängig und hakt beim Schließen. Führungsschiene prüfen und ggf. justieren/ersetzen.',
      images: [
        'https://placehold.co/1200x800/84cc16/ffffff?text=Schublade+1'
      ]
    }
  };

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
  const betriebskostenData = {
    '2024': { monthlyPrepayment: 220, actualTotalCost: 2500, status: 'Vorschau' },
    '2023': { monthlyPrepayment: 200, actualTotalCost: 2800, status: 'Abgeschlossen' },
    '2022': { monthlyPrepayment: 180, actualTotalCost: 2160, status: 'Abgeschlossen' }
  };

  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  function createWaterfallData(data) {
    const monthlyPayment = data.monthlyPrepayment;
    const totalPrepayment = monthlyPayment * 12;
    const actualTotalCost = data.actualTotalCost;
    const settlement = totalPrepayment - actualTotalCost; // >0 Guthaben, <0 Nachzahlung

    // Basis: jeder Monat startet dort, wo der vorherige endet (kumulative Basis)
    const baseData = [];
    for (let i = 0; i < 12; i++) {
      baseData.push(monthlyPayment * i);
    }
    baseData.push(0); // Vorauszahlungen (Gesamt) als separater Balken bei 0
  // Differenz (Guthaben/Nachzahlung):
  // - Nachzahlung (delta >= 0): Start auf Höhe der Vorauszahlungen
  // - Guthaben (delta < 0): Start unterhalb der Vorauszahlungen, sodass der Balken bis zur Vorauszahlungen-Höhe reicht
  //   (d. h. der Balken wird "von der Höhe der Vorauszahlungen abgezogen").
  // Platzhalter; tatsächliche Startbasis setzen wir nach Berechnung von deltaToActual unten.
  baseData.push(null);
  baseData.push(0); // Jahresgesamtkosten als eigenständiger Balken bei 0

    const visibleData = new Array(12).fill(monthlyPayment);
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

    actualTotalCostEl.textContent = `${data.actualTotalCost.toFixed(2)} €`;
    prepaymentTotalEl.textContent = `${data.totalPrepayment.toFixed(2)} €`;

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
    const { base, visible, labels, totalPrepayment, actualTotalCost, settlement } = createWaterfallData({ monthlyPrepayment: data.monthlyPrepayment, actualTotalCost: data.actualTotalCost });
    createWaterfallChart({ base, visible, labels, totalPrepayment, actualTotalCost, settlement });
    updateSummary({ totalPrepayment, actualTotalCost }, settlement);
  }

  // Dropdown-Listener
  const yearSelect = document.getElementById('year-select');
  if (yearSelect) {
    yearSelect.addEventListener('change', (ev) => updateBetriebskosten(ev.target.value));
  }

  // Initiale Ausführung
  if (yearSelect) updateBetriebskosten(yearSelect.value);

  // Smoke-Tests ausführen
  assert(!!document.getElementById('image-gallery'), '#image-gallery existiert');
  assert(!!document.getElementById('waterfallChart'), '#waterfallChart existiert');
  assert(document.body.textContent.includes('Mietkosten'), 'Preistext zeigt Mietkosten');
  
  // Maps-Link-Initialisierung
  (function(){
    try {
      const addrDesktop = document.getElementById('address-text-desktop');
      const addrMobile = document.getElementById('address-text-mobile');
      const mapDesk = document.getElementById('map-link-desktop');
      const mapMob = document.getElementById('map-link-mobile');
      const address = (addrDesktop && addrDesktop.textContent.trim()) || (addrMobile && addrMobile.textContent.trim()) || '';
      const url = address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address) : null;
      if (url && mapDesk) mapDesk.href = url;
      if (url && mapMob) mapMob.href = url;
      // Lucide: Icons aus data-lucide initialisieren (zeigt Paperclip)
      if (window.lucide && lucide.createIcons) { lucide.createIcons(); }
      // Smoke-Tests für Maps-Links
      assert(!!mapDesk, 'Maps-Link (Desktop) vorhanden');
      if (mapDesk) assert(mapDesk.getAttribute('target') === '_blank', 'Maps-Link (Desktop) öffnet neuen Tab');
    } catch(e) { console.warn('Maps-Link Init warn:', e); }
  })();
});