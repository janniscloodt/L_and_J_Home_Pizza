# 🍕 Pizza Zuhause - Bestellsystem

Geräteübergreifendes Pizza-Bestellsystem für zuhause, das in Docker-Containern auf einem Raspberry Pi läuft.

## 🏗️ Architektur

Das System besteht aus zwei Docker-Containern:

- **Frontend** (Port 8080): Nginx-Webserver mit der Benutzeroberfläche
- **Backend** (Port 3000): Node.js/Express API-Server mit JSON-Datenspeicherung

Alle Geräte im Netzwerk können auf dieselbe Instanz zugreifen, wodurch Bestellungen geräteübergreifend funktionieren.

## 📋 Voraussetzungen

Auf dem Raspberry Pi müssen installiert sein:
- Docker
- Docker Compose

### Docker Installation auf Raspberry Pi

```bash
# Docker installieren
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Benutzer zur Docker-Gruppe hinzufügen
sudo usermod -aG docker $USER

# Docker Compose installieren
sudo apt-get install -y docker-compose

# Neustart oder neu anmelden
```

## 🚀 Installation & Start

### 1. Repository klonen

```bash
git clone https://github.com/janniscloodt/L_and_J_Home_Pizza.git
cd L_and_J_Home_Pizza
```

### 2. System starten

```bash
docker-compose up -d
```

Das wars! Das System läuft jetzt auf:
- **Frontend**: `http://[raspberry-pi-ip]:8080`
- **Backend API**: `http://[raspberry-pi-ip]:3000`

### 3. System stoppen

```bash
docker-compose down
```

### 4. System neustarten

```bash
docker-compose restart
```

## 🔧 Konfiguration

### Passwort für Koch-Ansicht ändern

Bearbeite die Datei `docker-compose.yml` und ändere:

```yaml
environment:
  - KITCHEN_PASSWORD=dein-neues-passwort
```

Danach System neustarten:

```bash
docker-compose down
docker-compose up -d
```

### Ports ändern

In `docker-compose.yml` die Port-Mappings anpassen:

```yaml
ports:
  - "dein-port:80"    # Frontend
  - "dein-port:3000"  # Backend
```

## 📱 Verwendung

### Gastansicht (Bestellen)
1. Öffne `http://[raspberry-pi-ip]:8080` im Browser
2. Wähle Gerichte aus dem Menü
3. Füge sie zum Warenkorb hinzu
4. Gib deinen Namen ein und schicke die Bestellung ab

### Koch-Ansicht (Verwaltung)
1. Klicke auf den Button zum Wechseln der Ansicht (oben rechts)
2. **Passwort eingeben**: `admin123` (oder dein konfiguriertes Passwort)
3. Verwalte offene Bestellungen
4. Markiere Gerichte als ausverkauft

## 📂 Projektstruktur

```
.
├── docker-compose.yml      # Orchestriert beide Container
├── backend/                # Backend API
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js           # Express API Server
│   └── data/               # Persistente Daten
│       ├── menu.json       # Menü-Daten
│       ├── orders.json     # Bestellungen
│       └── soldOut.json    # Ausverkauft-Status
├── frontend/               # Frontend UI
│   ├── Dockerfile
│   ├── nginx.conf          # Nginx-Konfiguration
│   ├── index.html
│   ├── style.css
│   └── app.js              # Frontend-Logik
└── README.md
```

## 🔒 Sicherheit

- **Koch-Ansicht**: Passwortgeschützt via HTTP Basic Auth
- **Netzwerk**: Container kommunizieren über internes Docker-Netzwerk
- **Daten**: Werden lokal auf dem Raspberry Pi gespeichert

## 🛠️ Entwicklung

### Lokale Entwicklung ohne Docker

**Backend starten:**
```bash
cd backend
npm install
npm start
```

**Frontend starten:**
```bash
cd frontend
python3 -m http.server 8080
```

### Logs anzeigen

```bash
# Alle Logs
docker-compose logs -f

# Nur Backend
docker-compose logs -f backend

# Nur Frontend
docker-compose logs -f frontend
```

### Container neu bauen (nach Änderungen)

```bash
docker-compose up -d --build
```

## 📝 API-Endpunkte

### Öffentlich (ohne Authentifizierung)
- `GET /api/menu` - Menü laden
- `GET /api/soldout` - Ausverkauft-Status laden
- `POST /api/orders` - Neue Bestellung erstellen

### Geschützt (benötigt Passwort)
- `GET /api/orders` - Alle Bestellungen abrufen
- `PATCH /api/orders/:id` - Bestellstatus ändern
- `DELETE /api/orders` - Alle Bestellungen löschen
- `PUT /api/soldout` - Ausverkauft-Status aktualisieren

## 🔄 Updates

```bash
# Code aktualisieren
git pull

# Container neu bauen und starten
docker-compose up -d --build
```

## 🍽️ Menü anpassen

Bearbeite `backend/data/menu.json`:

```json
{
  "categories": [
    {
      "id": "pizza",
      "name": "Pizza",
      "items": [
        {
          "id": "pizza-custom",
          "name": "Deine Pizza",
          "description": "Beschreibung",
          "price": 8.5,
          "ingredients": ["Tomatensoße", "Käse"],
          "soldOut": false
        }
      ]
    }
  ]
}
```

Danach Backend neu starten:
```bash
docker-compose restart backend
```

## 🐛 Fehlerbehebung

### Container laufen nicht
```bash
# Status prüfen
docker-compose ps

# Logs ansehen
docker-compose logs
```

### Port bereits belegt
```bash
# Ports in docker-compose.yml ändern
# Dann neu starten
docker-compose down
docker-compose up -d
```

### Daten zurücksetzen
```bash
# Bestellungen und Ausverkauft-Status löschen
rm backend/data/orders.json
rm backend/data/soldOut.json

# Container neu starten
docker-compose restart backend
```

### Frontend erreicht Backend nicht
- Prüfe ob beide Container im selben Netzwerk sind: `docker network inspect digital-kartensystem_pizza-network`
- Prüfe Backend-Logs: `docker-compose logs backend`

## 💾 Backup

Wichtige Daten sichern:

```bash
# Backup erstellen
tar -czf pizza-backup-$(date +%Y%m%d).tar.gz backend/data/

# Backup wiederherstellen
tar -xzf pizza-backup-YYYYMMDD.tar.gz
docker-compose restart backend
```

## 📊 System-Überwachung

### Container-Status
```bash
docker-compose ps
```

### Ressourcenverbrauch
```bash
docker stats
```

### Health Checks
```bash
# Frontend
curl http://localhost:8080/health

# Backend
curl http://localhost:3000/health
```

## 🎯 Features

✅ Geräteübergreifende Bestellungen  
✅ Passwortgeschützte Koch-Ansicht  
✅ Ausverkauft-Status-Verwaltung  
✅ Wunschpizza mit individuellen Zutaten  
✅ Persistente Datenspeicherung  
✅ Responsive Design (Mobile & Desktop)  
✅ Docker-basiertes Deployment  
✅ Automatische Container-Neustarts  
✅ Health Checks für beide Services  

## 📄 Lizenz

MIT

## 👨‍💻 Entwickler

Privates Projekt für Pizza-Abende zuhause 🍕
