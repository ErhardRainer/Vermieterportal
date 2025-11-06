# PowerShell-Script zum Starten des HTTP-Servers für die DIY-Spielesammlung Webseite

# Wechsle in das Verzeichnis der Webseite
cd "C:\Users\erhard.rainer\Documents\GitHub\Vermieterportal\html"

# Starte den HTTP-Server auf Port 8000
python -m http.server 8000

# Hinweis: Der Server läuft im Vordergrund. Drücke Ctrl+C, um ihn zu stoppen.
# http://localhost:8000/index.html