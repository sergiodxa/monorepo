/**
 * `check()`: static checks over a novel's scene arrays, run without playing a line. A scene is
 * data, so every key, jump, asset, stage position and menu can be read from its directives and
 * reported before a player ever reaches it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AssetDeclaration, CharacterDeclaration } from "./declarations.js";
import type { ChooseDirective, Directive } from "./directives.js";
import type { MessageCatalog, Novel, NovelInternals } from "./novel.js";
import type { Fraction } from "./stage.js";

import { menuAnchor } from "./anchors.js";
import { jumpOf } from "./directives.js";
import { hasMessage, INTERNALS } from "./novel.js";

/**
 * One finding. `error`s break a play or a save (a duplicate anchor, a jump with no module, an
 * undeclared asset, a notification a catalog lacks, a module that fails to load); `warning`s may be intended (characters sharing
 * a column, a menu that may offer nothing, a scene nothing reaches).
 */
export type CheckProblem =
	| { code: "duplicate-key"; severity: "error"; scene: string; key: string }
	| { code: "unmapped-scene"; severity: "error"; scene: string; target: string }
	| { code: "missing-asset"; severity: "error"; scene: string; asset: string }
	| { code: "load-failed"; severity: "error"; scene: string; message: string }
	| { code: "missing-message"; severity: "error"; scene: string; key: string; locale: string }
	| {
			code: "shared-slot";
			severity: "warning";
			scene: string;
			at: Fraction;
			characters: string[];
	  }
	| { code: "dead-end-menu"; severity: "warning"; scene: string; menu: string }
	| { code: "unreachable-scene"; severity: "warning"; scene: string };

/** What `check()` found. */
export interface CheckReport {
	/** True when no problem is an `error`. */
	ok: boolean;
	/** Every finding, scene by scene in mapping order, then the unreachable scenes. */
	problems: CheckProblem[];
}

/** What one scene's walk collects. */
interface SceneWalk {
	scene: string;
	internals: NovelInternals;
	problems: CheckProblem[];
	/** How many times each anchored key appears. */
	keys: Map<string, number>;
	/** The scenes this one jumps to or calls. */
	targets: Set<string>;
	/** Assets and characters already reported, so each is named once per scene. */
	reported: Set<string>;
	/** The novel's catalogs, by locale. */
	catalogs: [string, MessageCatalog][];
}

/**
 * Checks every mapped scene: message keys used twice in a scene (which saves cannot tell
 * apart), `goto` and `call` (every candidate of a pick) to scenes with no module, notification
 * keys a catalog lacks, assets and characters the novel does not
 * declare, two characters in one column at once, menus whose every option is conditional, and
 * declared scenes the initial scene never reaches.
 *
 * @param novel - The novel, with its scenes mapped; lazy modules are loaded.
 * @returns The findings.
 * @example let report = await check(novel); expect(report.problems).toEqual([]);
 */
export async function check(novel: Novel): Promise<CheckReport> {
	let internals = novel[INTERNALS]();
	let problems: CheckProblem[] = [];
	let edges = new Map<string, Set<string>>();
	let catalogs = Object.entries(internals.options.messages ?? {});
	for (let scene of internals.mapped) {
		let index = await internals.load(scene);
		if (index.status === "failure") {
			problems.push({
				code: "load-failed",
				severity: "error",
				scene,
				message: index.error.message,
			});
			continue;
		}
		let walk: SceneWalk = {
			scene,
			internals,
			problems,
			keys: new Map(),
			targets: new Set(),
			reported: new Set(),
			catalogs,
		};
		walkList(index.data.module.directives, walk, new Map());
		for (let [key, count] of walk.keys) {
			if (count > 1) problems.push({ code: "duplicate-key", severity: "error", scene, key });
		}
		edges.set(scene, walk.targets);
	}
	let reached = reachable(internals.options.initial.name, edges);
	for (let scene of internals.scenes.keys()) {
		if (!reached.has(scene))
			problems.push({ code: "unreachable-scene", severity: "warning", scene });
	}
	return { ok: problems.every((problem) => problem.severity !== "error"), problems };
}

/**
 * Walks one list of directives in document order. `slots` maps each character on stage to its
 * column; a branch walks a copy, and the list after it continues from the stage before it.
 */
function walkList(list: readonly Directive[], walk: SceneWalk, slots: Map<string, Fraction>): void {
	for (let directive of list) {
		switch (directive.type) {
			case "say":
				count(walk, directive.key);
				for (let speaker of directive.speakers) declared(walk, speaker);
				break;
			case "narrate":
				count(walk, directive.key);
				break;
			case "notify":
				translated(walk, directive.key);
				break;
			case "choose":
				menu(directive, walk, slots);
				break;
			case "when":
				walkList(directive.do, walk, new Map(slots));
				walkList(directive.otherwise, walk, new Map(slots));
				break;
			case "goto":
			case "call":
			case "pick":
				for (let target of jumpOf(directive)?.scenes ?? []) jump(walk, target.name);
				break;
			case "show":
			case "hide":
			case "play":
				declared(walk, directive.asset);
				break;
			case "stop":
				if (directive.asset !== undefined) declared(walk, directive.asset);
				break;
			case "enter":
			case "move":
				declared(walk, directive.character);
				place(walk, slots, directive.character.id, walk.internals.position(directive.at));
				break;
			case "exit":
				declared(walk, directive.character);
				slots.delete(directive.character.id);
				break;
			case "express":
				declared(walk, directive.character);
				break;
			default:
				break;
		}
	}
}

/** Counts a menu's anchor, flags a menu that may offer nothing, and walks every option. */
function menu(directive: ChooseDirective, walk: SceneWalk, slots: Map<string, Fraction>): void {
	let anchor = menuAnchor(directive);
	if (anchor !== undefined) count(walk, anchor);
	if (directive.options.every((option) => option.when !== undefined)) {
		walk.problems.push({
			code: "dead-end-menu",
			severity: "warning",
			scene: walk.scene,
			menu: anchor ?? "",
		});
	}
	for (let option of directive.options) walkList(option.do, walk, new Map(slots));
}

/** Counts one anchored key. */
function count(walk: SceneWalk, key: string): void {
	walk.keys.set(key, (walk.keys.get(key) ?? 0) + 1);
}

/** Records a jump, and reports it when the target scene has no module. */
function jump(walk: SceneWalk, target: string): void {
	walk.targets.add(target);
	if (walk.internals.mapped.includes(target)) return;
	let id = `jump:${target}`;
	if (walk.reported.has(id)) return;
	walk.reported.add(id);
	walk.problems.push({ code: "unmapped-scene", severity: "error", scene: walk.scene, target });
}

/**
 * Reports a notification key a catalog lacks, once per scene and locale. A notification shows
 * in no frame, so this is where a missing one is caught before a player passes it.
 */
function translated(walk: SceneWalk, key: string): void {
	for (let [locale, catalog] of walk.catalogs) {
		let id = `message:${locale}:${key}`;
		if (hasMessage(catalog, key) || walk.reported.has(id)) continue;
		walk.reported.add(id);
		walk.problems.push({
			code: "missing-message",
			severity: "error",
			scene: walk.scene,
			key,
			locale,
		});
	}
}

/** Reports an asset or a character the novel does not declare, once per scene. */
function declared(walk: SceneWalk, declaration: AssetDeclaration | CharacterDeclaration): void {
	if (!walk.internals.missing(declaration)) return;
	let asset = "kind" in declaration ? declaration.id : `cast.${declaration.id}`;
	if (walk.reported.has(asset)) return;
	walk.reported.add(asset);
	walk.problems.push({ code: "missing-asset", severity: "error", scene: walk.scene, asset });
}

/** Puts a character in a column, reporting another character already standing there. */
function place(walk: SceneWalk, slots: Map<string, Fraction>, id: string, at: Fraction): void {
	slots.delete(id);
	let sharing = [...slots].filter(([, column]) => column === at).map(([other]) => other);
	slots.set(id, at);
	if (sharing.length === 0) return;
	let characters = [...sharing, id];
	let key = `slot:${at}:${[...characters].sort().join(",")}`;
	if (walk.reported.has(key)) return;
	walk.reported.add(key);
	walk.problems.push({
		code: "shared-slot",
		severity: "warning",
		scene: walk.scene,
		at,
		characters,
	});
}

/** Every scene reachable from `initial` through jumps and calls. */
function reachable(initial: string, edges: ReadonlyMap<string, ReadonlySet<string>>): Set<string> {
	let reached = new Set([initial]);
	let queue = [initial];
	for (let scene = queue.shift(); scene !== undefined; scene = queue.shift()) {
		for (let target of edges.get(scene) ?? []) {
			if (reached.has(target)) continue;
			reached.add(target);
			queue.push(target);
		}
	}
	return reached;
}
