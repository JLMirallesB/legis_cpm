#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera el dataset del sorteo público de admisión para consumo externo.

Salida (estática, servida por GitHub Pages bajo /legis_cpmdem/data/sorteo/):
  - public/data/sorteo/manifest.json   (schema, versión, cursos disponibles)
  - public/data/sorteo/2026-2027.json  (letras del sorteo + normas de referencia)

Las letras se EXTRAEN de la normativa ya ingestada en data/laws/ (no se teclean):
  - resolucion-sorteo-admision-{año}  -> artículo «Resultado del sorteo» (letras Q-O / N-W)
  - resolucion-admision-{curso}       -> apartado noveno, que reproduce las mismas letras
                                         para Música y Danza (sirve de comprobación cruzada)

Contrato público del dataset (esquema "cev-sorteo-admision"):
  - letters1 / letters2 = cadena literal «X-Y», tal y como la publica la norma
    (primer apellido / segundo apellido, este último solo si coincide el primero).
  - manifest.courses[] = cursos publicados; el consumidor lee el manifest y pide
    {curso}.json, de modo que no tiene que adivinar el slug de la norma del año siguiente.
  - norm = norma de la que salen las letras (para citarla y enlazarla).
  - appliedBy = normas de Música y Danza que aplican ese sorteo a los conservatorios
    (la resolución del sorteo solo nombra Infantil, Primaria, ESO y Bachillerato).

Ejecutar: python3 scripts/gen-sorteo-dataset.py
"""
import json, os, re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAWS_ES = os.path.join(REPO, "data/laws/es")
LAWS_VA = os.path.join(REPO, "data/laws/va")
OUT_DIR = os.path.join(REPO, "public/data/sorteo")
os.makedirs(OUT_DIR, exist_ok=True)

TODAY = "2026-08-14"
SCHEMA = "cev-sorteo-admision"
VERSION = 1
SITE = "https://jlmirallesb.github.io/legis_cpmdem/"

# Cursos publicados: (curso, slug de la resolución del sorteo,
#                     slug de la convocatoria de admisión de Música y Danza)
COURSES = [
    ("2026-2027", "resolucion-sorteo-admision-2026-2027", "resolucion-admision-2026-2027"),
]
# Norma permanente que ordena aplicar el sorteo general a Música y Danza
STANDING_RULE = ("orden-8-2026", ["art-19"])


# ---------------------------------------------------------------------------
def load(slug, lang="es"):
    base = LAWS_ES if lang == "es" else LAWS_VA
    with open(os.path.join(base, slug + ".json"), encoding="utf-8") as f:
        return json.load(f)


def iter_nodes(law):
    stack = list(law["structure"])
    while stack:
        n = stack.pop(0)
        yield n
        stack = list(n.get("children") or []) + stack


def law_ref(slug):
    """Bloque de referencia a una norma ingestada (bilingüe en títulos y rutas)."""
    es, va = load(slug, "es"), load(slug, "va")
    return {
        "lawId": slug,
        "shortTitle": es["titleShort"],
        "shortTitleVa": va["titleShort"],
        "date": es["date"],
        "dogv": es["publishedIn"]["number"],
        "dogvUrl": es["publishedIn"]["url"],
        "pdfUrl": es["publishedIn"]["pdfUrl"],
        "url": f"{SITE}es/ley/{slug}/",
        "urlVa": f"{SITE}va/llei/{slug}/",
    }


LETTERS_RE = r"\*{0,2}([A-ZÑ])\s*-\s*([A-ZÑ])\*{0,2}"


def extract_letters(slug):
    """Lee las dos parejas de letras del artículo «Resultado del sorteo»."""
    law = load(slug, "es")
    text = "\n".join(n.get("content") or "" for n in iter_nodes(law))
    m1 = re.search(r"primer apellido:\s*" + LETTERS_RE, text)
    m2 = re.search(r"segundo apellido[^:]*:\s*" + LETTERS_RE, text)
    if not m1 or not m2:
        raise SystemExit(f"[{slug}] no se han encontrado las letras del sorteo")
    return f"{m1.group(1)}-{m1.group(2)}", f"{m2.group(1)}-{m2.group(2)}"


def crosscheck(slug, l1, l2):
    """Comprueba que la convocatoria de Música y Danza repite las mismas letras."""
    law = load(slug, "es")
    text = "\n".join(n.get("content") or "" for n in iter_nodes(law))
    m1 = re.search(r"primer apellido:\s*" + LETTERS_RE, text)
    m2 = re.search(r"segundo apellido[^:]*:\s*" + LETTERS_RE, text)
    if not m1 or not m2:
        return "no-citadas"
    got = (f"{m1.group(1)}-{m1.group(2)}", f"{m2.group(1)}-{m2.group(2)}")
    if got != (l1, l2):
        raise SystemExit(f"[{slug}] letras discrepantes: {got} != {(l1, l2)}")
    return "coinciden"


SCOPE_NOTE_ES = (
    "La resolución del sorteo regula la admisión en Educación Infantil, Primaria, ESO, "
    "Bachillerato y centros de Educación Especial, y no menciona las enseñanzas artísticas. "
    "Su aplicación a las enseñanzas elementales y profesionales de Música y Danza deriva del "
    "artículo 19.2.4.º de la Orden 8/2026 y del apartado noveno de la convocatoria anual de "
    "admisión, que reproduce estas mismas letras. No existe un sorteo propio de las enseñanzas "
    "artísticas: es el mismo sorteo general."
)
SCOPE_NOTE_VA = (
    "La resolució del sorteig regula l'admissió en Educació Infantil, Primària, ESO, Batxillerat "
    "i centres d'Educació Especial, i no menciona les ensenyances artístiques. La seua aplicació "
    "a les ensenyances elementals i professionals de Música i Dansa deriva de l'article 19.2.4t "
    "de l'Ordre 8/2026 i de l'apartat nové de la convocatòria anual d'admissió, que reproduïx "
    "estes mateixes lletres. No hi ha un sorteig propi de les ensenyances artístiques: és el "
    "mateix sorteig general."
)

# ---------------------------------------------------------------------------
standing = law_ref(STANDING_RULE[0])
standing["articles"] = STANDING_RULE[1]

for course, sorteo_slug, admision_slug in COURSES:
    l1, l2 = extract_letters(sorteo_slug)
    applied = [standing]
    if admision_slug:
        state = crosscheck(admision_slug, l1, l2)
        ref = law_ref(admision_slug)
        ref["articles"] = ["apartado-9"]
        applied = [ref, standing]
        print(f"{course}: {l1} / {l2}  (convocatoria Música y Danza: {state})")
    else:
        print(f"{course}: {l1} / {l2}")

    data = {
        "schema": SCHEMA,
        "version": VERSION,
        "course": course,
        "letters1": l1,
        "letters2": l2,
        "norm": law_ref(sorteo_slug),
        "appliedBy": applied,
        "scopeNote": SCOPE_NOTE_ES,
        "scopeNoteVa": SCOPE_NOTE_VA,
    }
    with open(os.path.join(OUT_DIR, f"{course}.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

manifest = {
    "schema": SCHEMA,
    "version": VERSION,
    "updated": TODAY,
    "source": SITE,
    "courses": [c for c, _, _ in COURSES],
}
with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"cursos publicados: {len(COURSES)}")
