import esbuild from "esbuild";
import builtins from "builtin-modules";

const production = process.argv.includes("production");

await esbuild
  .build({
    entryPoints: ["main.ts"],
    bundle: true,
    external: ["obsidian", "electron", ...builtins],
    format: "cjs",
    target: "es2018",
    logLevel: "info",
    treeShaking: true,
    sourcemap: production ? false : "inline",
    minify: production,
    outfile: "main.js",
  })
  .catch(() => process.exit(1));
