/**
 * Positions inside a scene. The engine walks a scene by path (indices into the directive tree,
 * with a branch name between nesting levels) and saves by anchor (a message key), so a save
 * survives beats added or removed anywhere else in the scene.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ChooseDirective, Directive, SceneModule } from "./directives.js";

/**
 * Where the engine stands in a scene: `[index, branch, index, …]`, where a branch is `do`,
 * `otherwise` or `option:<key>`, and the last index names the next directive to run.
 */
export type Path = (number | string)[];

/** A loaded scene with its anchors indexed both ways. */
export interface SceneIndex {
	readonly module: SceneModule;
	/** The path of every anchored directive, by anchor. */
	readonly paths: ReadonlyMap<string, Path>;
	/** The anchor of every anchored directive, by its path as JSON. */
	readonly anchors: ReadonlyMap<string, string>;
}

/** The selector a menu option's branch is named by in a path. */
const OPTION_PREFIX = "option:";

/** The running state of the walk that names anchors. */
interface AnchorWalk {
	previous: string;
	count: number;
	paths: Map<string, Path>;
	anchors: Map<string, string>;
}

/**
 * Indexes a scene's anchors. A line is anchored on its key and a menu on its prompt key (its
 * first option's key without one); a pause, interaction or call is anchored on the key before
 * it in document order and its count since that key (`opening.hello+1`).
 *
 * @param module - The scene's module.
 * @returns The scene with its anchors indexed; a repeated anchor keeps its first path.
 */
export function indexScene(module: SceneModule): SceneIndex {
	let walk: AnchorWalk = { previous: "", count: 0, paths: new Map(), anchors: new Map() };
	walkList(module.directives, [], walk);
	return { module, paths: walk.paths, anchors: walk.anchors };
}

/** Names the anchors of one list of directives and of every list nested in it. */
function walkList(list: readonly Directive[], prefix: Path, walk: AnchorWalk): void {
	for (let [index, directive] of list.entries()) {
		let path = [...prefix, index];
		if (directive.type === "say" || directive.type === "narrate") {
			record(walk, directive.key, path);
		} else if (directive.type === "choose") {
			let anchor = menuAnchor(directive);
			if (anchor !== undefined) record(walk, anchor, path);
			for (let option of directive.options) {
				walkList(option.do, [...path, `${OPTION_PREFIX}${option.key}`], walk);
			}
		} else if (directive.type === "when") {
			walkList(directive.do, [...path, "do"], walk);
			walkList(directive.otherwise, [...path, "otherwise"], walk);
		} else if (
			directive.type === "wait" ||
			directive.type === "custom" ||
			directive.type === "call"
		) {
			walk.count += 1;
			let anchor = `${walk.previous}+${walk.count}`;
			if (!walk.paths.has(anchor)) walk.paths.set(anchor, path);
			walk.anchors.set(JSON.stringify(path), anchor);
		}
	}
}

/** Records a keyed anchor and restarts the count of unkeyed ones after it. */
function record(walk: AnchorWalk, anchor: string, path: Path): void {
	if (!walk.paths.has(anchor)) walk.paths.set(anchor, path);
	walk.anchors.set(JSON.stringify(path), anchor);
	walk.previous = anchor;
	walk.count = 0;
}

/**
 * The anchor of a menu.
 *
 * @param menu - The menu.
 * @returns Its prompt key, its first option's key, or `undefined` for a menu with neither.
 */
export function menuAnchor(menu: ChooseDirective): string | undefined {
	return menu.prompt ?? menu.options[0]?.key;
}

/**
 * The directive a path names.
 *
 * @param directives - The scene's directives.
 * @param path - A path into them.
 * @returns The directive, or `undefined` past the end of its list.
 */
export function directiveAt(directives: readonly Directive[], path: Path): Directive | undefined {
	let list = directives;
	for (let step = 0; step < path.length; step += 2) {
		let directive = list[path[step] as number];
		if (step === path.length - 1 || directive === undefined) return directive;
		let branch = branchOf(directive, path[step + 1] as string);
		if (branch === undefined) return undefined;
		list = branch;
	}
	return undefined;
}

/**
 * The list a branch selector names inside a directive.
 *
 * @param directive - A `when` or a `choose`.
 * @param selector - `do`, `otherwise` or `option:<key>`.
 * @returns The branch's directives, or `undefined` when the directive has no such branch.
 */
export function branchOf(directive: Directive, selector: string): readonly Directive[] | undefined {
	if (directive.type === "when") return selector === "do" ? directive.do : directive.otherwise;
	if (directive.type === "choose") return optionOf(directive, selector)?.do;
	return undefined;
}

/**
 * The option a branch selector names in a menu.
 *
 * @param menu - The menu.
 * @param selector - `option:<key>`.
 * @returns The option, or `undefined` when the menu has none by that key.
 */
export function optionOf(
	menu: ChooseDirective,
	selector: string,
): ChooseDirective["options"][number] | undefined {
	if (!selector.startsWith(OPTION_PREFIX)) return undefined;
	let key = selector.slice(OPTION_PREFIX.length);
	return menu.options.find((option) => option.key === key);
}

/**
 * The path into a menu option's branch.
 *
 * @param path - The menu's path.
 * @param key - The option's key.
 * @returns The path of the option's first directive.
 */
export function enterOption(path: Path, key: string): Path {
	return [...path, `${OPTION_PREFIX}${key}`, 0];
}

/**
 * The path of the directive after the one a path names, in the same list.
 *
 * @param path - A path.
 * @returns The path with its last index moved on by one.
 */
export function nextPath(path: Path): Path {
	return [...path.slice(0, -1), (path.at(-1) as number) + 1];
}
