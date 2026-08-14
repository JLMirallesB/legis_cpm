import type { Lang } from './types';

/**
 * Descriptores de los datasets públicos que sirve este repo bajo /data/.
 *
 * Son ficheros JSON estáticos servidos por GitHub Pages, no una API con servidor.
 * Esta lista es la fuente de la página «Datos abiertos» (/es/datos/, /va/dades/).
 *
 * Al añadir un dataset nuevo: añadir aquí su descriptor y su generador en scripts/.
 */

export type Bilingual = { es: string; va: string };

export interface DatasetField {
  name: string;
  type: string;
  desc: Bilingual;
}

export interface DatasetFile {
  /** Ruta relativa dentro de /data/ (p. ej. "calendario/manifest.json") */
  path: string;
  desc: Bilingual;
}

export interface Dataset {
  id: string;
  /** Valor del campo "schema" dentro del JSON */
  schema: string;
  version: number;
  name: Bilingual;
  summary: Bilingual;
  files: DatasetFile[];
  manifestFields: DatasetField[];
  courseFields: DatasetField[];
  /** Muestra real del fichero de curso, recortada */
  sample: string;
  /** Cuándo cambia el dataset y qué debe esperar quien lo consume */
  updates: Bilingual;
  /** Normas de las que se transcriben los datos */
  sources: { slug: string; title: Bilingual }[];
  /** Avisos específicos del dataset */
  notes: Bilingual[];
}

export const DATA_BASE = 'https://jlmirallesb.github.io/legis_cpmdem/data/';

export const DATASETS: Dataset[] = [
  {
    id: 'calendario',
    schema: 'cev-calendario-escolar',
    version: 1,
    name: {
      es: 'Calendario escolar',
      va: 'Calendari escolar',
    },
    summary: {
      es: 'Fechas de inicio y fin de curso por enseñanza, periodos de vacaciones, festivos autonómicos y festivos locales de los 547 municipios de la Comunitat Valenciana. Transcrito de la resolución anual de calendario escolar, del decreto de calendario laboral y de la resolución de fiestas locales.',
      va: 'Dates d\'inici i fi de curs per ensenyança, períodes de vacances, festius autonòmics i festius locals dels 547 municipis de la Comunitat Valenciana. Transcrit de la resolució anual de calendari escolar, del decret de calendari laboral i de la resolució de festes locals.',
    },
    files: [
      {
        path: 'calendario/manifest.json',
        desc: {
          es: 'Cursos disponibles, catálogo de enseñanzas y catálogo de municipios.',
          va: 'Cursos disponibles, catàleg d\'ensenyances i catàleg de municipis.',
        },
      },
      {
        path: 'calendario/2026-2027.json',
        desc: {
          es: 'Fechas del curso. Un fichero por cada curso listado en el manifest.',
          va: 'Dates del curs. Un fitxer per cada curs llistat en el manifest.',
        },
      },
    ],
    manifestFields: [
      { name: 'courses', type: 'string[]', desc: { es: 'Cursos publicados, en formato «2026-2027». Cada uno tiene su fichero.', va: 'Cursos publicats, en format «2026-2027». Cadascun té el seu fitxer.' } },
      { name: 'ensenyances', type: 'object[]', desc: { es: 'Catálogo de enseñanzas: code (identificador estable) y name. El código de conservatorio es musica_dansa.', va: 'Catàleg d\'ensenyances: code (identificador estable) i name. El codi de conservatori és musica_dansa.' } },
      { name: 'municipios', type: 'object[]', desc: { es: 'Catálogo de municipios: code (slug estable) y name (forma oficial DOGV, en valenciano).', va: 'Catàleg de municipis: code (slug estable) i name (forma oficial DOGV, en valencià).' } },
    ],
    courseFields: [
      { name: 'courseStart / courseEnd', type: 'string (YYYY-MM-DD)', desc: { es: 'Primer y último día lectivo con carácter general.', va: 'Primer i últim dia lectiu amb caràcter general.' } },
      { name: 'ensenyanceOverrides', type: 'object', desc: { es: 'Enseñanzas con fechas propias, indexadas por el code del manifest. Los conservatorios están en musica_dansa.', va: 'Ensenyances amb dates pròpies, indexades pel code del manifest. Els conservatoris estan en musica_dansa.' } },
      { name: 'vacations', type: 'object[]', desc: { es: 'Periodos de vacaciones con title, start y end. Los dos extremos son INCLUSIVOS: end es el último día no lectivo, y la reincorporación es el día siguiente.', va: 'Períodes de vacances amb title, start i end. Els dos extrems són INCLUSIUS: end és l\'últim dia no lectiu, i la reincorporació és l\'endemà.' } },
      { name: 'autonomicHolidays', type: 'object[]', desc: { es: 'Festivos autonómicos y nacionales que caen en día lectivo. Los que caen dentro de un periodo de vacaciones no se repiten aquí.', va: 'Festius autonòmics i nacionals que cauen en dia lectiu. Els que cauen dins d\'un període de vacances no es repetixen ací.' } },
      { name: 'localHolidays', type: 'object', desc: { es: 'Festivos locales indexados por el code del municipio. Solo incluye los que caen dentro del curso.', va: 'Festius locals indexats pel code del municipi. Només inclou els que cauen dins del curs.' } },
      { name: 'nonLectiveDays', type: 'object[]', desc: { es: 'Siempre vacío desde aquí: los días de libre disposición los fija cada consejo escolar municipal y no se publican en el DOGV.', va: 'Sempre buit des d\'ací: els dies de lliure disposició els fixa cada consell escolar municipal i no es publiquen en el DOGV.' } },
    ],
    sample: `{
  "schema": "cev-calendario-escolar",
  "version": 1,
  "course": "2026-2027",
  "courseStart": "2026-09-09",
  "courseEnd": "2027-06-18",
  "ensenyanceOverrides": {
    "musica_dansa": { "courseStart": "2026-09-14", "courseEnd": "2027-06-11" }
  },
  "vacations": [
    { "title": "Nadal", "start": "2026-12-22", "end": "2027-01-06" }
  ],
  "autonomicHolidays": [
    { "title": "9 d'Octubre — Dia de la Comunitat Valenciana", "date": "2026-10-09" }
  ],
  "nonLectiveDays": [],
  "localHolidays": {
    "vila-real": [ { "title": "Sant Pasqual", "date": "2027-05-17" } ]
  }
}`,
    updates: {
      es: 'Se regenera cuando se ingesta un calendario escolar nuevo, un decreto de calendario laboral o una resolución de fiestas locales. Las fiestas locales de un curso llegan en dos tandas, porque se publican por año natural: las de otoño con la resolución de un año y las de primavera con la del siguiente.',
      va: 'Es regenera quan s\'ingesta un calendari escolar nou, un decret de calendari laboral o una resolució de festes locals. Les festes locals d\'un curs arriben en dos tandes, perquè es publiquen per any natural: les de tardor amb la resolució d\'un any i les de primavera amb la de l\'any següent.',
    },
    sources: [
      { slug: 'resolucion-calendario-escolar-2026-2027', title: { es: 'Resolución de calendario escolar 2026-2027', va: 'Resolució de calendari escolar 2026-2027' } },
      { slug: 'decreto-calendario-laboral-2026', title: { es: 'Decreto de calendario laboral 2026', va: 'Decret de calendari laboral 2026' } },
      { slug: 'decreto-calendario-laboral-2027', title: { es: 'Decreto de calendario laboral 2027', va: 'Decret de calendari laboral 2027' } },
      { slug: 'resolucion-fiestas-locales-2026', title: { es: 'Resolución de fiestas locales 2026', va: 'Resolució de festes locals 2026' } },
    ],
    notes: [
      {
        es: 'El code de municipio es un identificador estable: no se renombra nunca. Si guardas la selección de un usuario, guarda el code, no el name.',
        va: 'El code de municipi és un identificador estable: no es reanomena mai. Si guardes la selecció d\'un usuari, guarda el code, no el name.',
      },
      {
        es: 'Los nombres de municipio y de festivo van en valenciano, en la forma oficial del DOGV.',
        va: 'Els noms de municipi i de festiu van en valencià, en la forma oficial del DOGV.',
      },
    ],
  },
  {
    id: 'sorteo',
    schema: 'cev-sorteo-admision',
    version: 1,
    name: {
      es: 'Sorteo de admisión',
      va: 'Sorteig d\'admissió',
    },
    summary: {
      es: 'Las dos parejas de letras del sorteo público que celebra cada año la Conselleria, con las que se deshacen los empates en los procesos de admisión de alumnado. Se extraen del texto de la resolución que las publica, no se teclean.',
      va: 'Les dos parelles de lletres del sorteig públic que celebra cada any la Conselleria, amb les quals es desfan els empats en els processos d\'admissió d\'alumnat. S\'extrauen del text de la resolució que les publica, no es teclegen.',
    },
    files: [
      {
        path: 'sorteo/manifest.json',
        desc: {
          es: 'Cursos disponibles.',
          va: 'Cursos disponibles.',
        },
      },
      {
        path: 'sorteo/2026-2027.json',
        desc: {
          es: 'Letras del curso y normas de referencia. Un fichero por cada curso listado en el manifest.',
          va: 'Lletres del curs i normes de referència. Un fitxer per cada curs llistat en el manifest.',
        },
      },
    ],
    manifestFields: [
      { name: 'courses', type: 'string[]', desc: { es: 'Cursos publicados, en formato «2026-2027». Cada uno tiene su fichero.', va: 'Cursos publicats, en format «2026-2027». Cadascun té el seu fitxer.' } },
    ],
    courseFields: [
      { name: 'letters1', type: 'string', desc: { es: 'Letras con las que se ordena el primer apellido, en el formato literal de la norma: «Q-O». El orden importa.', va: 'Lletres amb les quals s\'ordena el primer cognom, en el format literal de la norma: «Q-O». L\'orde importa.' } },
      { name: 'letters2', type: 'string', desc: { es: 'Letras con las que se ordena el segundo apellido. Solo se aplican cuando coincide el primero.', va: 'Lletres amb les quals s\'ordena el segon cognom. Només s\'apliquen quan coincidix el primer.' } },
      { name: 'norm', type: 'object', desc: { es: 'Resolución de la que salen las letras: título corto, fecha, número de DOGV y enlaces a la ficha oficial, al PDF y a la norma en este sitio.', va: 'Resolució d\'on ixen les lletres: títol curt, data, número de DOGV i enllaços a la fitxa oficial, al PDF i a la norma en este lloc.' } },
      { name: 'appliedBy', type: 'object[]', desc: { es: 'Normas de Música y Danza que aplican ese sorteo a los conservatorios, con el artículo o apartado concreto. Mismos campos que norm.', va: 'Normes de Música i Dansa que apliquen eixe sorteig als conservatoris, amb l\'article o apartat concret. Mateixos camps que norm.' } },
      { name: 'procedure', type: 'object', desc: { es: 'Cómo se aplican las letras. Lleva la cita literal del artículo que fija el procedimiento (text, textVa), un aviso en lenguaje llano (note, noteVa) y de dónde sale la cita. Léelo antes de programar la ordenación.', va: 'Com s\'apliquen les lletres. Porta la cita literal de l\'article que fixa el procediment (text, textVa), un avís en llenguatge planer (note, noteVa) i d\'on ix la cita. Llig-lo abans de programar l\'ordenació.' } },
      { name: 'scopeNote', type: 'string', desc: { es: 'Explicación, en castellano, de por qué el sorteo general se aplica a las enseñanzas artísticas. Hay también scopeNoteVa en valenciano.', va: 'Explicació, en castellà, de per què el sorteig general s\'aplica a les ensenyances artístiques. Hi ha també scopeNoteVa en valencià.' } },
    ],
    sample: `{
  "schema": "cev-sorteo-admision",
  "version": 1,
  "course": "2026-2027",
  "letters1": "Q-O",
  "letters2": "N-W",
  "norm": {
    "lawId": "resolucion-sorteo-admision-2026-2027",
    "shortTitle": "Res 21/04/2026 - Sorteo admisión 2026-2027",
    "date": "2026-04-21",
    "dogv": "10348",
    "url": "https://jlmirallesb.github.io/legis_cpmdem/es/ley/resolucion-sorteo-admision-2026-2027/"
  },
  "appliedBy": [ { "lawId": "orden-8-2026", "articles": ["art-19"] } ],
  "procedure": {
    "text": "...se elegirán dos letras por las cuales se ordenará el primer apellido...",
    "note": "El sorteo asigna DOS letras a cada apellido, y las dos ordenan ese apellido...",
    "sourceLawId": "orden-8-2024",
    "sourceArticle": "art-40",
    "sourceIngested": false
  },
  "scopeNote": "..."
}`,
    updates: {
      es: 'Se regenera cada primavera, cuando la Conselleria publica el resultado del sorteo del curso siguiente. El curso nuevo aparece en courses del manifest; los cursos ya publicados no se tocan.',
      va: 'Es regenera cada primavera, quan la Conselleria publica el resultat del sorteig del curs següent. El curs nou apareix en courses del manifest; els cursos ja publicats no es toquen.',
    },
    sources: [
      { slug: 'resolucion-sorteo-admision-2026-2027', title: { es: 'Resolución de 21/04/2026, del sorteo de admisión', va: 'Resolució de 21/04/2026, del sorteig d\'admissió' } },
      { slug: 'resolucion-admision-2026-2027', title: { es: 'Resolución de 30/04/2026, convocatoria de admisión de Música y Danza', va: 'Resolució de 30/04/2026, convocatòria d\'admissió de Música i Dansa' } },
      { slug: 'orden-8-2026', title: { es: 'Orden 8/2026, de admisión a las enseñanzas de Música y Danza', va: 'Orde 8/2026, d\'admissió a les ensenyances de Música i Dansa' } },
    ],
    notes: [
      {
        es: 'La resolución del sorteo solo nombra Infantil, Primaria, ESO, Bachillerato y Educación Especial. No existe un sorteo propio de las enseñanzas artísticas: los conservatorios aplican ese mismo sorteo por el artículo 19.2.4.º de la Orden 8/2026 y por el apartado noveno de la convocatoria anual de admisión, que reproduce las mismas letras.',
        va: 'La resolució del sorteig només nomena Infantil, Primària, ESO, Batxillerat i Educació Especial. No hi ha un sorteig propi de les ensenyances artístiques: els conservatoris apliquen eixe mateix sorteig per l\'article 19.2.4t de l\'Orde 8/2026 i per l\'apartat nové de la convocatòria anual d\'admissió, que reproduïx les mateixes lletres.',
      },
      {
        es: 'Al generar el dataset se comprueba que las letras de la resolución del sorteo y las que reproduce la convocatoria de Música y Danza coinciden. Si no coincidieran, no se publica nada.',
        va: 'En generar el dataset es comprova que les lletres de la resolució del sorteig i les que reproduïx la convocatòria de Música i Dansa coincidixen. Si no coincidiren, no es publica res.',
      },
      {
        es: 'El orden dentro del par importa y no es alfabético: en «Q-O» se ordena empezando por la Q y, a igualdad, por la O. Y son las dos letras las que ordenan el apellido, no solo la primera. Consulta procedure antes de programar la ordenación: ahí está la cita literal de la norma que lo fija.',
        va: 'L\'orde dins del parell importa i no és alfabètic: en «Q-O» s\'ordena començant per la Q i, a igualtat, per la O. I són les dues lletres les que ordenen el cognom, no només la primera. Consulta procedure abans de programar l\'ordenació: ahí està la cita literal de la norma que ho fixa.',
      },
      {
        es: 'La Orden 8/2024, que fija el procedimiento, no está ingestada en este sitio: la cita de procedure procede del preámbulo de la resolución del sorteo, que la reproduce. Por eso procedure.sourceIngested es false y no hay enlace a la norma.',
        va: 'L\'Orde 8/2024, que fixa el procediment, no està ingestada en este lloc: la cita de procedure procedix del preàmbul de la resolució del sorteig, que la reproduïx. Per això procedure.sourceIngested és false i no hi ha enllaç a la norma.',
      },
    ],
  },
];

/** Ejemplo de consumo, común a todos los datasets. */
export function usageSnippet(lang: Lang): string {
  const comment = lang === 'va'
    ? [
        '// 1. El manifest diu quins cursos hi ha publicats.',
        '// 2. Tria el curs i demana el seu fitxer.',
        '// No construïsques la URL del curs vinent a ma: llig-la del manifest.',
      ]
    : [
        '// 1. El manifest dice qué cursos hay publicados.',
        '// 2. Elige el curso y pide su fichero.',
        '// No construyas a mano la URL del curso que viene: léela del manifest.',
      ];

  return `const BASE = '${DATA_BASE}sorteo/';

${comment[0]}
const manifest = await fetch(BASE + 'manifest.json').then(r => r.json());

${comment[1]}
${comment[2]}
const curso = manifest.courses.at(-1);
const datos = await fetch(BASE + curso + '.json').then(r => r.json());

console.log(datos.letters1, datos.letters2);  // "Q-O" "N-W"`;
}
