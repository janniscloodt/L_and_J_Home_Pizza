const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Passwort für Koch-Ansicht
const KITCHEN_PASSWORD = process.env.KITCHEN_PASSWORD || 'admin123';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Datenpfade
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SOLDOUT_FILE = path.join(DATA_DIR, 'soldOut.json');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');

// Hilfsfunktionen für Dateiverwaltung
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Fehler beim Erstellen des Data-Verzeichnisses:', error);
  }
}

async function readJsonFile(filePath, defaultValue = null) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return defaultValue;
    }
    throw error;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Middleware für Passwort-Schutz der Koch-Endpunkte
function requireKitchenAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ 
      error: 'Authentifizierung erforderlich',
      message: 'Bitte Passwort eingeben'
    });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

  if (password !== KITCHEN_PASSWORD) {
    return res.status(403).json({ 
      error: 'Ungültiges Passwort',
      message: 'Das eingegebene Passwort ist falsch'
    });
  }

  next();
}

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API-Routen

// Menü laden
app.get('/api/menu', async (req, res) => {
  try {
    const menu = await readJsonFile(MENU_FILE);
    if (!menu) {
      return res.status(404).json({ error: 'Menü nicht gefunden' });
    }
    res.json(menu);
  } catch (error) {
    console.error('Fehler beim Laden des Menüs:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Menüs' });
  }
});

// Alle Bestellungen abrufen (Koch-Ansicht, geschützt)
app.get('/api/orders', requireKitchenAuth, async (req, res) => {
  try {
    const orders = await readJsonFile(ORDERS_FILE, []);
    res.json(orders);
  } catch (error) {
    console.error('Fehler beim Laden der Bestellungen:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Bestellungen' });
  }
});

// Neue Bestellung erstellen
app.post('/api/orders', async (req, res) => {
  try {
    const newOrder = req.body;
    
    // Validierung
    if (!newOrder.guestName || !newOrder.items || newOrder.items.length === 0) {
      return res.status(400).json({ error: 'Ungültige Bestelldaten' });
    }

    // ID und Zeitstempel hinzufügen
    newOrder.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    newOrder.createdAt = new Date().toISOString();
    newOrder.status = 'open';

    // Bestehende Bestellungen laden
    const orders = await readJsonFile(ORDERS_FILE, []);
    
    // Neue Bestellung hinzufügen
    orders.unshift(newOrder);
    
    // Speichern
    await writeJsonFile(ORDERS_FILE, orders);
    
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Fehler beim Erstellen der Bestellung:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Bestellung' });
  }
});

// Bestellstatus ändern (Koch-Ansicht, geschützt)
app.patch('/api/orders/:id', requireKitchenAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['open', 'done'].includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }

    const orders = await readJsonFile(ORDERS_FILE, []);
    const order = orders.find(o => o.id === id);

    if (!order) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden' });
    }

    order.status = status;
    await writeJsonFile(ORDERS_FILE, orders);

    res.json(order);
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Bestellung:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Bestellung' });
  }
});

// Alle Bestellungen löschen (Koch-Ansicht, geschützt)
app.delete('/api/orders', requireKitchenAuth, async (req, res) => {
  try {
    await writeJsonFile(ORDERS_FILE, []);
    res.json({ message: 'Alle Bestellungen wurden gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der Bestellungen:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Bestellungen' });
  }
});

// Ausverkauft-Status abrufen
app.get('/api/soldout', async (req, res) => {
  try {
    const soldOut = await readJsonFile(SOLDOUT_FILE, {});
    res.json(soldOut);
  } catch (error) {
    console.error('Fehler beim Laden des Ausverkauft-Status:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Ausverkauft-Status' });
  }
});

// Ausverkauft-Status aktualisieren (Koch-Ansicht, geschützt)
app.put('/api/soldout', requireKitchenAuth, async (req, res) => {
  try {
    const soldOut = req.body;
    await writeJsonFile(SOLDOUT_FILE, soldOut);
    res.json(soldOut);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Ausverkauft-Status:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Ausverkauft-Status' });
  }
});

// Server starten
async function startServer() {
  await ensureDataDir();
  
  // Initialisiere Dateien mit Standardwerten, falls nicht vorhanden
  const orders = await readJsonFile(ORDERS_FILE);
  if (orders === null) {
    await writeJsonFile(ORDERS_FILE, []);
  }
  
  const soldOut = await readJsonFile(SOLDOUT_FILE);
  if (soldOut === null) {
    await writeJsonFile(SOLDOUT_FILE, {});
  }

  app.listen(PORT, () => {
    console.log(`🍕 Pizza Backend läuft auf Port ${PORT}`);
    console.log(`🔒 Koch-Ansicht Passwort: ${KITCHEN_PASSWORD}`);
  });
}

startServer();
