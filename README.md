# rolldown emits chunks for dynamic imports that tree-shaking removed

Rolldown 1.2.13 emits chunks for `import()` calls that are dead in the final
code. The emitted chunks are unreachable from the entry, but they are still
written (and, for Cloudflare Workers, uploaded), and the entry's
`dynamicImports` can still list them.

Both cases build with `transform.define: { "globalThis.DEPLOY": "false" }`, so
the deploy branch is dead and the expected output is the entry chunk alone.

```sh
pnpm install
pnpm start          # both cases
pnpm case-1
pnpm case-2
```

Each run prints every output file and ends with a verdict, e.g.

```
case-2: BUG, 1 chunk(s) emitted that nothing loads: deploy-uObBUVoN.js
```

## Case 2: flag from another module

[`src/case-2`](src/case-2)

```js
// flag.js
export const flag = globalThis.DEPLOY;

// index.js
import { flag } from "./flag.js";
if (flag) import("./deploy.js");
else console.log("Not Deploying");
```

The `if (flag)` branch only dies once `flag` is inlined from `flag.js`, and
that happens after rolldown has decided which dynamic chunks are live. The
entry's code is just `console.log("Not Deploying")`, but `deploy-*.js` is
still emitted.

The import metadata is wrong too: the entry chunk reports a dynamic import its
code doesn't contain.

```
--- index.js imports=[] dynamicImports=["deploy-uObBUVoN.js"]
console.log("Not Deploying");
```

Anything that walks the chunk graph through `dynamicImports` (to prune or
preload chunks) therefore treats `deploy-*.js` as reachable.

Using `globalThis.DEPLOY` directly in the `if` emits no chunk: the define is
folded before tree-shaking.

## Case 1: a library whose lazy parts keep each other alive (Vite)

[`src/case-1`](src/case-1)

Case 1 is Vite's `dist/node` structure, reduced: it was found by bundling
code that reaches `import("vite")` only through deploy-time code, which
emitted ~1 MB of Vite, rolldown, esbuild, postcss, tsx, yaml and jiti chunks
that nothing loads. Delta-debugging Vite's dist down to the trigger left
exactly this shape, mapped one to one:

| repro | Vite 8.3.4 |
|---|---|
| `external-lib/index.js` | `dist/node/chunks/node.js` |
| `lazy(() => import("./part-a.js"))` | `createCachedImport(() => import("./build.js"))` |
| `part-a.js`, `part-b.js` | `chunks/build.js`, `chunks/postcss-import.js` |
| `shared.js` (imports `index.js` back) | `chunks/lib.js` (imports `__commonJSMin` from `node.js`) |

```js
// deploy.js: deploy-time code, dead once DEPLOY is false
export const deploy = () => import("./external-lib/index.js");

// external-lib/index.js: module-level calls set up lazy imports of two parts
export const lazy = (load) => load;
lazy(() => import("./part-a.js"));
lazy(() => import("./part-b.js"));

// external-lib/shared.js: shared by both parts, imports index.js back
import { lazy } from "./index.js";
export const shared = lazy(() => "SHARED");
```

The only path to `external-lib` is the dead `deploy()`, so nothing in it
should be emitted. But `part-a`/`part-b` reach `index.js` through `shared.js`,
and `index.js`'s module-level `lazy(...)` calls hold their `import()`s, so the
dynamic entries keep their own `import()` statements included and the cycle
survives: `part-a-*.js`, `part-b-*.js` and `shared-*.js` are emitted, and
`shared-*.js` lists both parts in `dynamicImports` without containing those
`import()`s. Each ingredient is required; with one lazy part, or without the
import back from `shared.js`, the output is the entry alone.

---

This repro was put together with the help of Claude (Anthropic), which delta-debugged Vite's dist down to case 1.
