// Asistente para guardar las claves en .env sin editar el archivo a mano.
// Uso: node plantilla/configurar.mjs   (Enter vacío = deja el valor que ya había)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const ruta = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
let texto = readFileSync(ruta, "utf8");
const rl = createInterface({ input: process.stdin, output: process.stdout });

const campos = [
  ["IG_ACCESS_TOKEN", "Token de Instagram (empieza con IG)"],
  ["CLOUDINARY_CLOUD_NAME", "Cloudinary: Cloud name"],
  ["CLOUDINARY_API_KEY", "Cloudinary: API Key"],
  ["CLOUDINARY_API_SECRET", "Cloudinary: API Secret"],
];

console.log("\nPega cada dato y presiona Enter (Enter vacío = no cambiarlo).\n");
for (const [clave, nombre] of campos) {
  const actual = texto.match(new RegExp(`^${clave}=(.*)$`, "m"))?.[1]?.trim();
  const valor = (await rl.question(`${nombre}${actual ? " [ya tiene valor]" : ""}: `)).trim();
  if (valor) texto = texto.replace(new RegExp(`^${clave}=.*$`, "m"), `${clave}=${valor}`);
}
rl.close();
writeFileSync(ruta, texto);
console.log("\nGuardado. Vuelve al chat y escribe: listo\n");
