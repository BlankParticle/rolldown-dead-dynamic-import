import { rolldown } from "rolldown";

const name = process.argv[2];
if (name !== "case-1" && name !== "case-2") {
  console.error("usage: node build.mjs <case-1|case-2>");
  process.exit(1);
}

const bundle = await rolldown({
  input: `src/${name}/index.js`,
  transform: { define: { "globalThis.DEPLOY": "false" } },
});
const { output } = await bundle.generate({ format: "esm" });

for (const file of output) {
  console.log(
    `--- ${file.fileName} imports=${JSON.stringify(file.imports)} dynamicImports=${JSON.stringify(file.dynamicImports)}`,
  );
  console.log(file.code);
}

// A chunk is live if an entry reaches it through imports its code actually contains.
const byName = new Map(output.map((file) => [file.fileName, file]));
const live = new Set();
const queue = output.filter((file) => file.isEntry).map((file) => file.fileName);
while (queue.length > 0) {
  const fileName = queue.pop();
  if (live.has(fileName)) continue;
  live.add(fileName);
  const file = byName.get(fileName);
  for (const dep of [...file.imports, ...file.dynamicImports]) {
    if (byName.has(dep) && file.code.includes(dep)) queue.push(dep);
  }
}
const orphans = output.filter((file) => !live.has(file.fileName));
console.log(
  orphans.length === 0
    ? `${name}: OK, no unreachable chunks`
    : `${name}: BUG, ${orphans.length} chunk(s) emitted that nothing loads: ${orphans.map((f) => f.fileName).join(", ")}`,
    "\n"
);
