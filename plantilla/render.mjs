// Renderiza un carrusel (JSON en contenido/) a PNG 1080x1350 en salida/<id>/
// Uso: node plantilla/render.mjs contenido/001-errores-anuncios.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const archivo = process.argv[2];
if (!archivo) throw new Error("Falta el JSON del carrusel");
const datos = JSON.parse(readFileSync(join(RAIZ, archivo), "utf8"));
// Un carrusel puede traer su propio diseño a medida ("html": ruta a un archivo con una <section class="lamina"> por lámina)
const total = datos.html ? (readFileSync(join(RAIZ, datos.html), "utf8").match(/<section id="l\d+" class="lamina/g) || []).length : datos.laminas.length;

// El diseño se turna solo según el número del carrusel (001, 002…), salvo que el JSON pida un "tema"
const TEMAS = ["pop"]; // estilo principal; siguen existiendo "crema", "noche", "editorial", "tuit" y "nota" (campo "tema" del JSON) // también existen "tuit" y "naranja" (se pueden pedir con "tema" en el JSON)
const numero = parseInt(datos.id, 10) || 1;
const tema = datos.tema || TEMAS[(numero - 1) % TEMAS.length];
// Portadas con imagen: se elige según la etiqueta del carrusel y, si no calza, se turna por número
const VISUAL_POR_ETIQUETA = {
  chat: ["WHATSAPP", "VENTAS", "LEADS", "COMUNIDAD", "SERVICIOS", "AUTOMATIZACIÓN", "CLIENTES"],
  metricas: ["NÚMEROS", "MÉTRICAS", "PRESUPUESTO", "OPTIMIZACIÓN", "ESCALAR", "TESTEO", "GLOSARIO", "MEDICIÓN", "PÍXEL", "META ADS", "DIAGNÓSTICO"],
};
function visualDe(l) {
  if (l.visual) return l.visual;
  for (const [v, etiquetas] of Object.entries(VISUAL_POR_ETIQUETA)) if (etiquetas.includes(l.etiqueta)) return v;
  return ["comentarios", "notificaciones", "checklist"][numero % 3];
}
const plano = (html) => html.replace(/<[^>]+>/g, "");
const puntos = datos.laminas.filter((l) => l.tipo === "punto");
// Estructura de portada y formato de láminas interiores: se turnan por número (distinto ciclo que el color),
// así las combinaciones tardan en repetirse. El JSON puede fijarlas con "portada" y "interior".
const ESTRUCTURAS = ["imagen", "numero", "lista", "bloque", "centro", "diagrama", "noticia"];
const INTERIORES = ["clasico", "tarjeta", "marca"];
const portadaDe = (l) => {
  let e = l.portada || datos.portada || ESTRUCTURAS[numero % ESTRUCTURAS.length];
  if (e === "numero" && !/^\d+/.test(plano(l.titulo))) e = "lista";
  if ((e === "lista" || e === "diagrama") && puntos.length < 3) e = "bloque";
  return e;
};
const interior = datos.interior || INTERIORES[Math.floor((numero - 1) / 3) % INTERIORES.length]; // ciclo distinto al del color
const img = (ruta) => pathToFileURL(join(RAIZ, "plantilla", ruta)).href;
const VISUALES = {
  chat: () => `<div class="visual v-chat"><div class="tel">
      <div class="tel-cab"><span class="tel-av">C</span><div><b>Cliente nuevo</b><small>en línea</small></div></div>
      <p class="burbuja entra">¡Hola! Vi tu anuncio 👋</p>
      <p class="burbuja entra">¿Cuánto cuesta?</p>
      <p class="burbuja sale">¡Hola! Claro, te cuento 😊</p>
      <p class="burbuja entra">¡Me interesa! ¿Cuándo empezamos?</p></div></div>`,
  metricas: () => `<div class="visual v-metricas"><div class="panel">
      <div class="panel-cab"><b>Resultados de la campaña</b><span>Ejemplo</span></div>
      <div class="fila"><span>Mensajes iniciados</span><b>127 <i class="sube">▲</i></b></div>
      <div class="fila"><span>Costo por resultado</span><b>$1,84 <i class="baja">▼</i></b></div>
      <div class="fila"><span>CTR</span><b>3,2%</b></div>
      <div class="barras">${[30, 42, 38, 55, 61, 74, 90].map((h) => `<i style="height:${h}%"></i>`).join("")}</div></div></div>`,
  notificaciones: () => `<div class="visual v-notis">${puntos.slice(0, 3).map((p, k) =>
      `<div class="noti"><span class="app ${["ok", "ig", "wa"][k]}">${p.numero}</span><div><b>${p.etiqueta || "Punto"} ${p.numero}</b><p>${plano(p.titulo)}</p></div><small>${["ahora", "1 min", "3 min"][k]}</small></div>`).join("")}</div>`,
  checklist: () => `<div class="visual v-check"><div class="lista-check">
      <div class="check-cab">Antes de tu próxima campaña</div>
      ${puntos.slice(0, 4).map((p, k) => `<div class="check ${k < 2 ? "hecho" : ""}"><span>${k < 2 ? "✓" : ""}</span>${plano(p.titulo)}</div>`).join("")}</div></div>`,
  comentarios: () => `<div class="visual v-comentarios"><div class="post">
      <div class="post-cab"><span class="post-logo">${iman}</span><b>${datos.usuario.replace("@", "")}</b><small>· Comentarios</small></div>
      ${[["camila.estudio", "CLIENTES 🙌"], ["barberia_elcorte", "CLIENTES"], ["dra.paz.dental", "¡Justo lo que necesitaba! CLIENTES"], ["tienda.nativa", "CLIENTES 🔥"]]
        .map(([u, t], k) => `<div class="com"><span class="com-av" style="background:${["#FF4A1C", "#121212", "#F2A541", "#5A5550"][k]}">${u[0].toUpperCase()}</span><p><b>${u}</b> ${t}</p><i>♡</i></div>`).join("")}
    </div></div>`,
};

const cabeceraTuit = () => `<div class="tuit-cabecera"><span class="tuit-logo">${iman}</span><div><b>IMAN ADS ACADEMY <span class="verificado">✓</span></b><span>${datos.usuario}</span></div></div>`;

const iman = `<svg viewBox="0 0 40 40" class="iman"><path d="M8 6h8v16a4 4 0 0 0 8 0V6h8v16a12 12 0 0 1-24 0z" fill="currentColor"/><rect x="8" y="6" width="8" height="6" fill="var(--blanco)"/><rect x="24" y="6" width="8" height="6" fill="var(--blanco)"/></svg>`;

const pie = (i, oscuro) => `
  <footer>
    <div class="marca">${iman}<span>IMAN ADS ACADEMY</span></div>
    <div class="pag">${i + 1}/${total}${i < total - 1 ? ' <span class="flecha">→</span>' : ""}</div>
  </footer>`;

// ---------- Estilo POP: portada con palabra gigante + objeto ilustrado, e ícono que avanza de lámina en lámina ----------
const EMOJI_POR_ETIQUETA = {
  "META ADS": "📣", "CLAUDE CODE": "🤖", IA: "🤖", PROMPTS: "💬", WHATSAPP: "💬", VENTAS: "🤝", LEADS: "📇", CLIENTES: "🤝",
  PRESUPUESTO: "💸", "NÚMEROS": "🧮", "MÉTRICAS": "📊", "MEDICIÓN": "📊", "DIAGNÓSTICO": "🩺", "OPTIMIZACIÓN": "🎛️", ESCALAR: "🚀",
  TESTEO: "🧪", CREATIVOS: "🎨", GANCHOS: "🪝", COPY: "✍️", VIDEO: "🎬", REELS: "🎬", FORMATOS: "🖼️", OFERTA: "🎁",
  "BLACK FRIDAY": "🛍️", SEGURIDAD: "🔐", CUENTA: "⚠️", "POLÍTICAS": "🚫", MITOS: "🙅", PRINCIPIANTES: "🐣", FREELANCERS: "💼",
  AGENCIAS: "🕵️", COMPETENCIA: "🔍", HERRAMIENTAS: "🧰", RUBROS: "🏪", LOCAL: "📍", "E-COMMERCE": "🛒", WEB: "🌐",
  PLAN: "🗓️", CHECKLIST: "✅", ESTRATEGIA: "♟️", EMBUDO: "🌡️", PERFIL: "👀", HISTORIAS: "📲", IDEAS: "💡", "PÍXEL": "🧩",
  REMARKETING: "🔁", "SEGMENTACIÓN": "🎯", "PÚBLICOS": "👥", UGC: "🤳", GLOSARIO: "📖", ORDEN: "🗂️", EXPECTATIVAS: "⏳",
  "AUTOMATIZACIÓN": "⚙️", CRECIMIENTO: "📈", COMUNIDAD: "💬", CONTENIDO: "🏆", UBICACIONES: "📲", SERVICIOS: "🩺",
  "PRUEBA SOCIAL": "⭐", ESTRUCTURA: "🏗️", META: "🏢", RESUMEN: "🧲", "CONTENIDO ": "🏆",
};
const ACENTOS = ["#5B3A1E", "#FF4A1C", "#1F3BD6", "#0E7C4A", "#B4122B"];
const acento = datos.acento || ACENTOS[numero % ACENTOS.length];
const firma = () => `<div class="pop-firma"><span class="pop-logo">${iman}</span><b>${datos.usuario}</b><i>✓</i></div>`;
function heroPop(emoji) {
  const v = datos.hero || ["monitor", "cielo", "celular", "urgente", "stickers"][numero % 5];
  if (v === "celular") return `<div class="hero hero-cel"><div class="cel"><span class="cel-barra"></span><div class="pantalla">${emoji}</div></div><span class="flota f1">✨</span><span class="flota f2">👆</span></div>`;
  if (v === "stickers") return `<div class="hero hero-stk"><span class="stk s1">${emoji}</span><span class="stk s2">🧲</span><span class="stk s3">💰</span></div>`;
  return `<div class="hero hero-mon"><div class="mon"><div class="pantalla">${emoji}</div></div><div class="mon-pie"></div><div class="teclado">${"<i></i>".repeat(30)}</div><span class="flota f1">💭</span></div>`;
}
// Línea punteada continua entre láminas: en cada lámina se ve un tramo y el imán avanza
function caminoPop(i) {
  const t = total > 1 ? i / (total - 1) : 0;
  const fase = i * Math.PI, y = (x) => 110 + 60 * Math.sin((x / 1080) * Math.PI + fase);
  let d = `M0 ${y(0).toFixed(1)}`;
  for (let x = 30; x <= 1080; x += 30) d += ` L${x} ${y(x).toFixed(1)}`;
  const px = 130 + t * 820;
  return `<div class="camino"><svg viewBox="0 0 1080 220" preserveAspectRatio="none"><path d="${d}"/></svg><span class="viajero" style="left:${px}px; top:${y(px) - 62}px">${iman}</span></div>`;
}
function laminaPop(l, i) {
  const piePop = `<footer class="pop-pie">${firma()}<span class="pop-flecha">${i < total - 1 ? "→" : ""}</span></footer>`;
  // Portada con imagen generada con IA ("imagen": ruta relativa a la carpeta del proyecto)
  if (l.tipo === "portada" && l.imagen) {
    return `<section class="lamina pop pop-foto" id="l${i}" style="--acento:${acento}">
      <img class="foto-full" src="${pathToFileURL(join(RAIZ, l.imagen)).href}">
      <div class="foto-sombra"></div>
      <div class="pop-arriba foto-firma">${firma()}</div>
      <div class="foto-texto"><div class="foto-pildora">${l.etiqueta}</div>
      <h1 class="foto-titulo">${l.titulo}</h1>
      <p class="foto-sub">${l.subtitulo.replace(/^\(|\)$/g, "")} →</p></div></section>`;
  }
  if (l.tipo === "portada") {
    const m = l.titulo.match(/^(.*?)<mark>(.*?)<\/mark>(.*)$/s) || [null, "", plano(l.titulo), ""];
    const emoji = datos.emoji || EMOJI_POR_ETIQUETA[l.etiqueta] || "🧲";
    if ((datos.hero || ["monitor", "cielo", "celular", "urgente", "stickers"][numero % 5]) === "urgente") {
      return `<section class="lamina pop pop-urgente" id="l${i}" style="--acento:${acento}">
        <div class="urg-fichas"><span class="ficha-xl x1">${emoji}</span><span class="ficha-xl x2">${iman}</span><span class="urg-nota">${l.etiqueta.toLowerCase()} ⤵</span></div>
        <div class="urg-pildora">${l.etiqueta === "BLACK FRIDAY" ? "BLACK FRIDAY" : "IMPORTANTE"}</div>
        <h1 class="urg-titulo">${l.titulo}</h1>
        <p class="sub urg-sub">Desliza para conocer más →</p></section>`;
    }
    if ((datos.hero || ["monitor", "cielo", "celular", "urgente", "stickers"][numero % 5]) === "cielo") {
      return `<section class="lamina pop pop-cielo" id="l${i}">
        <span class="nube n1"></span><span class="nube n2"></span><span class="nube n3"></span>
        <div class="cielo-texto"><div class="cielo-kicker">${l.etiqueta}</div>
        <h1 class="cielo-titulo">${l.titulo}</h1><p class="sub cielo-sub">${l.subtitulo.replace(/^\(|\)$/g, "")}</p></div>
        <div class="muro"><span class="sentado a">${emoji}</span><span class="sentado b">🧲</span></div>
        <div class="cielo-pie"><span>IMAN ADS ACADEMY · ${datos.usuario}</span><span>01 / ${String(total).padStart(2, "0")}</span></div></section>`;
    }
    return `<section class="lamina pop pop-portada" id="l${i}" style="--acento:${acento}">
      <div class="pop-arriba">${firma()}</div>
      <h1 class="pop-titulo">${m[1] ? `<span>${m[1].trim()}</span>` : ""}<strong class="gigante">${m[2].trim()}</strong>${/[\p{L}\p{N}]/u.test(m[3]) ? `<span>${m[3].trim()}</span>` : ""}</h1>
      ${heroPop(emoji)}
      <p class="sub pop-bajada">${l.subtitulo.replace(/^\(|\)$/g, "").replace(/[.:…]+$/, "")}…</p></section>`;
  }
  if (l.tipo === "cta") {
    return `<section class="lamina pop pop-cta" id="l${i}" style="--acento:${acento}">
      <div class="contenido"><h2 class="pop-h2">${l.titulo}</h2>
      <div class="pop-comenta">Comenta <strong>CLIENTES</strong> ⤵️</div>
      <p class="cuerpo">y te envío el acceso a mi comunidad, donde te enseño paso a paso.</p>
      <p class="pop-extra">${l.extra}</p></div>${piePop}</section>`;
  }
  const n = l.tipo === "punto" ? `<div class="pop-num">${parseInt(l.numero, 10)}</div>` : "";
  const emoji = datos.emoji || EMOJI_POR_ETIQUETA[datos.laminas[0].etiqueta] || "🧲";
  const clave = plano((l.cuerpo.match(/<b>(.*?)<\/b>/s) || [null, l.titulo])[1]).replace(/[.:]$/, "");
  const FICHAS = ["✅", "💡", "🎯", "⚡", "📌", "🔥", "💬", "📈"];
  const ventana = `<div class="ventana-zona"><div class="ventana ${i % 2 ? "izq" : "der"}">
      <div class="ventana-barra"><i></i><i></i><i></i><span>${l.tipo === "punto" ? `${l.etiqueta || "Punto"} ${parseInt(l.numero, 10)} de ${puntos.length}` : "IMAN ADS ACADEMY"}</span></div>
      <div class="ventana-cuerpo"><div class="ventana-clave">${clave}</div><div class="lineas"><i></i><i></i><i style="width:55%"></i></div></div></div>
      <span class="ficha fa">${emoji}</span><span class="ficha fb">${FICHAS[(numero + i) % FICHAS.length]}</span></div>`;
  return `<section class="lamina pop pop-${l.tipo}" id="l${i}" style="--acento:${acento}">
    <div class="pop-arriba">${firma()}</div>
    <div class="contenido">${n}<h2 class="pop-h2">${l.titulo}</h2><p class="cuerpo">${l.cuerpo}</p></div>
    ${ventana}${caminoPop(i)}${piePop}</section>`;
}

function lamina(l, i) {
  if (tema === "pop") return laminaPop(l, i);
  const clase = l.tipo === "cta" ? "lamina oscura" : "lamina";
  let cuerpo = "";
  if (l.tipo === "portada" && l.foto) {
    const src = pathToFileURL(join(RAIZ, l.foto)).href;
    if (l.variante === "oscura") {
      return `<section class="lamina portada-foto oscura" id="l${i}">
        <div class="foto-fondo" style="background-image:url('${src}')"></div>
        <div class="contenido"><div class="etiqueta">${l.etiqueta}</div><h1 class="portada-titulo">${l.titulo}</h1><p class="sub">${l.subtitulo}</p></div>${pie(i)}</section>`;
    }
    return `<section class="lamina portada-tarjeta" id="l${i}">
      <div class="contenido"><div class="etiqueta">${l.etiqueta}</div><h1 class="portada-titulo">${l.titulo}</h1><p class="sub">${l.subtitulo}</p></div>
      <div class="foto-tarjeta"><img src="${src}"><span class="globo">${l.globo || "Te lo explico 👇"}</span></div>${pie(i)}</section>`;
  } else if (l.tipo === "portada" && !["tuit", "nota"].includes(tema) && portadaDe(l) === "numero") {
    const n = plano(l.titulo).match(/^\d+/)[0];
    return `<section class="lamina portada-numero t-portada" id="l${i}"><div class="contenido">
      <div class="etiqueta">${l.etiqueta}</div>
      <div class="gran-numero">${n}</div>
      <h1 class="portada-titulo">${l.titulo.replace(/^\s*\d+\s*/, "")}</h1>
      <p class="sub">${l.subtitulo}</p></div>${pie(i)}</section>`;
  } else if (l.tipo === "portada" && !["tuit", "nota"].includes(tema) && portadaDe(l) === "lista") {
    return `<section class="lamina portada-lista t-portada" id="l${i}"><div class="contenido">
      <div class="etiqueta">${l.etiqueta}</div>
      <h1 class="portada-titulo">${l.titulo}</h1>
      <ol class="indice">${puntos.slice(0, 5).map((p, k) => `<li class="${k >= 3 ? "borroso" : ""}"><b>${p.numero}</b>${plano(p.titulo)}</li>`).join("")}</ol>
      <div class="desliza">Desliza para verlos todos <span>→</span></div></div>${pie(i)}</section>`;
  } else if (l.tipo === "portada" && !["tuit", "nota"].includes(tema) && portadaDe(l) === "bloque") {
    return `<section class="lamina portada-bloque t-portada" id="l${i}">
      <div class="bloque"><div class="etiqueta">${l.etiqueta}</div><h1 class="portada-titulo">${l.titulo}</h1></div>
      <div class="contenido"><p class="sub">${l.subtitulo}</p><div class="flecha-grande">→</div></div>${pie(i)}</section>`;
  } else if (l.tipo === "portada" && !["tuit", "nota"].includes(tema) && portadaDe(l) === "diagrama") {
    return `<section class="lamina portada-diagrama t-portada" id="l${i}"><div class="contenido">
      <div class="etiqueta">${l.etiqueta}</div>
      <h1 class="portada-titulo">${l.titulo}</h1>
      <div class="flujo">${puntos.slice(0, 3).map((p) => `<div class="caja">${plano(p.titulo)}</div>`).join('<div class="baja-flecha">↓</div>')}</div>
      </div>${pie(i)}</section>`;
  } else if (l.tipo === "portada" && !["tuit", "nota"].includes(tema) && portadaDe(l) === "noticia") {
    return `<section class="lamina portada-noticia t-portada" id="l${i}">
      <div class="cinta"><span class="punto-vivo"></span>${l.etiqueta} · IMPORTANTE</div>
      <div class="contenido"><h1 class="portada-titulo">${l.titulo}</h1><p class="sub">${l.subtitulo}</p>
      <div class="desliza">Sigue leyendo <span>→</span></div></div>${pie(i)}</section>`;
  } else if (l.tipo === "portada" && !["tuit", "nota"].includes(tema) && portadaDe(l) === "centro") {
    return `<section class="lamina portada-centro t-portada" id="l${i}"><div class="contenido">
      <div class="comillas">“</div>
      <div class="etiqueta">${l.etiqueta}</div>
      <h1 class="portada-titulo">${l.titulo}</h1>
      <p class="sub">${l.subtitulo}</p>
      <div class="desliza">Desliza <span>→</span></div></div>${pie(i)}</section>`;
  } else if (l.tipo === "portada" && !["tuit", "nota"].includes(tema) && visualDe(l) !== "texto") {
    return `<section class="lamina portada-visual t-portada" id="l${i}"><div class="contenido">
      <div class="etiqueta">${l.etiqueta}</div>
      <h1 class="portada-titulo">${l.titulo}</h1>
      <p class="sub">${l.subtitulo}</p>
      ${VISUALES[visualDe(l)]()}</div>${pie(i)}</section>`;
  } else if (l.tipo === "portada") {
    cuerpo = `
      <div class="etiqueta">${l.etiqueta}</div>
      <h1 class="portada-titulo">${l.titulo}</h1>
      <p class="sub">${l.subtitulo}</p>
      <div class="desliza">Desliza <span>→</span></div>`;
  } else if (l.tipo === "texto") {
    cuerpo = `<h2 class="grande">${l.titulo}</h2><p class="cuerpo">${l.cuerpo}</p>`;
  } else if (l.tipo === "punto") {
    const de = puntos.length ? ` <small>/ ${String(puntos.length).padStart(2, "0")}</small>` : "";
    cuerpo = `
      <div class="numero">${l.numero}${interior === "tarjeta" ? de : ""}</div>
      <div class="error">${l.etiqueta || "ERROR"}</div>
      <h2>${l.titulo}</h2>
      <div class="linea"></div>
      <p class="cuerpo">${l.cuerpo}</p>`;
  } else if (l.tipo === "cta") {
    cuerpo = `
      <h2 class="grande">${l.titulo}</h2>
      <p class="cuerpo">${l.cuerpo}</p>
      <div class="usuario">${datos.usuario}</div>
      <p class="extra">${l.extra}</p>`;
  }
  if (tema === "tuit" && l.tipo !== "cta") cuerpo = cabeceraTuit() + cuerpo;
  if (interior === "tarjeta" && (l.tipo === "punto" || l.tipo === "texto")) cuerpo = `<div class="tarjeta">${cuerpo}</div>`;
  if (interior === "marca" && l.tipo === "punto") cuerpo = `<div class="marca-agua">${l.numero}</div>` + cuerpo;
  return `<section class="${clase} t-${l.tipo}" id="l${i}"><div class="contenido">${cuerpo}</div>${pie(i)}</section>`;
}

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&family=Inter:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&family=Caveat:wght@500;700&family=Anton&family=Inter+Tight:wght@500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${pathToFileURL(join(RAIZ, "plantilla", "estilos.css")).href}">
</head><body class="tema-${tema} interior-${interior}">${datos.laminas.map(lamina).join("")}</body></html>`;

const salida = join(RAIZ, "salida", datos.id);
mkdirSync(salida, { recursive: true });
const htmlPath = join(salida, "carrusel.html");
writeFileSync(htmlPath, datos.html
  ? readFileSync(join(RAIZ, datos.html), "utf8")
      .replaceAll("{{BASE}}", pathToFileURL(join(RAIZ, dirname(datos.html), "assets")).href)
      .replaceAll("{{IMAN}}", iman.replace('class="iman"', 'class="iman" style="color:#fff"').replaceAll('var(--blanco)', '#FF4A1C'))
      .replace(/<section class="lamina([^"]*)"/g, (m, c, k) => m)
  : html);
writeFileSync(join(salida, "caption.txt"), datos.caption);

const nav = await puppeteer.launch({
  executablePath: CHROME,
  args: ["--allow-file-access-from-files", ...(process.env.CI ? ["--no-sandbox"] : [])], // los servidores de GitHub no permiten el sandbox de Chrome
});
const pag = await nav.newPage();
await pag.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
await pag.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0" });
await pag.evaluate(() => document.fonts.ready);
// Si un título largo no cabe, achica de a poco la letra de títulos y cuerpo (hasta un 65%)
await pag.evaluate(() => {
  for (const g of document.querySelectorAll(".gigante")) {
    let px = 250; g.style.fontSize = px + "px";
    while (g.scrollWidth > g.clientWidth && px > 110) g.style.fontSize = (px -= 6) + "px";
    if (g.scrollWidth > g.clientWidth) g.style.whiteSpace = "normal";
  }
});
const desbordes = await pag.evaluate(() =>
  [...document.querySelectorAll(".lamina")].map((s, i) => {
    const textos = [...s.querySelectorAll("h1, h2, .cuerpo, .sub")];
    const base = textos.map((t) => parseFloat(getComputedStyle(t).fontSize));
    for (let f = 0.95; s.scrollHeight > s.clientHeight + 2 && f >= 0.65; f -= 0.05) {
      textos.forEach((t, k) => (t.style.fontSize = `${base[k] * f}px`));
    }
    return s.scrollHeight > s.clientHeight + 2 ? i + 1 : 0;
  }).filter(Boolean));
if (desbordes.length) console.warn(`AVISO: el texto no cabe en la(s) lámina(s) ${desbordes.join(", ")} de ${datos.id}`);
for (let i = 0; i < total; i++) {
  const el = await pag.$(`#l${i}`);
  await el.screenshot({ path: join(salida, `lamina-${String(i + 1).padStart(2, "0")}.png`) });
}
await nav.close();
console.log(`OK: ${total} láminas (diseño ${tema}, portada ${datos.html ? "a medida" : portadaDe(datos.laminas[0])}, interior ${interior}) en ${salida}`);
