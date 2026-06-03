# Pizza Zuhause

Kleine mobile Webseite fuer private Pizza-Bestellungen zuhause. Die App ist ein reines Frontend und laeuft ohne Build-Schritt direkt ueber GitHub Pages.

## Dateien

- `index.html`: Seitenstruktur fuer Gast- und Kochansicht
- `style.css`: Mobile-first Gestaltung
- `app.js`: Warenkorb, Bestellungen, Wunschpizza und Ausverkauft-Status
- `menu.json`: Aenderbare Menue-Daten

## Lokal starten

Oeffne den Projektordner in WebStorm und starte einen einfachen lokalen Webserver. Das ist wichtig, weil `menu.json` per `fetch` geladen wird.

Beispiele:

```bash
python3 -m http.server 8000
```

Danach die Seite unter `http://localhost:8000` oeffnen.

## GitHub Pages

1. Repository erstellen und die Dateien in den Hauptordner legen.
2. In GitHub unter `Settings > Pages` die Quelle auf den Branch mit diesen Dateien setzen.
3. Die Seite veroeffentlichen.

Die App nutzt nur Query-Parameter fuer Unteransichten. Dadurch funktionieren Direktaufrufe auch auf GitHub Pages ohne extra Router:

- Gastansicht: `index.html`
- Warenkorb: `index.html?view=cart`
- Kochansicht: `index.html?view=kitchen`

Die Datei `.nojekyll` sorgt dafuer, dass GitHub Pages den Ordner als einfache statische Webseite ausliefert.

## Menue aendern

Alle Gerichte und Zutaten stehen in `menu.json`. Neue Gerichte erscheinen automatisch, solange sie in einer Kategorie unter `items` eingetragen sind.

Bestellungen und Ausverkauft-Status werden nur lokal im Browser gespeichert. Andere Geraete sehen diese Daten nicht.
