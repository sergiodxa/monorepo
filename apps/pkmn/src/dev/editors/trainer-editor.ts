/**
 * State-holding editor for a trainer-in-progress, built on the canonical editor
 * class pattern. A plain class (no framework coupling) that owns ALL editor
 * state: the trainer's id, name, sprite, three quotes, and its ordered party of
 * members. The view constructs it once in component setup and drives every
 * control through it; each mutation method returns the current
 * {@link TrainerDefinition} snapshot so the view can re-render from one value.
 *
 * The class stays pure and DOM-free — it never validates against a live roster
 * or writes to disk. It only enforces the structural bounds the content format
 * cares about (party size and moves-per-member caps) so the in-progress state can
 * never drift past what {@link TrainerSchema} accepts; the view supplies the real
 * species/move ids, and the export path re-validates the final definition.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TrainerDefinition, TrainerPartyMember, TrainerQuotes } from "~/content/trainers";

import { MAX_MOVES_PER_MEMBER, MAX_PARTY_SIZE, MIN_LEVEL } from "~/content/trainers";

/** The level a freshly added party member starts at before the author edits it. */
const DEFAULT_MEMBER_LEVEL = 5;

/**
 * Editor for a single trainer definition. Wraps mutable fields and a party list,
 * exposing pure setters/mutators that each return the current
 * {@link TrainerDefinition} so the view renders from a single snapshot.
 */
export class TrainerEditor {
	/** Stable identifier the export path derives the write filename from. */
	#id: string;

	/** Display name shown in battle intro/defeat lines. */
	#name: string;

	/** Manifest image id for the trainer's sprite, or `null` for none. */
	#spriteId: string | null;

	/** The three battle quotes (intro/win/lose). */
	#quotes: TrainerQuotes;

	/** The ordered party members the trainer sends out. */
	#party: TrainerPartyMember[];

	/**
	 * @param initial An existing definition to seed the editor from; omitted for a
	 *   fresh, empty trainer.
	 */
	constructor(initial?: TrainerDefinition) {
		this.#id = initial?.id ?? "";
		this.#name = initial?.name ?? "";
		this.#spriteId = initial?.spriteId ?? null;
		this.#quotes = {
			intro: initial?.quotes.intro ?? "",
			win: initial?.quotes.win ?? "",
			lose: initial?.quotes.lose ?? "",
		};
		this.#party = (initial?.party ?? []).map((member) => this.#cloneMember(member));
	}

	/** Current number of party members. */
	get partySize(): number {
		return this.#party.length;
	}

	/** Whether another party member may still be added (below the cap). */
	get canAddMember(): boolean {
		return this.#party.length < MAX_PARTY_SIZE;
	}

	/** Sets the trainer id and returns the current snapshot. */
	setId(id: string): TrainerDefinition {
		this.#id = id;
		return this.toDefinition();
	}

	/** Sets the display name and returns the current snapshot. */
	setName(name: string): TrainerDefinition {
		this.#name = name;
		return this.toDefinition();
	}

	/**
	 * Sets the sprite to a manifest image id, or clears it with `null`, and returns
	 * the current snapshot.
	 *
	 * @param spriteId A manifest image id, or `null` for a trainer with no sprite.
	 */
	setSpriteId(spriteId: string | null): TrainerDefinition {
		this.#spriteId = spriteId;
		return this.toDefinition();
	}

	/**
	 * Sets one of the three battle quotes and returns the current snapshot.
	 *
	 * @param kind Which quote to set.
	 * @param text The quote text (may be empty).
	 */
	setQuote(kind: keyof TrainerQuotes, text: string): TrainerDefinition {
		this.#quotes = { ...this.#quotes, [kind]: text };
		return this.toDefinition();
	}

	/**
	 * Appends a new party member seeded with `speciesId` (and no moves), unless the
	 * party is already at {@link MAX_PARTY_SIZE}. Returns the current snapshot.
	 *
	 * @param speciesId The species the new member is spawned from.
	 * @param level Optional starting level; defaults to {@link DEFAULT_MEMBER_LEVEL}.
	 */
	addMember(speciesId: string, level: number = DEFAULT_MEMBER_LEVEL): TrainerDefinition {
		if (this.canAddMember) {
			this.#party.push({ speciesId, level });
		}
		return this.toDefinition();
	}

	/**
	 * Removes the party member at `index` (a no-op for an out-of-range index) and
	 * returns the current snapshot.
	 *
	 * @param index Zero-based position of the member to remove.
	 */
	removeMember(index: number): TrainerDefinition {
		if (index >= 0 && index < this.#party.length) {
			this.#party.splice(index, 1);
		}
		return this.toDefinition();
	}

	/**
	 * Moves the party member at `index` one slot toward the front, swapping it with
	 * its predecessor. A no-op for the first member or an out-of-range index.
	 * Returns the current snapshot.
	 *
	 * @param index Zero-based position of the member to move up.
	 */
	moveMemberUp(index: number): TrainerDefinition {
		if (index > 0 && index < this.#party.length) {
			this.#swap(index, index - 1);
		}
		return this.toDefinition();
	}

	/**
	 * Moves the party member at `index` one slot toward the back, swapping it with
	 * its successor. A no-op for the last member or an out-of-range index. Returns
	 * the current snapshot.
	 *
	 * @param index Zero-based position of the member to move down.
	 */
	moveMemberDown(index: number): TrainerDefinition {
		if (index >= 0 && index < this.#party.length - 1) {
			this.#swap(index, index + 1);
		}
		return this.toDefinition();
	}

	/**
	 * Sets the species of the member at `index` and returns the current snapshot.
	 * A no-op for an out-of-range index.
	 *
	 * @param index Zero-based position of the member.
	 * @param speciesId The species to assign.
	 */
	setMemberSpecies(index: number, speciesId: string): TrainerDefinition {
		let member = this.#party[index];
		if (member) member.speciesId = speciesId;
		return this.toDefinition();
	}

	/**
	 * Sets the level of the member at `index`, clamped to at least {@link MIN_LEVEL}
	 * and coerced to a whole number, and returns the current snapshot. A no-op for
	 * an out-of-range index.
	 *
	 * @param index Zero-based position of the member.
	 * @param level The desired level (clamped/truncated to a valid whole number).
	 */
	setMemberLevel(index: number, level: number): TrainerDefinition {
		let member = this.#party[index];
		if (member) {
			let whole = Number.isFinite(level) ? Math.trunc(level) : MIN_LEVEL;
			member.level = Math.max(MIN_LEVEL, whole);
		}
		return this.toDefinition();
	}

	/**
	 * Replaces the move list of the member at `index`, keeping only non-empty ids
	 * and capping the count at {@link MAX_MOVES_PER_MEMBER}. An empty resulting list
	 * drops the `moves` field entirely so the JSON stays clean. A no-op for an
	 * out-of-range index. Returns the current snapshot.
	 *
	 * @param index Zero-based position of the member.
	 * @param moves The desired move ids (blank entries are dropped).
	 */
	setMemberMoves(index: number, moves: string[]): TrainerDefinition {
		let member = this.#party[index];
		if (member) {
			let cleaned = moves.filter((move) => move.length > 0).slice(0, MAX_MOVES_PER_MEMBER);
			if (cleaned.length > 0) member.moves = cleaned;
			else delete member.moves;
		}
		return this.toDefinition();
	}

	/**
	 * Serializes the current editor state to a JSON-clean {@link TrainerDefinition}.
	 * Trims the id/name and returns fresh copies of every nested value so callers
	 * cannot mutate the editor's internal state through the snapshot.
	 *
	 * @returns The current trainer definition.
	 */
	toDefinition(): TrainerDefinition {
		return {
			id: this.#id.trim(),
			name: this.#name.trim(),
			spriteId: this.#spriteId,
			quotes: { ...this.#quotes },
			party: this.#party.map((member) => this.#cloneMember(member)),
		};
	}

	/** Swaps two party members in place. */
	#swap(a: number, b: number): void {
		let temp = this.#party[a]!;
		this.#party[a] = this.#party[b]!;
		this.#party[b] = temp;
	}

	/** Returns a deep-enough copy of a party member (moves array copied). */
	#cloneMember(member: TrainerPartyMember): TrainerPartyMember {
		let copy: TrainerPartyMember = { speciesId: member.speciesId, level: member.level };
		if (member.moves) copy.moves = [...member.moves];
		return copy;
	}
}
