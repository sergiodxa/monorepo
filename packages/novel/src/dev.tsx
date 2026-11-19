/**
 * The `@sdxc/novel/dev` entry: developer tools that connect to a novel through its events. Jump
 * to any scene with edited state, inspect state and persistent data, see the scene graph, read
 * the event log and the static problems, and hot-reload edited scenes onto the same line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	DevEvent,
	DevProblems,
	DevToolsOptions,
	ReloadResult,
	ResetOptions,
} from "./dev/devtools.js";
export type { GraphEdge, GraphScene, MissingMessage, SceneGraph } from "./dev/graph.js";

export { createDevTools, DevTools } from "./dev/devtools.js";
export { toMermaid } from "./dev/graph.js";
export { describeEvent, NovelDevTools } from "./dev/panel.js";
