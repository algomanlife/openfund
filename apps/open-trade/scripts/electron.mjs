import { build } from "esbuild";
for (const name of ["main", "preload"])
  await build({
    entryPoints: [`electron/${name}.ts`],
    outfile: `out/${name}.cjs`,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
  });

import { writeFile } from "node:fs/promises";
await writeFile(
  "out/config.json",
  JSON.stringify({
    origin: process.env.OPEN_TRADE_BACKEND || "",
    projectId: process.env.OPEN_TRADE_WALLETCONNECT_PROJECT_ID || "",
  }),
);
