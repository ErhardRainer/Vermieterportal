// Icon utilities: robust icon resolver
(function () {
  function toCamelCase(s) {
    return String(s || '').replace(/[-_](.)/g, (_, c) => c ? c.toUpperCase() : '').replace(/^(.)/, (m) => m.toLowerCase());
  }
  function toPascalCase(s) {
    return String(s || '').replace(/(^.|[-_].)/g, m => m.replace(/[-_]/, '').toUpperCase());
  }

  const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5 mr-3 text-blue-500"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`;
  const encodedDefault = encodeURIComponent(defaultSvg);

  function resolveIconHtml(iconName) {
    if (!iconName) return defaultSvg;
    const tries = [
      iconName,
      String(iconName).toLowerCase(),
      String(iconName).replace(/_/g, '-'),
      String(iconName).replace(/-/g, ''),
      toCamelCase(iconName),
      toPascalCase(iconName)
    ];

    try {
      if (window.lucide && lucide.icons) {
        for (const k of tries) {
          if (k && lucide.icons[k]) {
            try { return lucide.icons[k].toSvg({ class: 'w-5 h-5 mr-3 text-blue-500' }); } catch (e) { /* continue */ }
          }
        }
      }
    } catch (e) { /* ignore lucide errors */ }

    // Fallback: try to render a local SVG file from assets/icons/<iconName>.svg
    const fileName = String(iconName).toLowerCase().replace(/\s+/g, '-');
    // Use a safe data URI for the default SVG in case the local file is missing
    const dataUri = `data:image/svg+xml;utf8,${encodedDefault}`;
    // onerror will swap the src to the data URI (no inline template literals)
    return `<img src="./assets/icons/${fileName}.svg" class="w-5 h-5 mr-3 text-blue-500" alt="" onerror="this.onerror=null;this.src='${dataUri}';"/>`;
  }

  // expose globally
  window.getIconSvg = resolveIconHtml;
})();
