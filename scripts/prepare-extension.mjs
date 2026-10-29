import { copyFileSync } from "node:fs";
for (const name of ["README.md", "LICENSE"]) {
  copyFileSync(new URL(`../${name}`, import.meta.url), new URL(`../packages/vscode/${name}`, import.meta.url));
}
