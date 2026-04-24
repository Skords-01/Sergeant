import { build } from "esbuild";

const isCi = process.env.CI === "true";

/** @type {import("esbuild").BuildOptions} */
const base = {
  platform: "node",
  format: "esm",
  target: "node20",
  bundle: true,
  sourcemap: true,
  logLevel: "info",
  // Express server is deployed as a single container entrypoint; keeping
  // the bundle self-contained avoids Node ESM ".js extension" pitfalls in
  // internal workspace packages (e.g. @sergeant/shared).
  packages: "bundle",
  // `pg` (and other native deps) use CJS `require()` for Node built-ins
  // like `events`, `net`, `tls`, etc. When esbuild emits ESM, the
  // generated `__require` shim throws "Dynamic require of … is not
  // supported" for built-ins. Injecting `createRequire` restores a real
  // `require` function that Node can resolve.
  banner: {
    js: 'import{createRequire}from"module";const require=createRequire(import.meta.url);',
  },
};

await build({
  ...base,
  entryPoints: ["src/index.ts"],
  outfile: "dist-server/index.js",
  // Railway logs don't need minified stacks; keep readable output.
  minify: false,
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "production",
    ),
  },
});

await build({
  ...base,
  entryPoints: ["migrate.mjs"],
  outfile: "dist-server/migrate.js",
  minify: false,
  legalComments: "none",
});

if (!isCi) {
  // Best-effort sanity check: ensure the output files exist by letting
  // esbuild throw if anything failed above.
}
