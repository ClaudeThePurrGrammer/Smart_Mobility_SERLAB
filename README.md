# SMART Mobility

> Piattaforma integrata di smart mobility urbana per la città di Zootropolis.  
> Progetto del corso di **Ingegneria del Software** — A.A. 2025/2026.

![Status](https://img.shields.io/badge/status-in%20sviluppo-yellow)
![Version](https://img.shields.io/badge/version-2.0-blue)
![Methodology](https://img.shields.io/badge/methodology-Scrum-orange)
![Architecture](https://img.shields.io/badge/architecture-MVC-green)
![Sprint](https://img.shields.io/badge/sprint-1-purple)

---

## Indice

- [Descrizione](#descrizione)
- [Avvio rapido della demo](#avvio-rapido-della-demo)
- [Struttura della repository](#struttura-della-repository)
- [Schermate implementate](#schermate-implementate)
- [Changelog Sprint 1](#changelog-sprint-1)
- [Contesto di business](#contesto-di-business)
- [Stakeholder](#stakeholder)
- [Funzionalità principali](#funzionalità-principali)
- [Architettura](#architettura)
- [Requisiti non funzionali](#requisiti-non-funzionali)
- [Metodologia](#metodologia)
- [Team](#team----gruppo-c--)
- [Licenza](#licenza)

---

## Descrizione

**SMART Mobility** è una piattaforma di mobilità sostenibile che integra diversi servizi di sharing urbano — *bike sharing*, *car sharing*, *e-scooter sharing* — in un'unica applicazione. Il sistema permette agli utenti di **trovare**, **prenotare**, **utilizzare** e **pagare** i mezzi in modo trasparente, mentre offre a operatori e Pubblica Amministrazione gli strumenti per **monitorare** e **gestire** la flotta e i dati di mobilità urbana.

---

## Avvio rapido della demo

### Prerequisiti

| Strumento | Versione minima | Note |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Expo Go | ultima | App su [iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent) |
| Docker + Compose | 24+ | Solo per avvio containerizzato |

---

### Metodo 1 — Locale (consigliato per sviluppo)

```bash
# 1. Entra nella cartella mobile
cd mobile

# 2. Installa le dipendenze (solo la prima volta)
npm install

# 3. Avvia il Metro bundler
npx expo start --clear
```

Scansiona il **QR code** mostrato in console con Expo Go (iOS: fotocamera di sistema, Android: app Expo Go).

Se il telefono è su una rete diversa dal PC (es. hotspot), usa:

```bash
# Sostituisci con l'IP del tuo PC (ipconfig su Windows)
set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.x.x
npx expo start --lan --clear
```

---

### Metodo 2 — Container Docker

Questa modalità avvia il Metro bundler in un container isolato, pronta ad essere estesa con backend e database negli sprint successivi.

**1. Configura l'IP host**

```bash
# Copia il file di esempio
cp .env.example .env

# Apri .env e imposta HOST_IP con l'IP della tua macchina
# Windows → ipconfig | macOS/Linux → ifconfig
HOST_IP=192.168.x.x
```

**2. Avvia i container**

```bash
docker compose up --build
```

Il Metro bundler sarà raggiungibile su `http://<HOST_IP>:8081`.  
Apri **Expo Go** sul telefono e scansiona il QR oppure inserisci manualmente `exp://<HOST_IP>:8081`.

**3. Stop**

```bash
docker compose down
```

> **Nota Sprint 2** — I servizi `backend` (FastAPI) e `db` (PostgreSQL) sono già definiti in `docker-compose.yml` ma commentati. Verranno attivati con l'implementazione delle API REST.

---

## Struttura della repository

```
.
├── mobile/                        # App React Native / Expo (Sprint 1 ✅)
│   ├── app/
│   │   ├── _layout.tsx            # Root layout
│   │   ├── index.tsx              # Entry point → redirect auth
│   │   ├── (auth)/
│   │   │   ├── login.tsx          # Schermata login
│   │   │   ├── register.tsx       # Registrazione
│   │   │   └── forgot-password.tsx
│   │   └── (app)/
│   │       ├── _layout.tsx        # Tab bar (5 tab)
│   │       ├── index.tsx          # Home — mappa + bottom sheet
│   │       ├── search.tsx         # Ricerca mezzo / percorso
│   │       ├── scan.tsx           # Scanner QR
│   │       ├── messages.tsx       # Notifiche
│   │       ├── profile.tsx        # Profilo utente
│   │       ├── active-ride.tsx    # Corsa in corso
│   │       ├── end-ride.tsx       # Fine corsa
│   │       ├── ride-history.tsx   # Storico corse
│   │       ├── wallet.tsx         # Portafoglio
│   │       ├── payment.tsx        # Metodi di pagamento
│   │       ├── promotions.tsx     # Promozioni e punti
│   │       ├── settings.tsx       # Impostazioni
│   │       └── report.tsx         # Segnalazione problemi
│   ├── components/ui/             # GradientButton, SocialButton
│   ├── constants/theme.ts         # Palette colori e gradienti
│   ├── assets/                    # Logo, icone, splash
│   └── Dockerfile
├── web/                           # Dashboard React+Vite (Sprint 2 🔜)
├── backend/                       # FastAPI REST + WebSocket (Sprint 2 🔜)
├── docs/                          # Documentazione di progetto
│   ├── product-backlog/
│   ├── sprint-reports/
│   ├── architecture/
│   ├── design/
│   └── glossary.md
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Schermate implementate

| Schermata | Route | User Story |
|---|---|---|
| Login | `/(auth)/login` | UT.01 |
| Registrazione | `/(auth)/register` | UT.01 |
| Password dimenticata | `/(auth)/forgot-password` | UT.01 |
| Home (mappa + bottom sheet) | `/(app)/` | UT.02 |
| Ricerca mezzo / percorso | `/(app)/search` | UT.02, UT.05 |
| Scanner QR | `/(app)/scan` | UT.02 |
| Corsa attiva | `/(app)/active-ride` | UT.02 |
| Fine corsa | `/(app)/end-ride` | UT.02 |
| Storico corse | `/(app)/ride-history` | UT.05 |
| Portafoglio | `/(app)/wallet` | UT.12 |
| Metodi di pagamento | `/(app)/payment` | UT.12 |
| Promozioni e punti | `/(app)/promotions` | UT.13 |
| Notifiche | `/(app)/messages` | UT.15 |
| Profilo utente | `/(app)/profile` | UT.01 |
| Impostazioni | `/(app)/settings` | UT.01 |
| Segnalazione problemi | `/(app)/report` | — |

---

## Changelog Sprint 1

### UI / Design
- **Reskin completo** — palette neon dark (blu `#4F8EF7` → viola `#7C3AED`), sfondo `#08081A`
- **Logo ufficiale** integrato nella schermata di login con glow viola via `shadowColor`
- **Input a pillola** (`borderRadius: 30`) e bordo viola semi-trasparente su login e register
- **Gradient button** aggiornato a blu→viola; aggiunta prop `pill` per variante full-round
- **SocialButton** restyled: sfondo scuro, bordo `rgba(167,139,250,0.25)`, label visibile

### Animazioni
- **Drawer animato** — slide da sinistra (`Animated.timing`, 280 ms apertura / 240 ms chiusura) con fade overlay; implementato con puro `Animated` API (nessuna dipendenza da reanimated)
- **Tab icon glow** — `shadowColor: '#7C3AED'` + `shadowRadius: 10` sul tab attivo; nessun ingrandimento (layout stabile)

### Nuove schermate
- `ride-history.tsx` — storico corse con filtri e stats aggregate
- `promotions.tsx` — promozioni attive, saldo punti, codici sconto
- `wallet.tsx` — saldo, transazioni, collegamento metodi di pagamento
- `settings.tsx` — toggle notifiche, privacy, preferenze, zona pericolo
- `forgot-password.tsx` — reset password con stato di successo animato

### Fix tecnici
- Rimosso `PROVIDER_GOOGLE` da `MapView` (non supportato in Expo Go — richiede EAS Build)
- Sostituito `@gorhom/bottom-sheet` con `Animated.Value` + `PanResponder` (fix crash JSI reanimated)
- Rimosso `nativewind/babel` e `jsxImportSource` da `babel.config.js` (fix `react-native-worklets/plugin` not found)
- Aggiunti `href: null` nel tab layout per nascondere schermate non-tab dalla navigazione

---

## Contesto di business

Il sistema opera in un contesto urbano in cui interagiscono tre attori principali — **Utenti**, **Operatori del servizio** e **Pubblica Amministrazione** — con il supporto di servizi terzi quali provider di pagamento, fornitori cartografici e supporto clienti.

## Stakeholder

| Stakeholder | Ruolo |
|---|---|
| **Utenti** | Utilizzano i mezzi della flotta; richiedono semplicità d'uso e affidabilità. |
| **Operatori** | Gestiscono la flotta, la manutenzione, le segnalazioni e la redistribuzione. |
| **Amministrazione Pubblica** | Monitora la mobilità urbana, configura aree con restrizioni. |
| **Altri** | Provider di pagamento (PCI-DSS), fornitori Maps API, supporto clienti. |

## Funzionalità principali

### Per gli Utenti (IF-C)

- Visualizzazione mappa interattiva con i mezzi disponibili
- Prenotazione, sblocco (QR code o app) e pausa di una corsa
- Ricerca destinazione con calcolo del percorso ottimale in tempo reale
- Stima del costo del viaggio e applicazione di promozioni
- Suggerimento del mezzo più adatto in base a distanza e stato di carica
- Segnalazione di mezzi non funzionanti o problemi sul percorso
- Gestione del profilo utente e dei metodi di pagamento
- Visualizzazione di aree non accessibili (*no-go zones*)

### Per gli Operatori (IF-OP)

- Dashboard di distribuzione della flotta in tempo reale
- Notifiche su squilibri di disponibilità per area
- Tracciamento GPS dei mezzi in corsa e a fine corsa
- Gestione manutenzioni e malfunzionamenti
- Blocco remoto di un mezzo e sospensione/blocco account
- Monitoraggio richieste di assistenza e KPI

### Per l'Amministrazione (IF-AP)

- Monitoraggio frequenza di utilizzo per tipologia di mezzo
- Configurazione di aree con restrizioni (divieti, limiti di velocità)
- Visualizzazione delle tratte più utilizzate (heatmap)
- Generazione di report aggregati in PDF/CSV (GDPR-compliant)

## Architettura

Il sistema adotta il **pattern architetturale MVC** con componenti esterni dedicati:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│     VIEW     │◄──►│  CONTROLLER  │◄──►│    MODEL     │
│ (mobile/web) │    │  (FastAPI)   │    │  (dominio)   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
   Expo Go            REST / WS           PostgreSQL
  React+Vite         JWT Auth             Maps API
```

**Stack tecnico**

| Layer | Tecnologia |
|---|---|
| Mobile | React Native 0.81, Expo SDK 54, expo-router v6 |
| Web dashboard | React + Vite *(Sprint 2)* |
| Backend | FastAPI (Python) *(Sprint 2)* |
| Database | PostgreSQL 16 *(Sprint 2)* |
| Mappe | react-native-maps (Apple Maps / Google Maps) |
| Autenticazione | JWT + OAuth2 (Google, Apple, Facebook) *(Sprint 2)* |
| Real-time | WebSocket (GPS tracking, geofencing) *(Sprint 2)* |
| Container | Docker + Compose |

## Requisiti non funzionali

- **Scalabilità** — supporto di almeno 10.000 utenti concorrenti senza degradazione.
- **Sicurezza & Privacy** — conformità GDPR (UE 2016/679); TLS 1.2+; pagamenti PCI-DSS.
- **Precisione geolocalizzazione** — posizionamento mezzi con accuratezza ±5 m in ambiente urbano.

## Metodologia

Il progetto è gestito secondo **Scrum**, organizzato in sprint successivi:

- **Sprint 0** — Macro-architettura, componenti, interfacce, Product Backlog.
- **Sprint 1** *(corrente)* — Frontend mobile completo: 16 schermate, navigazione, design system, animazioni.
- **Sprint 2** *(pianificato)* — Backend FastAPI, autenticazione JWT/OAuth2, WebSocket GPS, geofencing, dashboard web.

## Team — Gruppo C--

| Membro | Matricola | Email |
|---|---|---|
| Andriani Chiara | 827592 | c.andriani8@studenti.uniba.it |
| Andriani Claudio | 826192 | c.andriani7@studenti.uniba.it |
| Azzollini Vito | 826191 | v.azzollini4@studenti.uniba.it |
| Campi Mattia | 827730 | m.campi1@studenti.uniba.it |

## Licenza

Progetto realizzato a scopo didattico nell'ambito del corso di Ingegneria del Software — Università degli Studi di Bari "Aldo Moro", A.A. 2025/2026.
