// A deploy-time tool (like vite's chunks/node.js): a helper, called at module
// level to set up lazy imports of the tool's two other parts.
export const lazy = (load) => load;
lazy(() => import("./part-a.js"));
lazy(() => import("./part-b.js"));
