/**
 * What the developer tools read from the scene arrays without playing them: the scene graph
 * (jumps, calls and endings) drawn as a Mermaid flowchart, and the message keys a scene shows
 * that a locale's catalog lacks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ChapterInfo } from "../declarations.js";
import type { Directive } from "../directives.js";
import type { NovelInternals } from "../novel.js";

import { jumpOf } from "../directives.js";
import { hasMessage } from "../novel.js";

/** A scene in the graph. */
export interface GraphScene {
	name: string;
	title?: string;
	chapter?: ChapterInfo;
	/** False for a declared scene with no module, which jumps may still point at. */
	mapped: boolean;
	/** The ending keys the scene can reach without leaving it. */
	endings: string[];
}

/** A jump from one scene to another; a pick draws one edge per candidate. */
export interface GraphEdge {
	from: string;
	to: string;
	/** `goto` continues in the target; `call` plays it and returns. */
	kind: "goto" | "call";
}

/** Every declared scene and every jump between them. */
export interface SceneGraph {
	scenes: GraphScene[];
	edges: GraphEdge[];
}

/** A message key a scene or declaration shows that one locale's catalog lacks. */
export interface MissingMessage {
	locale: string;
	key: string;
	/** The scene showing it, or `undefined` for a scene title, chapter title, name or caption. */
	scene?: string;
}

/**
 * Reads the scene graph from every mapped scene, loading lazy modules. A scene that fails to load
 * stays in the graph with no jumps; `check()` reports why.
 *
 * @param internals - The novel's declarations and loader.
 * @returns The scenes in declaration order and the jumps in document order, each once.
 */
export async function readGraph(internals: NovelInternals): Promise<SceneGraph> {
	let scenes: GraphScene[] = [];
	let edges: GraphEdge[] = [];
	let listed = new Set<string>();
	for (let declaration of internals.scenes.values()) {
		let entry: GraphScene = {
			name: declaration.name,
			mapped: internals.mapped.includes(declaration.name),
			endings: [],
		};
		if (declaration.title !== undefined) entry.title = declaration.title;
		if (declaration.chapter !== undefined) entry.chapter = declaration.chapter;
		scenes.push(entry);
		if (!entry.mapped) continue;
		let index = await internals.load(declaration.name);
		if (index.status === "failure") continue;
		eachDirective(index.data.module.directives, (directive) => {
			if (directive.type === "ending" && !entry.endings.includes(directive.key)) {
				entry.endings.push(directive.key);
			}
			let jump = jumpOf(directive);
			if (jump === undefined) return;
			for (let target of jump.scenes) {
				let id = `${declaration.name}>${jump.via}>${target.name}`;
				if (listed.has(id)) continue;
				listed.add(id);
				edges.push({ from: declaration.name, to: target.name, kind: jump.via });
			}
		});
	}
	return { scenes, edges };
}

/**
 * Writes the graph as a Mermaid flowchart: a box per scene grouped by chapter, a solid arrow per
 * `goto`, a dotted one per `call`, and a rounded node per ending. A scene with no module is a
 * slanted `[/ /]` box, so a missing mapping stands out.
 *
 * @param graph - What {@link readGraph} answered.
 * @returns Mermaid source starting with `flowchart LR`.
 * @example toMermaid(await readGraph(internals)); // "flowchart LR\n  s0[\"prologue.opening\"] …"
 */
export function toMermaid(graph: SceneGraph): string {
	let ids = new Map(graph.scenes.map((scene, index) => [scene.name, `s${index}`]));
	let lines = ["flowchart LR"];
	let chapters = new Map<string, GraphScene[]>();
	let loose: GraphScene[] = [];
	for (let scene of graph.scenes) {
		if (scene.chapter === undefined) loose.push(scene);
		else chapters.set(scene.chapter.name, [...(chapters.get(scene.chapter.name) ?? []), scene]);
	}
	for (let [index, [name, members]] of [...chapters].entries()) {
		lines.push(`  subgraph c${index} ["${name}"]`);
		for (let scene of members) lines.push(`    ${node(ids, scene)}`);
		lines.push("  end");
	}
	for (let scene of loose) lines.push(`  ${node(ids, scene)}`);
	for (let edge of graph.edges) {
		let to = ids.get(edge.to);
		if (to === undefined) continue;
		lines.push(`  ${ids.get(edge.from)} ${edge.kind === "goto" ? "-->" : "-.->"} ${to}`);
	}
	let endings = new Map<string, string>();
	for (let scene of graph.scenes) {
		for (let key of scene.endings) {
			let id = endings.get(key);
			if (id === undefined) {
				id = `e${endings.size}`;
				endings.set(key, id);
				lines.push(`  ${id}(["${key}"])`);
			}
			lines.push(`  ${ids.get(scene.name)} --> ${id}`);
		}
	}
	return lines.join("\n");
}

/** One scene's node: a box, or a slanted box for a scene with no module. */
function node(ids: ReadonlyMap<string, string>, scene: GraphScene): string {
	let id = ids.get(scene.name) as string;
	return scene.mapped ? `${id}["${scene.name}"]` : `${id}[/"${scene.name}"/]`;
}

/**
 * Lists the message keys a catalog lacks, per locale: every line, notification, menu prompt,
 * option label, locked-option reason and ending of every mapped scene, then scene and chapter
 * titles, character names and sound captions.
 *
 * @param internals - The novel, whose `messages` option holds the catalogs.
 * @returns Every missing key once per locale and scene; empty when the novel has no catalogs.
 */
export async function missingMessages(internals: NovelInternals): Promise<MissingMessage[]> {
	let catalogs = Object.entries(internals.options.messages ?? {});
	if (catalogs.length === 0) return [];
	let missing: MissingMessage[] = [];
	let reported = new Set<string>();
	let report = (key: string | undefined, scene?: string) => {
		if (key === undefined) return;
		for (let [locale, catalog] of catalogs) {
			let id = `${locale}|${scene ?? ""}|${key}`;
			if (hasMessage(catalog, key) || reported.has(id)) continue;
			reported.add(id);
			missing.push(scene === undefined ? { locale, key } : { locale, key, scene });
		}
	};
	for (let scene of internals.mapped) {
		let index = await internals.load(scene);
		if (index.status === "failure") continue;
		eachDirective(index.data.module.directives, (directive) => {
			if (
				directive.type === "say" ||
				directive.type === "narrate" ||
				directive.type === "notify" ||
				directive.type === "ending"
			) {
				report(directive.key, scene);
			}
			if (directive.type !== "choose") return;
			report(directive.prompt, scene);
			for (let option of directive.options) {
				report(option.key, scene);
				report(option.reason, scene);
			}
		});
	}
	for (let declaration of internals.scenes.values()) {
		report(declaration.title);
		report(declaration.chapter?.title);
		report(declaration.chapter?.arc?.title);
	}
	for (let declaration of internals.characters.values()) report(declaration.name);
	for (let declaration of internals.assets.values()) report(declaration.caption);
	return missing;
}

/** Calls `visit` on every directive of a list and of every branch nested in it, in document order. */
function eachDirective(list: readonly Directive[], visit: (directive: Directive) => void): void {
	for (let directive of list) {
		visit(directive);
		if (directive.type === "when") {
			eachDirective(directive.do, visit);
			eachDirective(directive.otherwise, visit);
		}
		if (directive.type === "choose") {
			for (let option of directive.options) eachDirective(option.do, visit);
		}
	}
}
