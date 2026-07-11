======================================================
  STUDY TIMER — Istruzioni di installazione
======================================================

INSTALLAZIONE GUIDATA (consigliata)
------------------------------------
  Apri nel browser il file:
     installer/index.html

  La pagina rileva automaticamente il tuo sistema
  operativo, mostra le istruzioni passo-passo e
  permette di scaricare lo script di installazione
  con un clic. Non serve nessun server: basta
  aprire il file HTML direttamente dal Finder o
  da Esplora Risorse.

------------------------------------------------------
  PREREQUISITI
------------------------------------------------------

  macOS:   NESSUNO — python3 e' gia' incluso nel
           sistema operativo.

  Windows: Node.js 18 o superiore
           https://nodejs.org

------------------------------------------------------
  INSTALLAZIONE MANUALE su macOS
------------------------------------------------------

1. Aprire il Terminale
     (Cmd+Spazio → digita "Terminale" → Invio)

2. Navigare nella cartella del progetto:
     cd /percorso/study-timer

3. Lanciare lo script:
     bash installer/install.sh

4. Premere Invio per confermare la cartella di
   destinazione (default: ~/Applications/StudyTimer)

5. Al termine viene creato automaticamente:
     - Icona cliccabile sul Desktop: StudyTimer.command
     - Alias nel Terminale: study-timer
     - Script di avvio:  <cartella>/start.sh
     - Script di stop:   <cartella>/stop.sh

AVVIO:
  Doppio clic su StudyTimer.command dal Desktop
  oppure dal Terminale:
     ~/Applications/StudyTimer/start.sh

  Nota: se macOS mostra "impossibile aprire",
  vai in Impostazioni → Privacy e sicurezza
  e clicca "Apri comunque".

STOP:
     ~/Applications/StudyTimer/stop.sh

------------------------------------------------------
  INSTALLAZIONE MANUALE su Windows
------------------------------------------------------

1. Aprire il Prompt dei comandi (cmd)
2. Navigare nella cartella del progetto:
     cd C:\percorso\study-timer
3. Eseguire lo script:
     installer\install.bat
4. Al termine viene creato:
     - Collegamento sul Desktop: StudyTimer
     - Script di avvio: <cartella>\start.bat

------------------------------------------------------
  PORTABILITA'
------------------------------------------------------

  Per spostare l'app su un altro computer basta
  copiare l'intera cartella del progetto (inclusa
  la cartella dist/) su chiavetta USB, AirDrop o
  come archivio zip.

  Su macOS non e' necessario installare nulla:
  aprire installer/index.html nel browser, scaricare
  lo script e seguire le istruzioni.

------------------------------------------------------
  INSTALLAZIONE COME APP (PWA)
------------------------------------------------------

  Una volta avviato il server, aprire:
    http://localhost:3737

  In Chrome / Edge:
    - Cliccare l'icona "Installa" nella barra
      degli indirizzi
    - Oppure menu ... > "Installa Study Timer"
    - L'app appare nel Launchpad / menu Start

  In Safari (macOS):
    - Menu Condividi > "Aggiungi alla Scrivania"

======================================================
  NOTE
======================================================

  - I dati sono salvati localmente nel browser
    (DuckDB + localStorage).
    Non vengono inviati a nessun server esterno.

  - Il server usa la porta 3737.
    Modificarla nel file start.sh / start.bat
    se necessario.

  - Per aggiornare: sostituire la cartella dist/
    con la nuova versione e rieseguire lo script.

======================================================
