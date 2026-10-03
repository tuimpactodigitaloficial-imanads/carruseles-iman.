// Publica en Instagram el siguiente carrusel pendiente de contenido/.
// Uso: node plantilla/publicar.mjs            -> publica el siguiente
//      node plantilla/publicar.mjs --prueba   -> renderiza y sube a Cloudinary, sin publicar
//      node plantilla/publicar.mjs --diario   -> solo publica si en Chile ya son las 20:00 y hoy no se publicó
//                                               (para GitHub Actions, cuyo horario es UTC y cambia con el horario de verano)
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_LOCAL = join(RAIZ, ".env");
if (existsSync(ENV_LOCAL)) process.loadEnvFile(ENV_LOCAL); // en la nube las claves llegan como variables de entorno
const env = process.env;
const PRUEBA = process.argv.includes("--prueba");
const DIARIO = process.argv.includes("--diario");
const ZONA = env.ZONA_HORARIA || "America/Santiago";
const API = "https://graph.instagram.com/v23.0";
const REGISTRO = join(RAIZ, "publicados.json");

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function requerir(...claves) {
  const faltan = claves.filter((k) => !env[k]);
  if (faltan.length) throw new Error(`Faltan las claves: ${faltan.join(", ")}`);
}

async function ig(ruta, params = {}, metodo = "POST") {
  const qs = new URLSearchParams({ ...params, access_token: env.IG_ACCESS_TOKEN });
  const r = await fetch(`${API}/${ruta}?${qs}`, { method: metodo });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`Instagram ${ruta}: ${JSON.stringify(j.error || j)}`);
  return j;
}

async function subirCloudinary(archivo, publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  // Los parámetros firmados van en orden alfabético; overwrite evita que quede una versión vieja si se edita el carrusel
  const firmar = `invalidate=true&overwrite=true&public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
  const form = new FormData();
  form.append("file", `data:image/png;base64,${readFileSync(archivo).toString("base64")}`);
  form.append("public_id", publicId);
  form.append("overwrite", "true");
  form.append("invalidate", "true");
  form.append("timestamp", timestamp);
  form.append("api_key", env.CLOUDINARY_API_KEY);
  form.append("signature", createHash("sha1").update(firmar).digest("hex"));
  const r = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: form });
  const j = await r.json();
  if (!r.ok) throw new Error(`Cloudinary: ${JSON.stringify(j.error || j)}`);
  // Instagram solo acepta JPEG: Cloudinary lo convierte al pedir la URL con .jpg
  return j.secure_url.replace(/\.png$/, ".jpg");
}

// Renueva el token si tiene más de 24 h (dura 60 días; renovarlo seguido evita que venza)
async function renovarToken() {
  const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${env.IG_ACCESS_TOKEN}`);
  const j = await r.json();
  if (!j.access_token) return log(`Aviso: no se pudo renovar el token (${JSON.stringify(j.error || j)})`);
  if (!existsSync(ENV_LOCAL)) return log(`En la nube el token no se guarda solo: vence en ${Math.round(j.expires_in / 86400)} días si no se renueva a mano`);
  writeFileSync(ENV_LOCAL, readFileSync(ENV_LOCAL, "utf8").replace(/^IG_ACCESS_TOKEN=.*$/m, `IG_ACCESS_TOKEN=${j.access_token}`));
  env.IG_ACCESS_TOKEN = j.access_token;
  log("Token renovado");
}

const publicados = existsSync(REGISTRO) ? JSON.parse(readFileSync(REGISTRO, "utf8")) : [];

if (DIARIO) {
  const partes = (fecha) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(fecha).map((p) => [p.type, p.value]));
  const ahora = partes(new Date());
  const hoy = `${ahora.year}-${ahora.month}-${ahora.day}`;
  const horaPublicacion = Number((env.HORA_PUBLICACION || "20:00").split(":")[0]);
  if (Number(ahora.hour) < horaPublicacion) {
    log(`Todavía no son las ${horaPublicacion}:00 en ${ZONA} (son las ${ahora.hour}). No se publica.`);
    process.exit(0);
  }
  if (publicados.some((p) => { const d = partes(new Date(p.fecha)); return `${d.year}-${d.month}-${d.day}` === hoy; })) {
    log(`Ya se publicó hoy (${hoy}). No se publica de nuevo.`);
    process.exit(0);
  }
}
const pendiente = readdirSync(join(RAIZ, "contenido"))
  .filter((f) => f.endsWith(".json"))
  .sort()
  .find((f) => !publicados.some((p) => p.archivo === f));
if (!pendiente) {
  log("No hay carruseles pendientes en contenido/");
  process.exit(1);
}

requerir("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET");
if (!PRUEBA) requerir("IG_USER_ID", "IG_ACCESS_TOKEN");

const datos = JSON.parse(readFileSync(join(RAIZ, "contenido", pendiente), "utf8"));
log(`Carrusel: ${pendiente}`);
execFileSync(process.execPath, [join(RAIZ, "plantilla", "render.mjs"), join("contenido", pendiente)], { cwd: RAIZ, stdio: "inherit" });

const carpeta = join(RAIZ, "salida", datos.id);
const laminas = readdirSync(carpeta).filter((f) => /^lamina-\d+\.png$/.test(f)).sort();
const urls = [];
for (const f of laminas) {
  urls.push(await subirCloudinary(join(carpeta, f), `iman/${datos.id}/${f.replace(".png", "")}`));
}
log(`${urls.length} imágenes subidas`);

if (PRUEBA) {
  urls.forEach((u) => console.log(u));
  log("Modo prueba: no se publicó nada");
  process.exit(0);
}

await renovarToken();
const hijos = [];
for (const url of urls) {
  hijos.push((await ig(`${env.IG_USER_ID}/media`, { image_url: url, is_carousel_item: "true" })).id);
}
const contenedor = await ig(`${env.IG_USER_ID}/media`, { media_type: "CAROUSEL", children: hijos.join(","), caption: datos.caption });

for (let i = 0; i < 30; i++) {
  const { status_code } = await ig(contenedor.id, { fields: "status_code" }, "GET");
  if (status_code === "FINISHED") break;
  if (status_code === "ERROR") throw new Error("Instagram rechazó el carrusel al procesarlo");
  await espera(5000);
}

const post = await ig(`${env.IG_USER_ID}/media_publish`, { creation_id: contenedor.id });
publicados.push({ archivo: pendiente, id: post.id, fecha: new Date().toISOString() });
writeFileSync(REGISTRO, JSON.stringify(publicados, null, 2));
log(`Publicado en Instagram (id ${post.id})`);
