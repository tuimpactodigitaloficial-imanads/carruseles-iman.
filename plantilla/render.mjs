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
const total = datos.laminas.length;

// El diseño se turna solo según el número del carrusel (001, 002…), salvo que el JSON pida un "tema"
const TEMAS = ["crema", "noche", "editorial"]; // también existen "tuit" y "naranja" (se pueden pedir con "tema" en el JSON)
const numero = parseInt(datos.id, 10) || 1;
const tema = datos.tema || TEMAS[(numero - 1) % TEMAS.length];
const avatar = pathToFileURL(join(RAIZ, "plantilla", "avatar.jpg")).href;
const cabeceraTuit = `<div class="tuit-cabecera"><img src="${avatar}"><div><b>Matias Rhayett <span class="verificado">✓</span></b><span>${datos.usuario}</span></div></div>`;

const iman = `<svg viewBox="0 0 40 40" class="iman"><path d="M8 6h8v16a4 4 0 0 0 8 0V6h8v16a12 12 0 0 1-24 0z" fill="currentColor"/><rect x="8" y="6" width="8" height="6" fill="var(--blanco)"/><rect x="24" y="6" width="8" height="6" fill="var(--blanco)"/></svg>`;

const pie = (i, oscuro) => `
  <footer>
    <div class="marca">${iman}<span>IMAN ADS ACADEMY</span></div>
    <div class="pag">${i + 1}/${total}${i < total - 1 ? ' <span class="flecha">→</span>' : ""}</div>
  </footer>`;

function lamina(l, i) {
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
  } else if (l.tipo === "portada") {
    cuerpo = `
      <div class="etiqueta">${l.etiqueta}</div>
      <h1 class="portada-titulo">${l.titulo}</h1>
      <p class="sub">${l.subtitulo}</p>
      <div class="desliza">Desliza <span>→</span></div>`;
  } else if (l.tipo === "texto") {
    cuerpo = `<h2 class="grande">${l.titulo}</h2><p class="cuerpo">${l.cuerpo}</p>`;
  } else if (l.tipo === "punto") {
    cuerpo = `
      <div class="numero">${l.numero}</div>
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
  if (tema === "tuit" && l.tipo !== "cta") cuerpo = cabeceraTuit + cuerpo;
  return `<section class="${clase} t-${l.tipo}" id="l${i}"><div class="contenido">${cuerpo}</div>${pie(i)}</section>`;
}

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&family=Inter:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${pathToFileURL(join(RAIZ, "plantilla", "estilos.css")).href}">
</head><body class="tema-${tema}">${datos.laminas.map(lamina).join("")}</body></html>`;

const salida = join(RAIZ, "salida", datos.id);
mkdirSync(salida, { recursive: true });
const htmlPath = join(salida, "carrusel.html");
writeFileSync(htmlPath, html);
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
console.log(`OK: ${total} láminas (diseño ${tema}) en ${salida}`);
