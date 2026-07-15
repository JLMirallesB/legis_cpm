#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera el dataset de calendario escolar para consumo externo (app planificador B).

Salida (estática, servida por GitHub Pages bajo /legis_cpmdem/data/calendario/):
  - public/data/calendario/manifest.json   (schema, versión, cursos, enseñanzas, municipios)
  - public/data/calendario/2026-2027.json  (fechas del curso + festivos locales por municipio)

Todas las fechas se TRANSCRIBEN de la normativa ya ingestada en data/laws/ (no se inventan):
  - resolucion-calendario-escolar-2026-2027  -> inicio/fin por enseñanza, vacaciones, festivos
  - decreto-calendario-laboral-2026 / -2027   -> festivos autonómicos/nacionales
  - resolucion-fiestas-locales-2026           -> festivos locales por municipio (año 2026)

Contrato acordado con la app B (esquema "cev-calendario-escolar"):
  - code = slug estable, único y seguro para clave/URL; name = forma legible (oficial DOGV, va).
  - rangos de vacaciones: start/end INCLUSIVOS (primer y último día NO lectivo).
  - localHolidays por curso: solo las fechas que caen DENTRO del curso.
    Para 2026-2027 -> de fiestas-2026 se toman los festivos de otoño (mes >= 9).
    Cuando se ingeste fiestas-2027, añadir su fuente con meses 1..6 (ver LOCAL_SOURCES).

Ejecutar: python3 scripts/gen-calendario-dataset.py
"""
import json, re, os, unicodedata

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAWS_VA = os.path.join(REPO, "data/laws/va")
OUT_DIR = os.path.join(REPO, "public/data/calendario")
os.makedirs(OUT_DIR, exist_ok=True)

TODAY = "2026-07-15"
SCHEMA = "cev-calendario-escolar"
VERSION = 1
SOURCE_URL = "https://jlmirallesb.github.io/legis_cpmdem/"

# ---------------------------------------------------------------------------
# Slug + title helpers
# ---------------------------------------------------------------------------
def slugify(name):
    s = name.lower().replace("·", "")
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    s = s.replace("’", " ").replace("'", " ").replace("/", " ").replace(",", " ")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")

CONNECTORS_TC = {"de","del","la","les","els","el","lo","d","l","i","en","a","al","dels","des"}
def title_case(name):
    name = name.replace("’", "'")
    out = []
    for idx, w in enumerate(name.split()):
        low = w.lower()
        if re.match(r"^[ld]'$", low):            # lone postposed article  "L'" -> "l'"
            out.append(low); continue
        m = re.match(r"^([ld])'(.+)$", w, flags=re.IGNORECASE)   # "L'ALFAS" -> "L'Alfàs"
        if m:
            pref = m.group(1).upper() if idx == 0 else m.group(1).lower()
            rest = m.group(2)
            out.append(f"{pref}'{rest[:1].upper()}{rest[1:].lower()}"); continue
        if idx != 0 and low in CONNECTORS_TC:
            out.append(low)
        elif "/" in w:
            out.append("/".join(p[:1].upper()+p[1:].lower() for p in w.split("/")))
        else:
            out.append(w[:1].upper()+w[1:].lower())
    return " ".join(out)

# ---------------------------------------------------------------------------
# Date parsing (Valencian prose) -> (day, month)
# ---------------------------------------------------------------------------
MONTHS = {"gener":1,"febrer":2,"març":3,"marc":3,"abril":4,"maig":5,"juny":6,
          "juliol":7,"agost":8,"setembre":9,"octubre":10,"novembre":11,"desembre":12}
MONTH_RE = "|".join(sorted(MONTHS, key=len, reverse=True))
DATE_REMOVE_RE = re.compile(
    r"\d{1,2}(?:\s*(?:i|y)\s*\d{1,2})?\s+(?:de\s+|d['’]\s*)(?:" + MONTH_RE + r")\b",
    flags=re.IGNORECASE)

def norm_dates_text(t):
    t = t.replace("’", "'")
    return re.sub(r"\bd'(?=[aeiouàèéíòóúï])", "de ", t, flags=re.IGNORECASE)

def parse_segment_dates(seg):
    seg = norm_dates_text(seg)
    found = []
    for m in re.finditer(r"(\d{1,2})\s*(?:i|y)\s*(\d{1,2})\s+de\s+(" + MONTH_RE + r")\b", seg, flags=re.IGNORECASE):
        mon = MONTHS[m.group(3).lower()]
        found += [(int(m.group(1)), mon), (int(m.group(2)), mon)]
    seg2 = re.sub(r"(\d{1,2})\s*(?:i|y)\s*(\d{1,2})\s+de\s+(" + MONTH_RE + r")\b", " ", seg, flags=re.IGNORECASE)
    for m in re.finditer(r"(\d{1,2})\s+de\s+(" + MONTH_RE + r")\b", seg2, flags=re.IGNORECASE):
        found.append((int(m.group(1)), MONTHS[m.group(2).lower()]))
    return found

def clean_title(seg):
    t = re.sub(r"\s+", " ", DATE_REMOVE_RE.sub(" ", seg)).strip(" ,.;:·-")
    t = re.sub(r"^(?:i|y)\b[\s,]*", "", t, flags=re.IGNORECASE).strip(" ,.;:")
    t = re.sub(r"^respectivament[\s,]*", "", t, flags=re.IGNORECASE).strip(" ,.;:")
    if not t or t.lower() in ("i", "y"):
        return "Festa local"
    return t[:1].upper() + t[1:]

def festivos_for(text, year, months):
    """Extract [{title,date}] whose month is in `months` (for the given natural year)."""
    res = []
    for seg in re.split(r";", text):
        seg = seg.strip()
        if not seg: continue
        dates = parse_segment_dates(seg)
        if not dates: continue
        title = clean_title(seg)
        for (d, mon) in dates:
            if mon in months:
                res.append({"title": title, "date": f"{year}-{mon:02d}-{d:02d}"})
    return res

# ---------------------------------------------------------------------------
# Read municipios + local festivos from an ingested fiestas-locales law (VA)
# ---------------------------------------------------------------------------
def read_fiestas_law(slug):
    """Return list of (name_raw, festivos_text) from the anexo of a fiestas law."""
    law = json.load(open(os.path.join(LAWS_VA, slug + ".json"), encoding="utf-8"))
    anexo = next(n for n in law["structure"] if n["type"] == "anexo")
    out = []
    for sec in anexo["children"]:
        for para in sec["content"].split("\n\n"):
            m = re.match(r"^\*\*([^:*]+):\*\*\s*(.*)$", para.strip(), flags=re.DOTALL)
            if m:
                out.append((m.group(1).strip(), re.sub(r"\s+", " ", m.group(2)).strip()))
    return out

# Fuentes de festivos locales para el curso 2026-2027:
#   (slug de la ley, año natural, meses a incluir)
# Cuando exista fiestas-locales-2027, añadir: ("resolucion-fiestas-locales-2027", 2027, set(range(1,7)))
LOCAL_SOURCES = [
    ("resolucion-fiestas-locales-2026", 2026, set(range(9, 13))),  # otoño 2026 (sept-dic)
]

municipios, local_holidays, seen = [], {}, {}
for law_slug, year, months in LOCAL_SOURCES:
    for name_raw, festivos_text in read_fiestas_law(law_slug):
        name = title_case(name_raw)
        slug = slugify(name_raw)
        if not slug:
            continue
        if slug not in seen:
            seen[slug] = name
            municipios.append({"code": slug, "name": name})
        elif seen[slug] != name:            # colisión real de slug -> desambiguar
            base, n = slug, 2
            while f"{base}-{n}" in seen: n += 1
            slug = f"{base}-{n}"
            seen[slug] = name
            municipios.append({"code": slug, "name": name})
        fest = festivos_for(festivos_text, year, months)
        if fest:
            local_holidays.setdefault(slug, []).extend(fest)

# orden estable de festivos por fecha dentro de cada municipio
for k in local_holidays:
    local_holidays[k].sort(key=lambda e: e["date"])

assert len({m["code"] for m in municipios}) == len(municipios), "colisión de slug"

# ---------------------------------------------------------------------------
# Datos del curso, transcritos de resolucion-calendario-escolar-2026-2027
# (apartado 1: inicio/fin por enseñanza; apartado 4: vacaciones; apartado 5: festivos)
# + decretos calendario laboral 2026/2027 (festivos autonómicos/nacionales, deduplicados).
# ---------------------------------------------------------------------------
DEFAULT_START, DEFAULT_END = "2026-09-09", "2027-06-18"
ensenyances = [
    {"code": "infantil_primaria", "name": "Educació Infantil i Primària"},
    {"code": "eso_batxillerat",   "name": "ESO i Batxillerat"},
    {"code": "fp",                "name": "Formació Professional (bàsica, mitjà i superior)"},
    {"code": "adults",            "name": "Formació de Persones Adultes"},
    {"code": "musica_dansa",      "name": "Ensenyances de Música i Dansa (elementals i professionals)"},
    {"code": "arts_plastiques",   "name": "Ensenyances professionals d'Arts Plàstiques i Disseny"},
    {"code": "esportives",        "name": "Ensenyances esportives de règim especial"},
    {"code": "idiomes",           "name": "Ensenyances d'Idiomes"},
]
ensenyance_overrides = {
    "adults":          {"courseStart": "2026-09-14", "courseEnd": "2027-06-11"},
    "musica_dansa":    {"courseStart": "2026-09-14", "courseEnd": "2027-06-11"},
    "arts_plastiques": {"courseStart": "2026-09-14", "courseEnd": "2027-06-11"},
    "esportives":      {"courseStart": "2026-09-21"},
    "idiomes":         {"courseStart": "2026-09-28"},
}
vacations = [
    {"title": "Nadal",  "start": "2026-12-22", "end": "2027-01-06"},
    {"title": "Pasqua", "start": "2027-03-25", "end": "2027-04-05"},
]
# Festivos escolares (apartado 5) + laborales (decrets), deduplicados por fecha y
# excluidos los que caen dentro de un rango de vacaciones (para no duplicar cómputo).
autonomic_holidays = [
    {"title": "9 d'Octubre — Dia de la Comunitat Valenciana", "date": "2026-10-09"},
    {"title": "Festa Nacional d'Espanya",                     "date": "2026-10-12"},
    {"title": "Immaculada Concepció",                         "date": "2026-12-08"},
    {"title": "Sant Josep",                                   "date": "2027-03-19"},
    {"title": "Festa del Treball",                            "date": "2027-05-01"},
]
# Días no lectivos de libre disposición local (hasta 3): los fija cada consejo escolar
# municipal y NO se publican en el DOGV -> no disponibles en este repo.
non_lective_days = []

# ---------------------------------------------------------------------------
manifest = {
    "schema": SCHEMA, "version": VERSION, "updated": TODAY, "source": SOURCE_URL,
    "courses": ["2026-2027"],
    "ensenyances": ensenyances,
    "municipios": municipios,
}
course = {
    "schema": SCHEMA, "version": VERSION, "course": "2026-2027",
    "courseStart": DEFAULT_START, "courseEnd": DEFAULT_END,
    "ensenyanceOverrides": ensenyance_overrides,
    "vacations": vacations,
    "autonomicHolidays": autonomic_holidays,
    "nonLectiveDays": non_lective_days,
    "localHolidays": local_holidays,
}
with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2); f.write("\n")
with open(os.path.join(OUT_DIR, "2026-2027.json"), "w", encoding="utf-8") as f:
    json.dump(course, f, ensure_ascii=False, indent=2); f.write("\n")

print(f"municipios: {len(municipios)}")
print(f"municipios con festivos en el curso: {len(local_holidays)}")
print(f"festivos locales totales: {sum(len(v) for v in local_holidays.values())}")
