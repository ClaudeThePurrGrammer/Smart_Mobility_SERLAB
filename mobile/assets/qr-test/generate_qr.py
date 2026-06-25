"""Genera QR code di test per la scansione veicoli (formato "SM-<id>").

Uso:
    pip install qrcode[pil]
    python generate_qr.py

I PNG vengono salvati nella cartella ./output.
"""
import os

import qrcode

os.makedirs('output', exist_ok=True)
for i in [1, 2, 3, 5, 10, 15, 20]:
    img = qrcode.make(f'SM-{i}')
    img.save(f'output/qr_vehicle_{i}.png')
print("QR codes generated in output/")
