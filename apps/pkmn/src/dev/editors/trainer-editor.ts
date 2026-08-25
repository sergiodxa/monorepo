/**
 * State-holding editor for a trainer-in-progress: every mutation returns the
 * current {@link TrainerDefinition}, so the view re-renders from one snapshot.
 * It enforces the party-size and moves-per-member caps, keeping the in-progress
 * state within what {@link TrainerSchema} accepts; export re-validates the rest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TrainerDefinition, TrainerPartyMember, TrainerQuotes } from "~/content/trainers";

import { MAX_MOVES_PER_MEMBER, MAX_PARTY_SIZE, MIN_LEVEL } from "~/content/trainers";

const DEFAULT_MEMBER_LEVEL = 5;

/**
 * Owns the whole trainer-in-progress; each setter and mutator returns the
 * current {@link TrainerDefinition} so the view renders from a single snapshot.
 */
export class TrainerEditor {
	/** Stable identifier the export path derives the write filename from. */
	#id: string;

	#name: string;

	#spriteId: string | null;

	#quotes: TrainerQuotes;

	/** Array order is the order the trainer sends the members out. */
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

	get partySize(): number {
		return this.#party.length;
	}

	/** True while the party is below {@link MAX_PARTY_SIZE}. */
	get canAddMember(): boolean {
		return this.#party.length < MAX_PARTY_SIZE;
	}

	setId(id: string): TrainerDefinition {
		this.#id = id;
		return this.toDefinition();
	}

	setName(name: string): TrainerDefinition {
		this.#name = name;
		return this.toDefinition();
	}

	/** @param spriteId A manifest image id; `null` clears the sprite. */
	setSpriteId(spriteId: string | null): TrainerDefinition {
		this.#spriteId = spriteId;
		return this.toDefinition();
	}

	/**
	 * @param kind Which of the three battle quotes to set.
	 * @param text The quote text; empty text is accepted.
	 */
	setQuote(kind: keyof TrainerQuotes, text: string): TrainerDefinition {
		this.#quotes = { ...this.#quotes, [kind]: text };
		return this.toDefinition();
	}

	/**
	 * At {@link MAX_PARTY_SIZE} the party is left as it stands, so the cap holds
	 * whether or not the caller checks {@link TrainerEditor.canAddMember} first.
	 *
	 * @param speciesId The species the new member is spawned from.
	 * @param level Starting level; defaults to {@link DEFAULT_MEMBER_LEVEL}.
	 */
	addMember(speciesId: string, level: number = DEFAULT_MEMBER_LEVEL): TrainerDefinition {
		if (this.canAddMember) {
			this.#party.push({ speciesId, level });
		}
		return this.toDefinition();
	}

	/**
	 * An out-of-range index leaves the party as it stands.
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
	 * Swaps the member with its predecessor; the first member and out-of-range
	 * indexes keep the current order.
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
	 * Swaps the member with its successor; the last member and out-of-range
	 * indexes keep the current order.
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
	 * An out-of-range index leaves the party as it stands.
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
	 * Clamps to at least {@link MIN_LEVEL} and truncates to a whole number, so the
	 * stored level is always one the content format accepts.
	 *
	 * @param index Zero-based position of the member.
	 * @param level The desired level.
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
	 * Keeps the non-empty ids up to {@link MAX_MOVES_PER_MEMBER}; when every entry
	 * is blank the `moves` field is dropped so the exported JSON stays clean.
	 *
	 * @param index Zero-based position of the member.
	 * @param moves The desired move ids; blank entries are dropped.
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
	 * Trims the id and name and copies every nested value, so the snapshot stays
	 * independent of the editor once handed out.
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

	#swap(a: number, b: number): void {
		let temp = this.#party[a]!;
		this.#party[a] = this.#party[b]!;
		this.#party[b] = temp;
	}

	/** Copies the moves array too, so snapshots share nothing with the editor. */
	#cloneMember(member: TrainerPartyMember): TrainerPartyMember {
		let copy: TrainerPartyMember = { speciesId: member.speciesId, level: member.level };
		if (member.moves) copy.moves = [...member.moves];
		return copy;
	}
}
