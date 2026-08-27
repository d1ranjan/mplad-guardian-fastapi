import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve("dist/pages");
await mkdir(output, { recursive: true });
await copyFile(resolve(output, "index.html"), resolve(output, "404.html"));
await writeFile(resolve(output, ".nojekyll"), "");
