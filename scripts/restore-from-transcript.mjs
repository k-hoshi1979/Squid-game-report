import fs from "node:fs";
import path from "node:path";

const transcriptPath =
  "C:/Users/hoshi/.cursor/projects/c-Users-hoshi-daily-report/agent-transcripts/c0bc6234-296a-48a4-91f6-74aabd3af2ea/c0bc6234-296a-48a4-91f6-74aabd3af2ea.jsonl";

const roots = [
  "c:/users/hoshi/retail-app",
  "c:/users/hoshi/daily-report",
];

const writes = new Map();
const replaces = [];

function inRoots(filePath) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  return roots.some((root) => normalized.startsWith(root));
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

for (const line of fs.readFileSync(transcriptPath, "utf8").split("\n")) {
  if (!line.trim()) continue;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }
  const content = obj.role === "assistant" && obj.message?.content;
  if (!Array.isArray(content)) continue;

  for (const item of content) {
    if (item.type !== "tool_use") continue;
    const filePath = item.input?.path;
    if (!filePath || !inRoots(filePath)) continue;

    if (item.name === "Write" && typeof item.input.contents === "string") {
      writes.set(normalizePath(filePath), item.input.contents);
    }
    if (item.name === "StrReplace") {
      replaces.push({
        path: normalizePath(filePath),
        old_string: item.input.old_string,
        new_string: item.input.new_string,
      });
    }
  }
}

let written = 0;
for (const [filePath, contents] of writes) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
  written += 1;
}

let patched = 0;
let patchFailed = 0;
for (const { path: filePath, old_string, new_string } of replaces) {
  if (!fs.existsSync(filePath)) {
    patchFailed += 1;
    continue;
  }
  const current = fs.readFileSync(filePath, "utf8");
  if (!current.includes(old_string)) {
    patchFailed += 1;
    continue;
  }
  fs.writeFileSync(filePath, current.replace(old_string, new_string), "utf8");
  patched += 1;
}

console.log(`Restored ${written} files from Write operations.`);
console.log(`Applied ${patched} StrReplace patches (${patchFailed} skipped).`);

for (const filePath of [...writes.keys()].sort()) {
  console.log(" -", filePath);
}
