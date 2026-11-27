/**
 * What a novel's scenes can unlock, read from their directive trees without playing them, and the
 * rules for who counts as met and who the screens list. The extras screens, `check()` and the dev
 * tools all read scenes and characters through this module, so they agree on every unlock.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CharacterDeclaration } from "./declarations.js";
import type { Directive } from "./directives.js";
import type { Speaker } from "./frames.js";

/** A line as a scene's array declares it: its key and who says it, before anyone reads it. */
export interface SceneLine {
	key: string;
	/**
	 * The characters saying it, none for narration; each one named, since the library lists lines
	 * the reader has already read.
	 */
	speakers: Speaker[];
}

/** What counts toward meeting a character, from a play's record or from the scenes themselves. */
export interface MetEvidence {
	/** A scene introduced them. */
	introduced: boolean;
	/** They speak a line: one the reader read, or for `check()`, any line a scene holds. */
	spoke: boolean;
	/** The stage drew them in some look. */
	drawn: boolean;
}

/**
 * The directive lists nested in one directive, each a branch a play may take: a condition's two
 * outcomes, or each menu option's directives.
 *
 * @returns The branches in document order; none for a directive that holds no list.
 */
export function branchesOf(directive: Directive): readonly (readonly Directive[])[] {
	if (directive.type === "when") return [directive.do, directive.otherwise];
	if (directive.type === "choose") return directive.options.map((option) => option.do);
	return [];
}

/**
 * Calls `visit` on every directive of a list and of every branch nested in it, in document order,
 * a branch's directives right after the directive that holds them. Each branch walks with
 * `branch(scope)`, and the list after a branch continues with the scope it had before it.
 *
 * @param list - A scene module's directives.
 * @param scope - What `visit` receives for the top-level list, such as the stage's columns.
 * @param visit - Called once per directive with its list's scope.
 * @param branch - Answers the scope a nested branch starts from.
 * @example walkBranches(directives, new Map(), visit, (slots) => new Map(slots));
 */
export function walkBranches<Scope>(
	list: readonly Directive[],
	scope: Scope,
	visit: (directive: Directive, scope: Scope) => void,
	branch: (scope: Scope) => Scope,
): void {
	for (let directive of list) {
		visit(directive, scope);
		for (let nested of branchesOf(directive)) walkBranches(nested, branch(scope), visit, branch);
	}
}

/**
 * Calls `visit` on every directive of a list and of every branch nested in it, in document order.
 *
 * @param list - A scene module's directives.
 * @param visit - Called once per directive.
 * @example eachDirective(module.directives, (directive) => count(directive.type));
 */
export function eachDirective(
	list: readonly Directive[],
	visit: (directive: Directive) => void,
): void {
	walkBranches(list, undefined, visit, () => undefined);
}

/**
 * Every line a scene declares, in document order, including those inside conditions and menu
 * options; a key repeated in the scene is listed once, where it first appears.
 *
 * @param directives - The scene module's directives.
 * @returns The lines with their speakers.
 * @example sceneLines(module.directives).map((line) => line.key); // ["opening.welcome", "opening.hello"]
 */
export function sceneLines(directives: readonly Directive[]): SceneLine[] {
	let lines = new Map<string, SceneLine>();
	eachDirective(directives, (directive) => {
		if (directive.type === "narrate" && !lines.has(directive.key)) {
			lines.set(directive.key, { key: directive.key, speakers: [] });
		}
		if (directive.type === "say" && !lines.has(directive.key)) {
			let speakers = directive.speakers.map((speaker) =>
				speaker.color === undefined
					? { id: speaker.id, name: speaker.name, introduced: true }
					: { id: speaker.id, name: speaker.name, color: speaker.color, introduced: true },
			);
			lines.set(directive.key, { key: directive.key, speakers });
		}
	});
	return [...lines.values()];
}

/**
 * Every ending key a scene can reach, in document order and each once.
 *
 * @param directives - The scene module's directives.
 * @returns The `ending` directives' keys.
 * @example endingKeys(module.directives); // ["endings.good", "endings.bad"]
 */
export function endingKeys(directives: readonly Directive[]): string[] {
	let keys = new Set<string>();
	eachDirective(directives, (directive) => {
		if (directive.type === "ending") keys.add(directive.key);
	});
	return [...keys];
}

/**
 * Whether the evidence meets a character: being introduced, speaking a line and being drawn on
 * stage each count alone, so the characters screen opens their page after the first of them.
 *
 * @param evidence - What the record or the scenes show of the character.
 * @returns True once any piece of evidence holds.
 */
export function isMet(evidence: MetEvidence): boolean {
	return evidence.introduced || evidence.spoke || evidence.drawn;
}

/**
 * Whether the characters screen lists a character: every one but those declared `listed: false`,
 * which `check()` leaves out of its unmet and unshown reports too.
 *
 * @param character - The declared character.
 * @returns False only for a character declared `listed: false`.
 */
export function isListed(character: CharacterDeclaration): boolean {
	return character.listed !== false;
}
