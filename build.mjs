/**
 * build.mjs — Bundle the extension with esbuild.
 *
 * Bundles src/index.ts and all imports under src/ into a single dist/index.js.
 * Only @mariozechner/pi-coding-agent and Node built-ins are kept external.
 */

import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["index.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  external: ["@mariozechner/pi-coding-agent", "node:*"],
  outfile: "dist/index.js",
  sourcemap: true,
});

console.log("✓ Extension bundled → dist/index.js");
