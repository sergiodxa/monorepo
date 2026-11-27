/**
 * `check()`: static checks over a novel's scene arrays, run without playing a line. A scene is
 * data, so every key, jump, asset, stage position and menu can be read from its directives and
 * reported before a player ever reaches it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CharacterDeclaration, SceneReference } from "./declarations.js";
import type { ChooseDirective, Directive } from "./directives.js";
import type { MessageCatalog, Novel, NovelInternals } from "./novel.js";
import type { Fraction, StageCharacter } from "./stage.js";

import { menuAnchor } from "./anchors.js";
import { referenceName } from "./declarations.js";
import { jumpOf } from "./directives.js";
import { drawCharacter } from "./engine.js";
import { hasMessage, INTERNALS } from "./novel.js";
import { lookKey } from "./persistent.js";
import { isListed, isMet, walkBranches } from "./unlocks.js";

/**
 * One finding. `error`s break a play or a save; `warning`s may be intended. The `un*` warnings
 * name an extra every play keeps locked: a sprite, CG, track or entry no scene draws, shows,
 * plays or teaches, and a listed, unknown character no scene introduces, gives a line or draws.
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
	| { code: "known-introduced"; severity: "warning"; scene: string; character: string }
	| { code: "unreachable-scene"; severity: "warning"; scene: string }
	| { code: "unshown-sprite"; severity: "warning"; character: string; sprite: string }
	| { code: "unmet-character"; severity: "warning"; character: string }
	| { code: "unshown-image"; severity: "warning"; asset: string }
	| { code: "unplayed-music"; severity: "warning"; asset: string }
	| { code: "unlearned-entry"; severity: "warning"; entry: string };

/** What `check()` found. */
export interface CheckReport {
	/** True when no problem is an `error`. */
	ok: boolean;
	/**
	 * Every finding, scene by scene in mapping order, then the unreachable scenes, then what no
	 * scene unlocks: the cast, images, music and entries in declaration order.
	 */
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
	/** What every scene walked so far shows, plays, teaches or introduces. */
	unlocks: Unlocks;
}

/**
 * What the scenes can unlock for the extras screens, read from every branch of every mapped
 * scene, so something one branch shows counts the way a play down that branch records it.
 */
interface Unlocks {
	/** Characters a scene introduces. */
	introduced: Set<string>;
	/** Characters speaking a line. */
	spoke: Set<string>;
	/** Characters the stage draws in any look. */
	drawn: Set<string>;
	/** Sprites drawn, as `lookKey` names them. */
	sprites: Set<string>;
	/** Image (CG) and music asset ids shown or played. */
	assets: Set<string>;
	/** Entry ids a scene teaches. */
	entries: Set<string>;
}

/**
 * Checks every mapped scene, every branch included: duplicate keys, jumps with no module,
 * undeclared assets and messages, shared columns, possible dead ends and scenes nothing reaches;
 * once every scene loads, also the extras no scene unlocks.
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
	let unlocks: Unlocks = {
		introduced: new Set(),
		spoke: new Set(),
		drawn: new Set(),
		sprites: new Set(),
		assets: new Set(),
		entries: new Set(),
	};
	let loaded = true;
	for (let scene of internals.mapped) {
		let index = await internals.load(scene);
		if (index.status === "failure") {
			problems.push({
				code: "load-failed",
				severity: "error",
				scene,
				message: index.error.message,
			});
			loaded = false;
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
			unlocks,
		};
		walkBranches(
			index.data.module.directives,
			new Map<string, Fraction>(),
			(directive, slots) => visit(directive, walk, slots),
			(slots) => new Map(slots),
		);
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
	if (loaded) problems.push(...locked(internals, unlocks));
	return { ok: problems.every((problem) => problem.severity !== "error"), problems };
}

/**
 * Checks one directive. `slots` maps each character on stage to its column for the list the
 * directive sits in; each branch starts from a copy, so a branch's moves never leak past it.
 */
function visit(directive: Directive, walk: SceneWalk, slots: Map<string, Fraction>): void {
	switch (directive.type) {
		case "say":
			count(walk, directive.key);
			for (let speaker of directive.speakers) {
				declared(walk, speaker);
				walk.unlocks.spoke.add(speaker.id);
			}
			break;
		case "narrate":
			count(walk, directive.key);
			break;
		case "notify":
			translated(walk, directive.key);
			break;
		case "choose":
			menu(directive, walk);
			break;
		case "goto":
		case "call":
		case "pick":
			for (let target of jumpOf(directive)?.scenes ?? []) jump(walk, target.name);
			break;
		case "show":
		case "play":
			declared(walk, directive.asset);
			walk.unlocks.assets.add(directive.asset.id);
			break;
		case "hide":
			declared(walk, directive.asset);
			break;
		case "stop":
			if (directive.asset !== undefined) declared(walk, directive.asset);
			break;
		case "enter": {
			declared(walk, directive.character);
			let at = walk.internals.position(directive.at);
			place(walk, slots, directive.character.id, at);
			let standing: StageCharacter = { id: directive.character.id, at, images: [] };
			if (directive.expression !== undefined) standing.expression = directive.expression;
			if (directive.layers !== undefined) standing.layers = directive.layers;
			drawn(walk, directive.character, standing);
			break;
		}
		case "move":
			declared(walk, directive.character);
			place(walk, slots, directive.character.id, walk.internals.position(directive.at));
			break;
		case "exit":
			declared(walk, directive.character);
			slots.delete(directive.character.id);
			break;
		case "clear":
			slots.clear();
			break;
		case "learn":
			declared(walk, directive.entry);
			walk.unlocks.entries.add(directive.entry.id);
			break;
		case "learnBio":
			declared(walk, directive.character);
			if (directive.character.bio?.[directive.section] === undefined) {
				let asset = `cast.${directive.character.id}:${directive.section}`;
				if (!walk.reported.has(asset)) {
					walk.reported.add(asset);
					walk.problems.push({
						code: "missing-asset",
						severity: "error",
						scene: walk.scene,
						asset,
					});
				}
			}
			break;
		case "introduce":
			declared(walk, directive.character);
			walk.unlocks.introduced.add(directive.character.id);
			if (directive.character.known) {
				walk.problems.push({
					code: "known-introduced",
					severity: "warning",
					scene: walk.scene,
					character: directive.character.id,
				});
			}
			break;
		case "express":
			declared(walk, directive.character);
			if (directive.expression !== undefined) {
				let at = slots.get(directive.character.id) ?? "1/2";
				let standing: StageCharacter = { id: directive.character.id, at, images: [] };
				standing.expression = directive.expression;
				drawn(walk, directive.character, standing);
			}
			break;
		default:
			break;
	}
}

/** Counts a menu's anchor and flags a menu that may offer nothing; the walk visits its options. */
function menu(directive: ChooseDirective, walk: SceneWalk): void {
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

/** Reports an asset, a character or an entry the novel does not declare, once per scene. */
function declared(walk: SceneWalk, declaration: SceneReference): void {
	if (!walk.internals.missing(declaration)) return;
	let asset = referenceName(declaration);
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

/**
 * Records a character the stage draws: met once any image shows, and the sprite it shows. The
 * stage resolves a missing or unknown expression to the first sprite, and so does this.
 */
function drawn(walk: SceneWalk, character: CharacterDeclaration, standing: StageCharacter): void {
	let drawing = drawCharacter(character, standing);
	if (drawing.images.length === 0) return;
	walk.unlocks.drawn.add(character.id);
	if (character.image.kind === "sprites" && drawing.expression !== undefined) {
		walk.unlocks.sprites.add(lookKey(character.id, drawing.expression));
	}
}

/**
 * What the extras screens would keep locked in every play. A character declared `known` counts
 * as met, and one declared `listed: false` is skipped, since the characters screen leaves it
 * out; backgrounds, ambience and sounds have no extras screen, so only CGs and music count.
 */
function locked(internals: NovelInternals, unlocks: Unlocks): CheckProblem[] {
	let problems: CheckProblem[] = [];
	for (let character of internals.characters.values()) {
		if (!isListed(character)) continue;
		let met = isMet({
			introduced: unlocks.introduced.has(character.id),
			spoke: unlocks.spoke.has(character.id),
			drawn: unlocks.drawn.has(character.id),
		});
		if (!character.known && !met) {
			problems.push({ code: "unmet-character", severity: "warning", character: character.id });
		}
		if (character.image.kind !== "sprites") continue;
		for (let sprite of Object.keys(character.image.sprites)) {
			if (unlocks.sprites.has(lookKey(character.id, sprite))) continue;
			problems.push({
				code: "unshown-sprite",
				severity: "warning",
				character: character.id,
				sprite,
			});
		}
	}
	for (let asset of internals.assets.values()) {
		if (unlocks.assets.has(asset.id)) continue;
		if (asset.kind === "image") {
			problems.push({ code: "unshown-image", severity: "warning", asset: asset.id });
		} else if (asset.kind === "music") {
			problems.push({ code: "unplayed-music", severity: "warning", asset: asset.id });
		}
	}
	for (let entry of internals.entries.values()) {
		if (entry.known || unlocks.entries.has(entry.id)) continue;
		problems.push({ code: "unlearned-entry", severity: "warning", entry: entry.id });
	}
	return problems;
}
