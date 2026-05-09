# SMART Mobility

> Piattaforma integrata di smart mobility urbana per la città di Zootropolis.
> Progetto del corso di **Ingegneria del Software** — A.A. 2025/2026.

![Status](https://img.shields.io/badge/status-in%20sviluppo-yellow)
![Version](https://img.shields.io/badge/version-2.0-blue)
![Methodology](https://img.shields.io/badge/methodology-Scrum-orange)
![Architecture](https://img.shields.io/badge/architecture-MVC-green)

---

## Indice

- [Descrizione](#descrizione)
- [Contesto di business](#contesto-di-business)
- [Stakeholder](#stakeholder)
- [Funzionalità principali](#funzionalità-principali)
- [Architettura](#architettura)
- [Requisiti non funzionali](#requisiti-non-funzionali)
- [Struttura della repository](#struttura-della-repository)
- [Metodologia](#metodologia)
- [Team](#team----gruppo-c--)
- [Licenza](#licenza)

---

## Descrizione

**SMART Mobility** è una piattaforma di mobilità sostenibile che integra diversi servizi di sharing urbano — *bike sharing*, *car sharing*, *e-scooter sharing* — in un'unica applicazione. Il sistema permette agli utenti di **trovare**, **prenotare**, **utilizzare** e **pagare** i mezzi in modo trasparente, mentre offre a operatori e Pubblica Amministrazione gli strumenti per **monitorare** e **gestire** la flotta e i dati di mobilità urbana.

La piattaforma nasce dall'esigenza del Comune di Zootropolis di introdurre un ecosistema di mobilità intelligente che riduca traffico e inquinamento, supportando al contempo decisioni strategiche basate su dati aggregati.

## Contesto di business

Il sistema opera in un contesto urbano in cui interagiscono tre attori principali — **Utenti**, **Operatori del servizio** e **Pubblica Amministrazione** — con il supporto di servizi terzi quali provider di pagamento, fornitori cartografici e supporto clienti.

## Stakeholder

| Stakeholder | Ruolo |
|---|---|
| **Utenti** | Utilizzano i mezzi della flotta; richiedono semplicità d'uso e affidabilità del servizio. |
| **Operatori** | Gestiscono la flotta, la manutenzione, le segnalazioni e la redistribuzione dei mezzi. |
| **Amministrazione Pubblica** | Monitora la mobilità urbana, configura le aree con restrizioni e pianifica interventi. |
| **Altri** | Provider di pagamento (PCI-DSS), fornitori di Maps API, supporto clienti. |

## Funzionalità principali

### Per gli Utenti (IF-C)

- Visualizzazione mappa interattiva con i mezzi disponibili
- Prenotazione, sblocco (QR code o app) e pausa di una corsa
- Ricerca destinazione con calcolo del **percorso ottimale in tempo reale**
- Stima del costo del viaggio e applicazione di promozioni
- Suggerimento del mezzo più adatto in base a distanza e stato di carica
- Segnalazione di mezzi non funzionanti o problemi sul percorso
- Gestione del profilo utente e dei metodi di pagamento
- Visualizzazione di aree non accessibili (*no-go zones*)
- Chat con il servizio clienti

### Per gli Operatori (IF-OP)

- Dashboard di distribuzione della flotta in tempo reale
- Notifiche su squilibri di disponibilità per area
- Tracciamento GPS dei mezzi in corsa e a fine corsa
- Gestione manutenzioni e malfunzionamenti
- **Blocco remoto** di un mezzo e sospensione/blocco account
- Monitoraggio richieste di assistenza e KPI
- Controllo prenotazioni attive e assegnazione automatica bonus

### Per l'Amministrazione (IF-AP)

- Monitoraggio frequenza di utilizzo per tipologia di mezzo
- **Configurazione di aree con restrizioni** (divieti, limiti di velocità)
- Visualizzazione delle tratte più utilizzate (heatmap)
- Segnalazione di manutenzioni urbane
- Generazione di **report aggregati** in PDF/CSV (anonimizzati, GDPR-compliant)

## Architettura

Il sistema adotta il **pattern architetturale MVC** (Model-View-Controller) con componenti esterni dedicati:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│     VIEW     │◄──►│  CONTROLLER  │◄──►│    MODEL     │
│ (mobile/web) │    │  (logica)    │    │  (dominio)   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
   Web Server          Payments            DBMS / Maps API
```

**Componenti principali:**

- **View** *(white-box)*: `VistaUtente` (mobile), `VistaOperatore`, `VistaAmministrazione`, `FormAutenticazione`, `ComponenteMappa`.
- **Controller** *(white-box)*: `GestioneMezzi`, `GestionePrenotazioni`, `GestionePercorsi`, `GestionePagamenti`, `GestioneUtenti`, `GestioneSegnalazioni`, `GestioneOperatore`, `GestioneAmministrazione`.
- **Model** *(white-box)*: entità di dominio — `Utente`, `Mezzo`, `Corsa`, `Prenotazione`, `AreaRestrizione`, `Segnalazione`.
- **Componenti esterni** *(black-box)*: `Web Server`, `DBMS`, `Maps API`, `Payments` (PCI-DSS).

## Requisiti non funzionali

- **Scalabilità** — supporto di almeno **10.000 utenti concorrenti** senza degradazione delle prestazioni.
- **Sicurezza & Privacy** — conformità **GDPR** (UE 2016/679); cifratura dei dati a riposo e in transito (**TLS 1.2+**); pagamenti **PCI-DSS**.
- **Precisione geolocalizzazione** — posizionamento dei mezzi con accuratezza **±5 m** in ambiente urbano.

## Struttura della repository

```
.
├── docs/                      # Documentazione di progetto
│   ├── product-backlog/       # Product Backlog e User Stories
│   ├── sprint-reports/        # Sprint Report (Sprint 0, 1, ...)
│   ├── architecture/          # Diagrammi delle componenti
│   ├── design/                # Diagrammi delle classi e di sequenza
│   └── glossary.md            # Glossario di progetto
├── src/                       # Codice sorgente
│   ├── view/                  # Componenti View (MVC)
│   ├── controller/            # Componenti Controller (MVC)
│   └── model/                 # Componenti Model (MVC)
├── tests/                     # Test unitari e di integrazione
├── .gitignore
├── LICENSE
└── README.md
```

## Metodologia

Il progetto è gestito secondo il framework **Scrum**, organizzato in sprint successivi:

- **Sprint 0** — Definizione della macro-architettura del sistema, dei componenti e delle interfacce.
- **Sprint *N*** *(N ≥ 1)* — Ogni sprint produce in output codice funzionante, implementando un sottoinsieme degli item del Product Backlog. Ogni User Story è tracciata 1-a-1 con un caso d'uso, dotato di scenario base, scenari alternativi e diagramma di sequenza.

## Team — Gruppo C--

| Membro | Matricola | Email |
|---|---|---|
| Andriani Chiara | 827592 | c.andriani8@studenti.uniba.it |
| Andriani Claudio | 826192 | c.andriani7@studenti.uniba.it |
| Azzollini Vito | 826191 | v.azzollini4@studenti.uniba.it |
| Campi Mattia | 827730 | m.campi1@studenti.uniba.it |

## Licenza

Progetto realizzato a scopo didattico nell'ambito del corso di Ingegneria del Software — Università degli Studi di Bari "Aldo Moro", A.A. 2025/2026.