// Empacota os parsers do SIGA para o servidor (Deno).
// Uso: node scripts/build-nfse-validador.mjs  — regenere sempre que os parsers mudarem.
import { build } from "esbuild";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const shim = path.join(root, "scripts/nfse-server/pdfjs-shim.js");

await build({
  entryPoints: [path.join(root, "src/lib/nfse-central-validador-arquivos.ts")],
  outfile: path.join(root, "supabase/functions/_shared/siga-validador.generated.js"),
  bundle: true, format: "esm", platform: "neutral", target: "es2022",
  banner: { js: "// ARQUIVO GERADO por scripts/build-nfse-validador.mjs a partir de src/lib — não editar.\n// deno-lint-ignore-file" },
  external: ["npm:*"],
  plugins: [{
    name: "siga-alias",
    setup(b) {
      b.onResolve({ filter: /^@\// }, (a) => ({ path: path.join(root, "src", a.path.slice(2)) + ".ts" }));
      b.onResolve({ filter: /^pdfjs-dist\/build\/pdf\.worker/ }, () => ({ path: "worker", namespace: "vazio" }));
      b.onResolve({ filter: /^pdfjs-dist$/ }, () => ({ path: shim }));
      b.onResolve({ filter: /^exceljs$/ }, () => ({ path: "npm:exceljs@4.4.0", external: true }));
      b.onLoad({ filter: /.*/, namespace: "vazio" }, () => ({ contents: "export default ''", loader: "js" }));
    },
  }],
});
console.log("ok");
