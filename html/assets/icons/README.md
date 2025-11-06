# Icons (SVG)

Dieser Ordner enthält lokale SVG-Icons für das Vermieterportal.

Konventionen:
- Dateiname = Icon-Key (z. B. `home.svg`, `bed-double.svg`, `bath.svg`).
- Verwende nur Kleinbuchstaben, Bindestriche und Zahlen.
- Die App speichert in der JSON nur den Icon-Key, z. B. `"icon": "home"`.

Verwendung in der App:
- Direkt im HTML: `<img src="/assets/icons/home.svg" alt="Home" class="w-5 h-5" />`
- Als Fallback in `getIconSvg()`: wenn ein Lucide-Key nicht gefunden wird, lade `/assets/icons/<key>.svg`.

Hinweis: Wenn du die Lucide-Icons weiterverwendest, sind diese lokalen SVGs vor allem für individuelle oder selbst gezeichnete Symbole geeignet.

weiterführende Links:
* https://lucide.dev/icons/
* https://www.svgrepo.com/collections/monocolor/