# 🛴 Smart Mobility — Gruppo C--

> Progetto d'esame per il corso di **Ingegneria del Software** — A.A. 2025/2026  
> Università degli Studi di Bari Aldo Moro — CdL ITPS

**Team:**  
Andriani Chiara · Andriani Claudio · Azzollini Vito · Campi Mattia

---

## Indice

1. [Descrizione del Progetto](#1-descrizione-del-progetto)
2. [Architettura del Sistema](#2-architettura-del-sistema)
3. [Stack Tecnologico](#3-stack-tecnologico)
4. [Confronto Documentazione ↔ Implementazione](#4-confronto-documentazione--implementazione)
   - [Product Backlog — Item Funzionali](#41-product-backlog--item-funzionali)
   - [Use Cases (CU-01 → CU-35)](#42-use-cases-cu-01--cu-35)
5. [Struttura del Progetto](#5-struttura-del-progetto)
6. [Installazione e Avvio](#6-installazione-e-avvio)
7. [Reset del Database](#7-reset-del-database)
8. [Credenziali di Default](#8-credenziali-di-default)
9. [Repository GitHub](#9-repository-github)

---

## 1. Descrizione del Progetto

Smart Mobility è una piattaforma di **sharing della mobilità urbana** che integra servizi di bike sharing, car sharing ed e-scooter sharing. Il sistema permette agli utenti di trovare, prenotare, sbloccare e pagare i mezzi tramite app mobile, mentre operatori e amministrazione pubblica monitorano e gestiscono la flotta e i dati di mobilità tramite dashboard web dedicata.

Il contesto di riferimento è il **Comune di Zootropolis** (simulato su Bari per il prototipo), con 22 aree di parcheggio e una flotta di 60 veicoli (bici, monopattini, auto).

---

## 2. Architettura del Sistema

Il sistema segue il pattern **MVC (Model-View-Controller)** su tre livelli distinti:

```
┌──────────────────────────────────────────────────────────────┐
│                          VIEW                                │
│  ┌──────────────────┐  ┌───────────────────────────────────┐ │
│  │  VistaUtente     │  │  VistaOperatore / VistaAmm.       │ │
│  │  (React Native / │  │  (React + Vite, porta 5173)       │ │
│  │   Expo SDK 54)   │  │  FormAutenticazione               │ │
│  │                  │  │  ComponenteMappa                  │ │
│  └────────┬─────────┘  └────────────┬──────────────────────┘ │
└───────────┼────────────────────────┼───────────────────────--┘
            │  REST API / WebSocket  │
┌───────────┼────────────────────────┼────────────────────────┐
│           ▼       CONTROLLER       ▼                        │
│  FastAPI (Python 3.12) — porta 8000                         │
│  GestioneMezzi · GestionePrenotazioni · GestioneCorsa       │
│  GestionePagamenti · GestioneUtenti · GestioneSegnalazioni  │
│  GestioneOperatore · GestioneAmministrazione                │
│  GestioneRestrizioni · GestionePercorsi · GestioneRealtà    │
└─────────────────────────┬───────────────────────────────────┘
                          │  SQLAlchemy ORM
┌─────────────────────────▼────────────────────────────────---┐
│                        MODEL                                │
│  PostgreSQL 15 — tabelle: Utente, Mezzo, Prenotazione,      │
│  Pagamento, Percorso, Corsa, Segnalazione, Promozione,      │
│  AreaRestrizione, Operatore, AmministrazionePubblica,       │
│  Mezzo_AreaRestrizione                                      │
└─────────────────────────────────────────────────────────────┘
```

**Interfacce esterne:** Maps API (Nominatim + OSRM), Payments Provider (simulato).

---

## 3. Stack Tecnologico

| Livello | Tecnologia |
|---|---|
| **Mobile (VIEW Utente)** | React Native 0.81 · Expo SDK 54 · TypeScript · Expo Router v6 (file-based routing) |
| **Dashboard (VIEW Op./Amm.)** | React 19 · Vite 6 · TypeScript · Porta 5173 |
| **Backend (CONTROLLER)** | Python 3.12 · FastAPI · SQLAlchemy 2 · Pydantic v2 · Uvicorn |
| **Database (MODEL)** | PostgreSQL 15 |
| **Real-time** | WebSocket (FastAPI WebSocket router) |
| **Autenticazione** | JWT (python-jose) · SecureStore (mobile) |
| **Mappe** | react-native-maps · Nominatim (geocoding) · OSRM (routing) |
| **Container** | Docker + Docker Compose |
| **Versioning** | SVN (Redmine) + GitHub |

---

## 4. Confronto Documentazione ↔ Implementazione

### 4.1 Product Backlog — Item Funzionali

La documentazione (v6.0) specifica **35 Item Funzionali** distribuiti su tre ruoli. La tabella seguente mostra il grado di implementazione nel codice.

#### Utenti (UT.01 – UT.18)

| ID | Titolo | Stato | Componente implementato |
|---|---|---|---|
| UT.01 | Visualizzazione mappa mezzi disponibili | ✅ Implementato | `(app)/index.tsx` · `vehicles.py` |
| UT.02 | Prenotazione di un mezzo | ✅ Implementato | `(app)/reserve.tsx` · `(app)/active-reservation.tsx` · `reservations.py` |
| UT.03 | Ricerca destinazione | ✅ Implementato | `(app)/search.tsx` · `geo.py` (Nominatim) |
| UT.04 | Stima del costo del viaggio | ✅ Implementato | `(app)/search.tsx` (calcolo client-side su distanza) |
| UT.05 | Termine corsa | ✅ Implementato | `(app)/end-ride.tsx` · `rides.py` |
| UT.06 | Percorso ottimale in tempo reale | ✅ Implementato | `(app)/search.tsx` · `(app)/active-ride.tsx` (OSRM routing) |
| UT.07 | Suggerimento mezzo più adatto | ✅ Implementato | `(app)/search.tsx` (filtro autonomia + distanza) |
| UT.08 | Visualizzazione e applicazione promozioni | ✅ Implementato | `(app)/promotions.tsx` · `promotions.py` |
| UT.09 | Chat con il servizio clienti | ✅ Implementato | `(app)/chat-support.tsx` · `(app)/support.tsx` · `messages.py` |
| UT.10 | Login nel profilo | ✅ Implementato | `(auth)/login.tsx` · `auth.py` (JWT) |
| UT.11 | Visualizzazione stato di carica | ✅ Implementato | `(app)/index.tsx` (pannello dettaglio mezzo) · `vehicles.py` |
| UT.12 | Sblocco mezzo tramite QR code o app | ✅ Implementato | `(app)/scan.tsx` · `(app)/activate.tsx` · `vehicles.py` |
| UT.13 | Gestione metodo di pagamento | ✅ Implementato | `(app)/wallet.tsx` · `wallet.py` |
| UT.14 | Pausa corsa | ✅ Implementato | `(app)/active-ride.tsx` · `rides.py` (pausa con timer accumulato) |
| UT.15 | Creazione profilo utente | ✅ Implementato | `(auth)/register.tsx` · `auth.py` |
| UT.16 | Visualizzazione aree non accessibili | ✅ Implementato | `(app)/index.tsx` (overlay mappa) · `restrizioni.py` |
| UT.17 | Segnalazione problematiche percorso | ✅ Implementato | `(app)/report.tsx` · `(app)/reports-history.tsx` · `segnalazioni.py` |
| UT.18 | Pagamento corsa | ✅ Implementato | `(app)/ride-payment.tsx` · `(app)/payment-receipt.tsx` · `payment.py` |

#### Amministrazione Pubblica (AP.01 – AP.07)

| ID | Titolo | Stato | Componente implementato |
|---|---|---|---|
| AP.01 | Monitoraggio frequenza utilizzo mezzi | ✅ Implementato | `(admin)/monitoraggio.tsx` · `amministrazione.py` |
| AP.02 | Segnalazione manutenzioni urbane | ✅ Implementato | `(admin)/segnala-zona.tsx` · `(admin)/segna-zona.tsx` |
| AP.03 | Tratte più utilizzate | ✅ Implementato | `(admin)/tratte-piu-utilizzate.tsx` · `amministrazione.py` |
| AP.04 | Configurazione aree con restrizioni | ✅ Implementato | `(admin)/inserisci-area-restrizione.tsx` · `restrizioni.py` |
| AP.05 | Report aggregati sulla mobilità | ✅ Implementato | `(admin)/report-mobilita.tsx` · `amministrazione.py` |
| AP.06 | Registrazione Amministrazione | ✅ Implementato | `(auth)/register.tsx` (role=AMMINISTRAZIONE) · `auth.py` |
| AP.07 | Login Amministrazione | ✅ Implementato | `(auth)/login.tsx` · `auth.py` (ruolo rilevato da JWT) |

#### Operatore del Servizio (OP.01 – OP.10)

| ID | Titolo | Stato | Componente implementato |
|---|---|---|---|
| OP.01 | Registrazione Operatore | ✅ Implementato | `(auth)/register.tsx` (role=OPERATORE) · `auth.py` |
| OP.02 | Notifiche aree a diversa disponibilità | ✅ Implementato | `(operatore)/disponibilita-aree.tsx` · `operatore.py` (soglie VUOTA/CRITICA/OK/PIENA) |
| OP.03 | Conoscenza malfunzionamenti mezzi | ✅ Implementato | `(operatore)/malfunzionamenti-mezzi.tsx` · `segnalazioni.py` |
| OP.04 | Posizione mezzo a fine corsa | ✅ Implementato | `(operatore)/mezzi-fine-corsa.tsx` · `operatore.py` |
| OP.05 | Tracciamento posizione in tempo reale | ✅ Implementato | `(operatore)/tracciamento-mezzi.tsx` · `realtime.py` (WebSocket) |
| OP.06 | Chiusura segnalazione | ✅ Implementato | `(operatore)/chiudi-segnalazioni.tsx` · `(operatore)/segnalazione-dettaglio.tsx` · `segnalazioni.py` |
| OP.07 | Assegnazione automatica bonus | ✅ Implementato | `(operatore)/assegna-bonus.tsx` · `operatore.py` |
| OP.08 | Sospensione o blocco account utente | ✅ Implementato | `(operatore)/blocco-utenti.tsx` · `operatore.py` (auto-logout su account bloccato) |
| OP.09 | Blocco remoto mezzo | ✅ Implementato | `(operatore)/blocco-remoto.tsx` · `operatore.py` (`locked=True/False`) |
| OP.10 | Login Operatore | ✅ Implementato | `(auth)/login.tsx` · `auth.py` (ruolo OPERATORE da JWT) |

> **Copertura totale: 35/35 Item Funzionali implementati (100%)**

---

### 4.2 Use Cases (CU-01 → CU-35)

La documentazione specifica 35 casi d'uso con sequenze principali, sequenze alternative e pre/post-condizioni. La tabella seguente mappa ogni CU ai moduli implementati.

| CU | Nome | Attori | Implementazione |
|---|---|---|---|
| **CU-01** | Creazione profilo utente | Utente | `register.tsx` → `POST /auth/register` |
| **CU-02** | Visualizzazione mappa mezzi disponibili | Utente, Maps API | `index.tsx` → `GET /vehicles` (spawn-near-user logic) |
| **CU-03** | Prenotazione di un mezzo | Utente | `reserve.tsx` → `POST /reservations` · timer scadenza |
| **CU-04** | Sblocco mezzo tramite QR code o app | Utente | `scan.tsx` + `activate.tsx` → `POST /vehicles/{id}/unlock` |
| **CU-05** | Termine corsa e visualizzazione costo | Utente, Maps API | `end-ride.tsx` → `POST /rides/{id}/end` · verifica area parcheggio |
| **CU-06** | Cerca destinazione | Utente, Maps API | `search.tsx` → `GET /geo/search` (Nominatim autocomplete) |
| **CU-07** | Calcola stima costo | Utente, Maps API | `search.tsx` (calcolo client-side distanza × tariffa/km) |
| **CU-08** | Percorso più veloce in real time | Utente, Maps API | `search.tsx` + `active-ride.tsx` → OSRM routing API |
| **CU-09** | Visualizza mezzo idoneo | Utente | `search.tsx` (filtro autonomia vs distanza stimata) |
| **CU-10** | Visualizzazione e applicazione promozioni | Utente | `promotions.tsx` → `GET /promotions` · applicazione a corsa |
| **CU-11** | Chat con il servizio clienti | Utente | `chat-support.tsx` → `GET/POST /messages` |
| **CU-12** | Login utente | Utente | `login.tsx` → `POST /auth/login` (JWT) |
| **CU-13** | Visualizzazione stato di carica | Utente | `index.tsx` (pannello dettaglio mezzo, campo `battery_level`) |
| **CU-14** | Pausa corsa | Utente | `active-ride.tsx` → `POST /rides/{id}/pause` · `POST /rides/{id}/resume` |
| **CU-15** | Gestione metodo di pagamento | Utente | `wallet.tsx` → `GET/POST/DELETE /wallet/cards` |
| **CU-16** | Visualizzazione aree non accessibili | Utente | `index.tsx` (overlay poligoni) → `GET /restrizioni` |
| **CU-17** | Segnalazione problematiche percorso | Utente | `report.tsx` → `POST /segnalazioni` · `reports-history.tsx` |
| **CU-18** | Pagamento corsa | Utente | `ride-payment.tsx` → `POST /payment/ride` · `payment-receipt.tsx` |
| **CU-19** | Monitoraggio frequenza utilizzo mezzi | Amministrazione | `(admin)/monitoraggio.tsx` → `GET /amministrazione/stats` |
| **CU-20** | Segnalazione manutenzioni urbane | Amministrazione | `(admin)/segnala-zona.tsx` · `(admin)/segna-zona.tsx` |
| **CU-21** | Tratte più utilizzate | Amministrazione | `(admin)/tratte-piu-utilizzate.tsx` → `GET /amministrazione/tratte` |
| **CU-22** | Configurazione aree con restrizioni | Amministrazione | `(admin)/inserisci-area-restrizione.tsx` → `POST /restrizioni` |
| **CU-23** | Report aggregati sulla mobilità | Amministrazione | `(admin)/report-mobilita.tsx` → `GET /amministrazione/report` |
| **CU-24** | Registrazione Amministrazione Pubblica | Amministrazione | `register.tsx` (role=AMMINISTRAZIONE) → `POST /auth/register` |
| **CU-25** | Login Amministrazione Pubblica | Amministrazione | `login.tsx` → `POST /auth/login` (role check JWT) |
| **CU-26** | Registrazione Operatore | Operatore | `register.tsx` (role=OPERATORE) → `POST /auth/register` |
| **CU-27** | Login Operatore | Operatore | `login.tsx` → `POST /auth/login` (role check JWT) |
| **CU-28** | Blocco remoto mezzo | Operatore | `(operatore)/blocco-remoto.tsx` → `POST /operatore/mezzi/{id}/blocco` + `VistaOperatore.tsx` |
| **CU-29** | Notifiche aree a diversa disponibilità | Operatore | `(operatore)/disponibilita-aree.tsx` → `GET /operatore/aree-densita` (VUOTA/CRITICA/OK/PIENA) |
| **CU-30** | Conoscenza malfunzionamenti mezzi | Operatore | `(operatore)/malfunzionamenti-mezzi.tsx` → `GET /segnalazioni` (filtro stato=aperta) |
| **CU-31** | Posizione mezzo a fine corsa | Operatore | `(operatore)/mezzi-fine-corsa.tsx` → `GET /operatore/mezzi-rilascio` |
| **CU-32** | Tracciamento posizione in tempo reale | Operatore | `(operatore)/tracciamento-mezzi.tsx` → WebSocket `/realtime/ws` |
| **CU-33** | Chiusura segnalazione | Operatore | `(operatore)/chiudi-segnalazioni.tsx` → `PATCH /segnalazioni/{id}` (stato=chiusa) |
| **CU-34** | Assegnazione automatica bonus | Operatore | `(operatore)/assegna-bonus.tsx` → `POST /operatore/bonus` |
| **CU-35** | Sospensione o blocco account utente | Operatore | `(operatore)/blocco-utenti.tsx` → `PATCH /operatore/utenti/{id}/stato` · auto-logout 403 |

> **Copertura Use Cases: 35/35 (100%)**

#### Note sull'implementazione

- **Spawn-near-user logic (CU-02):** se l'utente ha meno di 12 veicoli entro ~1,2 km, il sistema sposta automaticamente veicoli parcheggiati nelle 8 aree di parcheggio più vicine all'utente.
- **Auto-logout su blocco account (CU-35):** il backend risponde HTTP 403 quando un utente bloccato/sospeso fa qualsiasi richiesta autenticata. Il client mobile intercetta globalmente il 403 ed esegue il logout immediato.
- **Disponibilità Aree (CU-29):** soglie — `0 veicoli = VUOTA 🔴`, `1-2 = CRITICA 🟡`, `3-5 = OK 🟢`, `≥6 = PIENA 🔵`.
- **Blocco remoto mezzo (CU-28):** i veicoli bloccati (`locked=True`) sono esclusi dalla mappa utenti ma visibili all'operatore nella sezione "Mezzi a fine corsa".
- **WebSocket real-time (CU-32):** aggiornamento continuo della posizione dei mezzi in corsa tramite `/realtime/ws`.

---

## 5. Struttura del Progetto

```
Smart_Mobility_SERLAB/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan, CORS, router registration
│   │   ├── models.py            # SQLAlchemy ORM models (MODEL layer)
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── database.py          # Engine, SessionLocal, wait_for_db
│   │   ├── deps.py              # get_current_user, require_role
│   │   ├── security.py          # JWT encode/decode, password hashing
│   │   ├── seed.py              # Seed: 60 veicoli, 22 aree di Bari, utenti demo
│   │   └── routers/
│   │       ├── auth.py          # Registrazione, login, JWT
│   │       ├── users.py         # Profilo utente, impostazioni
│   │       ├── vehicles.py      # Flotta, sblocco, spawn-near-user
│   │       ├── rides.py         # Corsa, pausa, fine corsa
│   │       ├── reservations.py  # Prenotazioni con timer scadenza
│   │       ├── parking.py       # Aree di parcheggio
│   │       ├── payment.py       # Pagamenti corsa
│   │       ├── wallet.py        # Metodi di pagamento utente
│   │       ├── promotions.py    # Promozioni e coupon
│   │       ├── messages.py      # Chat supporto clienti
│   │       ├── segnalazioni.py  # Segnalazioni utenti/admin
│   │       ├── restrizioni.py   # Aree di restrizione
│   │       ├── geo.py           # Geocoding (Nominatim)
│   │       ├── reports.py       # Report corsa
│   │       ├── operatore.py     # Funzionalità operatore (blocchi, aree, bonus)
│   │       ├── amministrazione.py # Funzionalità amministrazione
│   │       └── realtime.py      # WebSocket tracciamento real-time
│   └── Dockerfile
├── mobile/
│   └── app/
│       ├── (auth)/              # Login, Register, Forgot Password
│       ├── (app)/               # Schermate utente principale
│       ├── (operatore)/         # Schermate operatore
│       └── (admin)/             # Schermate amministrazione
├── dashboard/
│   └── src/
│       ├── pages/
│       │   ├── VistaOperatore.tsx
│       │   ├── VistaAmministrazione.tsx
│       │   └── FormAutenticazione.tsx
│       └── components/
│           ├── ComponenteMappa.tsx
│           └── Layout.tsx
└── docker-compose.yml
```

---

## 6. Installazione e Avvio

### Prerequisiti

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (con Docker Compose v2)
- [Node.js 20+](https://nodejs.org/) e npm
- [Expo Go](https://expo.dev/go) sul dispositivo mobile (iOS o Android)

### Passo 1 — Clona il repository

```bash
git clone https://github.com/ClaudeThePurrGrammer/Smart_Mobility_SERLAB.git
cd Smart_Mobility_SERLAB
```

### Passo 2 — Configura le variabili d'ambiente

Crea un file `.env` nella root del progetto:

```env
# Indirizzo IP della macchina host (necessario per Expo Go su LAN)
HOST_IP=<il-tuo-ip-locale>   # es. 192.168.1.10

# Segreto JWT (cambia in produzione)
JWT_SECRET=changeme
```

Per trovare il tuo IP locale:
- **Windows:** `ipconfig` → IPv4 Address
- **macOS/Linux:** `ifconfig` oppure `ip a`

### Passo 3 — Avvia il Backend (API + Database)

```bash
docker compose up --build backend db -d
```

Il backend sarà disponibile su `http://localhost:8000`. La documentazione API interattiva è su `http://localhost:8000/docs`.

> Al primo avvio il database viene popolato automaticamente con 60 veicoli, 22 aree di parcheggio di Bari, e gli account demo.

### Passo 4 — Avvia la Dashboard Web (Operatore / Amministrazione)

```bash
docker compose up --build dashboard -d
```

La dashboard è disponibile su `http://localhost:5173`.

### Passo 5 — Avvia l'App Mobile

L'app mobile viene avviata **fuori da Docker** per compatibilità con Expo Go:

```bash
cd mobile
npm install
npx expo start --lan --clear
```

Scansiona il QR code con **Expo Go** (Android) o con la fotocamera (iOS).

> Assicurati che il dispositivo mobile e il PC siano sulla **stessa rete Wi-Fi**.

### Riepilogo servizi

| Servizio | URL | Note |
|---|---|---|
| Backend API | `http://localhost:8000` | |
| Swagger UI | `http://localhost:8000/docs` | Documentazione interattiva |
| Dashboard | `http://localhost:5173` | Login con account operatore/amm. |
| App Mobile | QR code nel terminale | Expo Go |

---

## 7. Reset del Database

Per ripartire da zero (cancella tutti i dati e ri-esegue il seed):

```bash
docker compose down -v
docker compose up --build backend db -d
```

---

## 8. Credenziali di Default

Dopo il seed iniziale sono disponibili i seguenti account demo:

| Ruolo | Email | Password |
|---|---|---|
| Utente | `demo@smartmobility.it` | `password123` |
| Operatore | `operatore@smartmobility.it` | `operatore123` |
| Amministrazione | `admin@smartmobility.it` | `admin123` |

> ⚠️ Queste credenziali sono solo per ambienti di sviluppo e test.

---

## 9. Repository GitHub

Il codice sorgente completo è disponibile su:

**🔗 https://github.com/ClaudeThePurrGrammer/Smart_Mobility_SERLAB**

Se questo progetto ti è stato utile o hai trovato interessante il lavoro svolto,  
considera di **lasciare una ⭐ Star** sulla repository — è un piccolo gesto che significa molto per il team! 😊

---

<div align="center">

*Progetto realizzato per il corso di Ingegneria del Software — A.A. 2025/2026*  
*Università degli Studi di Bari Aldo Moro*

**Andriani Chiara · Andriani Claudio · Azzollini Vito · Campi Mattia**

</div>
