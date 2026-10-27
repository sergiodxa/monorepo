/**
 * Syllable machines for script shapers: a grammar over per-glyph categories, compiled to a
 * nondeterministic automaton and run as a lazily built deterministic one. Matching takes the
 * longest syllable at each position, so a buffer is split in time linear in its length.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A grammar expression over category numbers. */
export type Pattern =
	| { kind: "symbol"; symbols: readonly number[] }
	| { kind: "sequence"; items: readonly Pattern[] }
	| { kind: "choice"; items: readonly Pattern[] }
	| { kind: "repeat"; item: Pattern; min: number; max: number };

/** One syllable found in a buffer: `start` inclusive, `end` exclusive, and its rule's name. */
export interface Syllable {
	start: number;
	end: number;
	/** The name of the rule that matched, `null` for a run of glyphs no rule matched. */
	type: string | null;
}

/**
 * The longest a syllable may grow; a longer run splits after this many glyphs, which keeps
 * matching linear on hostile input.
 */
const MAX_SYLLABLE_LENGTH = 256;

/** A transition not computed yet. */
const UNKNOWN = -2;

/** The state with no way forward. */
const DEAD = -1;

/**
 * A pattern matching one glyph whose category is any of the given ones.
 *
 * @param symbols - Category numbers.
 */
export function symbol(...symbols: number[]): Pattern {
	return { kind: "symbol", symbols };
}

/**
 * A pattern matching its items one after another.
 *
 * @param items - The patterns in order.
 */
export function sequence(...items: Pattern[]): Pattern {
	return { kind: "sequence", items };
}

/**
 * A pattern matching any one of its items.
 *
 * @param items - The alternatives.
 */
export function choice(...items: Pattern[]): Pattern {
	return { kind: "choice", items };
}

/**
 * A pattern matching its item between `min` and `max` times; `max` may be `Infinity`.
 *
 * @param item - The repeated pattern.
 * @param min - Fewest repetitions.
 * @param max - Most repetitions.
 */
export function repeat(item: Pattern, min: number, max: number): Pattern {
	return { kind: "repeat", item, min, max };
}

/**
 * Zero or one of a pattern.
 *
 * @param items - Patterns matched in sequence.
 */
export function optional(...items: Pattern[]): Pattern {
	return repeat(sequence(...items), 0, 1);
}

/**
 * Zero or more of a pattern.
 *
 * @param items - Patterns matched in sequence.
 */
export function many(...items: Pattern[]): Pattern {
	return repeat(sequence(...items), 0, Infinity);
}

/** One automaton node: its empty moves, and its moves on a category. */
interface Node {
	empty: number[];
	moves: [symbol: number, target: number][];
	/** The index of the rule this node accepts, `-1` when it accepts nothing. */
	accepts: number;
}

/** One deterministic state: its moves by category, filled on first use, and the rule it accepts. */
interface State {
	moves: Int32Array;
	accepts: number;
}

/**
 * Splits a buffer's categories into syllables by a grammar of named rules. When several
 * rules match the same longest syllable, the one listed first names it.
 */
export class SyllableMachine {
	readonly #names: string[];
	readonly #nodes: Node[] = [];
	readonly #alphabet: number;
	readonly #states: State[] = [];
	readonly #stateIds = new Map<string, number>();
	readonly #sets: number[][] = [];
	#start = 0;

	/**
	 * @param rules - The rules as name and pattern pairs, in priority order.
	 */
	constructor(rules: readonly [name: string, pattern: Pattern][]) {
		this.#names = rules.map(([name]) => name);
		let start = this.#node();
		let alphabet = 0;
		rules.forEach(([, pattern], index) => {
			let [from, to] = this.#compile(pattern);
			this.#nodes[start]?.empty.push(from);
			let end = this.#nodes[to];
			if (end !== undefined) end.accepts = index;
		});
		for (let node of this.#nodes) {
			for (let [category] of node.moves) alphabet = Math.max(alphabet, category + 1);
		}
		this.#alphabet = alphabet;
		this.#start = this.#state([start]);
	}

	/**
	 * The syllables of a buffer, covering it from start to end. Glyphs no rule matches are
	 * grouped into syllables of type `null`, one per run.
	 *
	 * @param categories - Each glyph's category number.
	 */
	match(categories: readonly number[]): Syllable[] {
		let syllables: Syllable[] = [];
		let position = 0;
		let unmatched = -1;
		while (position < categories.length) {
			let [end, rule] = this.#longest(categories, position);
			if (end === -1) {
				if (unmatched === -1) unmatched = position;
				position++;
				continue;
			}
			if (unmatched !== -1) syllables.push({ start: unmatched, end: position, type: null });
			unmatched = -1;
			syllables.push({ start: position, end, type: this.#names[rule] ?? null });
			position = end;
		}
		if (unmatched !== -1) syllables.push({ start: unmatched, end: position, type: null });
		return syllables;
	}

	/**
	 * The end of the longest syllable starting at `position` and the rule that names it,
	 * `-1` for both when none starts there.
	 *
	 * @param categories - The buffer's categories.
	 * @param position - Where the syllable starts.
	 */
	#longest(categories: readonly number[], position: number): [end: number, rule: number] {
		let state = this.#start;
		let end = -1;
		let rule = -1;
		let limit = Math.min(categories.length, position + MAX_SYLLABLE_LENGTH);
		for (let index = position; index < limit; index++) {
			state = this.#step(state, categories[index] ?? -1);
			if (state === DEAD) break;
			let accepts = this.#states[state]?.accepts ?? -1;
			if (accepts !== -1) {
				end = index + 1;
				rule = accepts;
			}
		}
		return [end, rule];
	}

	/**
	 * The state after reading one category, computed from the automaton on first use.
	 *
	 * @param from - The current state.
	 * @param category - The glyph's category number.
	 */
	#step(from: number, category: number): number {
		let state = this.#states[from];
		if (state === undefined || category < 0 || category >= this.#alphabet) return DEAD;
		let known = state.moves[category] ?? DEAD;
		if (known !== UNKNOWN) return known;
		let targets: number[] = [];
		for (let id of this.#sets[from] ?? []) {
			for (let [symbol, target] of this.#nodes[id]?.moves ?? []) {
				if (symbol === category) targets.push(target);
			}
		}
		let next = targets.length === 0 ? DEAD : this.#state(targets);
		state.moves[category] = next;
		return next;
	}

	/**
	 * The deterministic state for a set of nodes and every node their empty moves reach.
	 *
	 * @param nodes - The nodes reached.
	 */
	#state(nodes: number[]): number {
		let seen = new Set<number>(nodes);
		let pending = [...nodes];
		while (pending.length > 0) {
			let id = pending.pop() ?? 0;
			for (let next of this.#nodes[id]?.empty ?? []) {
				if (seen.has(next)) continue;
				seen.add(next);
				pending.push(next);
			}
		}
		let members = [...seen].sort((a, b) => a - b);
		let key = members.join(",");
		let existing = this.#stateIds.get(key);
		if (existing !== undefined) return existing;
		let accepts = -1;
		for (let id of members) {
			let rule = this.#nodes[id]?.accepts ?? -1;
			if (rule !== -1 && (accepts === -1 || rule < accepts)) accepts = rule;
		}
		let id = this.#states.length;
		this.#states.push({ moves: new Int32Array(this.#alphabet).fill(UNKNOWN), accepts });
		this.#sets.push(members);
		this.#stateIds.set(key, id);
		return id;
	}

	/** A new node with no moves. */
	#node(): number {
		this.#nodes.push({ empty: [], moves: [], accepts: -1 });
		return this.#nodes.length - 1;
	}

	/**
	 * Builds the nodes for a pattern and answers its entry and exit node.
	 *
	 * @param pattern - The pattern.
	 */
	#compile(pattern: Pattern): [from: number, to: number] {
		let from = this.#node();
		let to = from;
		switch (pattern.kind) {
			case "symbol": {
				to = this.#node();
				for (let category of pattern.symbols) this.#nodes[from]?.moves.push([category, to]);
				break;
			}
			case "sequence": {
				for (let item of pattern.items) {
					let [entry, exit] = this.#compile(item);
					this.#nodes[to]?.empty.push(entry);
					to = exit;
				}
				break;
			}
			case "choice": {
				to = this.#node();
				for (let item of pattern.items) {
					let [entry, exit] = this.#compile(item);
					this.#nodes[from]?.empty.push(entry);
					this.#nodes[exit]?.empty.push(to);
				}
				break;
			}
			case "repeat":
				to = this.#compileRepeat(pattern, from);
				break;
		}
		return [from, to];
	}

	/**
	 * Builds a bounded repetition as copies of its item, and an unbounded one as a loop
	 * after its required copies.
	 *
	 * @param pattern - The repetition.
	 * @param from - Its entry node.
	 * @returns Its exit node.
	 */
	#compileRepeat(pattern: Extract<Pattern, { kind: "repeat" }>, from: number): number {
		let to = from;
		for (let count = 0; count < pattern.min; count++) {
			let [entry, exit] = this.#compile(pattern.item);
			this.#nodes[to]?.empty.push(entry);
			to = exit;
		}
		if (pattern.max === Infinity) {
			let [entry, exit] = this.#compile(pattern.item);
			this.#nodes[to]?.empty.push(entry);
			this.#nodes[exit]?.empty.push(to);
			return to;
		}
		let end = this.#node();
		this.#nodes[to]?.empty.push(end);
		for (let count = pattern.min; count < pattern.max; count++) {
			let [entry, exit] = this.#compile(pattern.item);
			this.#nodes[to]?.empty.push(entry);
			this.#nodes[exit]?.empty.push(end);
			to = exit;
		}
		return end;
	}
}
