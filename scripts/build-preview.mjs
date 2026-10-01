#!/usr/bin/env node
/**
 * Builds the single-file preview: the demo build (`npm run build:demo`) with
 * its JavaScript, CSS and logos inlined, so it can be published as one page
 * with no server behind it.
 *
 *   npm run build:preview            -> preview.html
 *   node scripts/build-preview.mjs out.html dist-demo
 */
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] || "preview.html";
const dist = process.argv[3] || "dist-demo";
let html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const jsName = html.match(/src="\/assets\/([^"]+\.js)"/)[1];
const cssName = html.match(/href="\/assets\/([^"]+\.css)"/)[1];
let js = fs.readFileSync(path.join(dist, "assets", jsName), "utf8");
const css = fs.readFileSync(path.join(dist, "assets", cssName), "utf8");

for (const png of ["meridian-logo-wordmark.png", "meridian-logo.png"]) {
  const file = path.join(dist, png);
  if (fs.existsSync(file)) js = js.split(`"/${png}"`).join(`"data:image/png;base64,${fs.readFileSync(file).toString("base64")}"`);
}
// A literal </script> inside the bundle would end the inline tag early.
js = js.split("</script").join("<\\/script");

html = html
  .replace(/<script type="module" crossorigin src="\/assets\/[^"]+"><\/script>/, () => `<script type="module">${js}</script>`)
  .replace(/<link rel="stylesheet" crossorigin href="\/assets\/[^"]+">/, () => `<style>${css}</style>`)
  .replace('<link rel="manifest" href="/manifest.json" />', "")
  .replace(/<title>.*?<\/title>/, "<title>The Frame Shop</title>");
fs.writeFileSync(out, html);
console.log(`${out}: ${(fs.statSync(out).size / 1e6).toFixed(2)} MB (js ${Math.round(js.length / 1024)} KB, css ${Math.round(css.length / 1024)} KB)`);
