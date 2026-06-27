from app.database import engine
from sqlalchemy import text
with engine.connect() as c:
    for r in c.execute(text('SELECT id, name, type FROM vehicles ORDER BY id')):
        print(f'SM-{r[0]}  {r[1]}  ({r[2]})')
