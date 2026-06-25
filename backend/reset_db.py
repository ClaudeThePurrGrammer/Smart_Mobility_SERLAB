"""Script per azzerare il DB e rigenerare i dati seed.

Mantiene veicoli, parcheggi, promozioni e aree di restrizione.
Cancella tutti gli utenti, corse, transazioni, messaggi.
Poi ricrea l'utente demo: claudio@smartmobility.it / password123

Uso (con Docker):
  docker exec smart_mobility_api python reset_db.py

Uso (locale, dalla cartella backend/):
  python reset_db.py
"""
import sys
import os

# Permette di eseguire lo script sia da backend/ che da root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.seed import reset_and_reseed

if __name__ == "__main__":
    print("[reset_db] Avvio reset database...")
    with SessionLocal() as db:
        reset_and_reseed(db)
    print("[reset_db] Completato.")
