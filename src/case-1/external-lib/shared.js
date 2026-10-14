// Shared by both parts (like vite's chunks/lib.js), and calls back into tool.js.
import { lazy } from "./index.js";
export const shared = lazy(() => "SHARED");
