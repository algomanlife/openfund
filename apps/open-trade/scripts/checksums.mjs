import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const dir = "release";
const lines = [];
for (const name of (await readdir(dir)).sort()) {
  if (!/\.(exe|dmg|AppImage|deb)$/.test(name)) continue;
  lines.push(
    `${createHash("sha256")
      .update(await readFile(`${dir}/${name}`))
      .digest("hex")}  ${name}`,
  );
}
if (!lines.length) throw new Error("No installers found");
await writeFile(`${dir}/SHA256SUMS.txt`, lines.join("\n") + "\n");
