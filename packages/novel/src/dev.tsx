/**
 * The `@sdxc/novel/dev` entry: developer tools that connect to a novel through its events and to
 * a player through `NovelDevTools.Connect`. Jump anywhere with edited state, edit persistent data
 * and unlocks, preview any screen over any library, fire toasts and sounds, and hot-reload scenes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { DevToolsConnect } from "./dev/connect.js";
export type {
	DevEvent,
	DevPlayer,
	DevPreview,
	DevProblems,
	DevToolsOptions,
	PlayerScreen,
	ReloadResult,
	ResetOptions,
} from "./dev/devtools.js";
export type { GraphEdge, GraphScene, MissingMessage, SceneGraph } from "./dev/graph.js";
export type { CastReport, LibraryPreset, UnlockCatalog } from "./dev/library.js";
export type { SampleKind } from "./dev/samples.js";

export { createDevTools, DevTools } from "./dev/devtools.js";
export { toMermaid } from "./dev/graph.js";
export { describeEvent, describeProblem, NovelDevTools } from "./dev/panel.js";
