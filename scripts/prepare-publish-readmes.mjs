import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const mode = process.argv[2];

const REPO_BLOB = "https://github.com/axnic/pi-aks-user-question/blob/main/";
const REPO_RAW =
  "https://raw.githubusercontent.com/axnic/pi-aks-user-question/main/";

function replaceRelativeMarkdownLinks(content, prefix) {
  return content.replaceAll("](./", `](${prefix}`);
}

function replaceRelativeHtmlHref(content, prefix) {
  return content.replaceAll('href="./', `href="${prefix}`);
}

function replaceBannerAssets(content) {
  return content
    .replaceAll('srcset="docs/assets/', `srcset="${REPO_RAW}docs/assets/`)
    .replaceAll('src="docs/assets/', `src="${REPO_RAW}docs/assets/`);
}

if (mode === "prepare") {
  const readmePath = join(process.cwd(), "README.md");
  const backupPath = join(process.cwd(), ".README.md.publish-backup");
  try {
    writeFileSync(backupPath, readFileSync(readmePath, "utf8"), { flag: "wx" });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
  let readme = readFileSync(readmePath, "utf8");
  readme = replaceRelativeHtmlHref(readme, REPO_BLOB);
  readme = replaceRelativeMarkdownLinks(readme, REPO_BLOB);
  readme = replaceBannerAssets(readme);
  writeFileSync(readmePath, readme, "utf8");
  process.exit(0);
}

if (mode === "restore") {
  const readmePath = join(process.cwd(), "README.md");
  const backupPath = join(process.cwd(), ".README.md.publish-backup");
  if (existsSync(backupPath)) {
    writeFileSync(readmePath, readFileSync(backupPath, "utf8"), "utf8");
    rmSync(backupPath);
  }
  process.exit(0);
}

throw new Error(
  "Usage: node scripts/prepare-publish-readmes.mjs <prepare|restore>",
);
