#!/usr/bin/env bash
# =============================================================================
#  Study Timer — Script di installazione per macOS e Linux
#  Non richiede Node.js: usa python3 (incluso in tutti i Mac)
#  Uso: bash installer/install.sh [--dir /percorso/cartella]
# =============================================================================

set -e

# ── Colori ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Banner ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  Study Timer — Installazione${NC}"
echo    "  ================================"
echo ""

# ── Rilevamento OS ─────────────────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
  Darwin) OS_NAME="macOS" ;;
  Linux)  OS_NAME="Linux"  ;;
  *)      error "Sistema operativo non supportato: $OS" ;;
esac
info "Sistema rilevato: $OS_NAME"

# ── Verifica python3 (unico prerequisito) ─────────────────────────────────────
command -v python3 >/dev/null 2>&1 || error "python3 non trovato. Su macOS e' incluso di default; aggiornare macOS se mancante."
PY_VER=$(python3 --version 2>&1)
info "$PY_VER trovato"

# ── Directory di installazione ─────────────────────────────────────────────────
INSTALL_DIR=""
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --dir) INSTALL_DIR="$2"; shift ;;
  esac
  shift
done

if [[ -z "$INSTALL_DIR" ]]; then
  if [[ "$OS_NAME" == "macOS" ]]; then
    DEFAULT_DIR="$HOME/Applications/StudyTimer"
  else
    DEFAULT_DIR="$HOME/StudyTimer"
  fi
  echo -e "  Dove installare? [${CYAN}${DEFAULT_DIR}${NC}] "
  read -r USER_DIR
  INSTALL_DIR="${USER_DIR:-$DEFAULT_DIR}"
fi

# ── Cartella sorgente ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"

[[ -d "$DIST_DIR" ]] || error "Cartella 'dist/' non trovata in $PROJECT_DIR. Assicurati di aver scaricato il pacchetto completo."

# ── Copia file app ─────────────────────────────────────────────────────────────
info "Installazione in: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR/app"
cp -r "$DIST_DIR/." "$INSTALL_DIR/app/"
success "File applicazione copiati"

# ── Script di avvio (usa python3 http.server) ──────────────────────────────────
cat > "$INSTALL_DIR/start.sh" << 'STARTSCRIPT'
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3737

# Controlla se la porta e' gia' in uso
if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[Study Timer] Porta $PORT gia' in uso. Apro il browser sull'istanza esistente."
else
  echo "[Study Timer] Avvio server sulla porta $PORT..."
  cd "$DIR/app"
  python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
  echo $! > "$DIR/.server.pid"
  sleep 0.8
fi

# Apri browser
if command -v open >/dev/null 2>&1; then
  open "http://localhost:$PORT"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:$PORT"
fi

echo "[Study Timer] Apri http://localhost:$PORT nel browser."
echo "[Study Timer] Premi CTRL+C per fermare il server."

# Aspetta il processo server se avviato ora
if [[ -f "$DIR/.server.pid" ]]; then
  wait $(cat "$DIR/.server.pid") 2>/dev/null || true
  rm -f "$DIR/.server.pid"
fi
STARTSCRIPT
chmod +x "$INSTALL_DIR/start.sh"

# ── Script di stop ─────────────────────────────────────────────────────────────
cat > "$INSTALL_DIR/stop.sh" << 'STOPSCRIPT'
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3737
PID=$(lsof -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null)
if [[ -n "$PID" ]]; then
  kill "$PID"
  echo "[Study Timer] Server fermato."
else
  echo "[Study Timer] Nessun server attivo sulla porta $PORT."
fi
rm -f "$DIR/.server.pid"
STOPSCRIPT
chmod +x "$INSTALL_DIR/stop.sh"

# ── Collegamento macOS (cliccabile dal Finder) ─────────────────────────────────
if [[ "$OS_NAME" == "macOS" ]]; then
  APP_CMD="$HOME/Desktop/StudyTimer.command"
  {
    echo "#!/bin/bash"
    echo "\"$INSTALL_DIR/start.sh\""
  } > "$APP_CMD"
  chmod +x "$APP_CMD"
  success "Collegamento creato sul Desktop: StudyTimer.command"

  # Alias in .zshrc / .bash_profile
  SHELL_RC="$HOME/.zshrc"
  [[ -f "$HOME/.bash_profile" && ! -f "$HOME/.zshrc" ]] && SHELL_RC="$HOME/.bash_profile"
  if ! grep -q "study-timer" "$SHELL_RC" 2>/dev/null; then
    {
      echo ""
      echo "# Study Timer"
      echo "alias study-timer='$INSTALL_DIR/start.sh'"
    } >> "$SHELL_RC"
    info "Alias 'study-timer' aggiunto a $SHELL_RC"
  fi
fi

# ── Fine ───────────────────────────────────────────────────────────────────────
echo ""
success "Installazione completata!"
echo ""
echo -e "  Avvio:    ${CYAN}$INSTALL_DIR/start.sh${NC}"
echo -e "  Stop:     ${CYAN}$INSTALL_DIR/stop.sh${NC}"
[[ "$OS_NAME" == "macOS" ]] && echo -e "  Desktop:  ${CYAN}~/Desktop/StudyTimer.command${NC}"
echo -e "  URL:      ${CYAN}http://localhost:3737${NC}"
echo ""
echo -e "  Per installare come PWA, apri l'URL in Chrome/Edge e clicca"
echo -e "  l'icona 'Installa' nella barra degli indirizzi."
echo ""
