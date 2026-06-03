#!/bin/bash
# Start-Script für Pizza Zuhause Bestellsystem

echo "🍕 Pizza Zuhause - Bestellsystem"
echo "================================"
echo ""

# Prüfe ob Docker läuft
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker läuft nicht. Bitte Docker starten."
    exit 1
fi

# Prüfe ob docker compose verfügbar ist
if ! command -v docker compose &> /dev/null; then
    echo "❌ docker compose nicht gefunden. Bitte installieren."
    exit 1
fi

echo "✅ Docker ist bereit"
echo ""

# Starte Container
echo "🚀 Starte Container..."
docker compose up -d --build

# Warte kurz
sleep 3

# Zeige Status
echo ""
echo "📊 Container-Status:"
docker compose ps

echo ""
echo "✅ System läuft!"
echo ""
echo "📱 Zugriff:"
echo "   Frontend: http://localhost:8080"
echo "   Backend:  http://localhost:3000"
echo ""
echo "🔒 Koch-Ansicht Passwort: admin123"
echo ""
echo "💡 Befehle:"
echo "   Logs anzeigen:     docker compose logs -f"
echo "   System stoppen:    docker compose down"
echo "   System neustarten: docker compose restart"
echo ""
