/**
 * Trainer tool view — a content-authoring form built on the canonical tool-view
 * pattern. The component constructs a {@link TrainerEditor} once in setup and
 * drives every control through it: identity fields (id, name), a sprite picker
 * (any manifest image id, or none), the three battle quotes, and a party builder
 * that adds up to {@link MAX_PARTY_SIZE} members — each choosing a species from
 * the real roster, a level, and up to four moves. There are no framework hooks:
 * local state lives in setup-scope variables and the component re-renders through
 * `handle.update()` when a control changes it.
 *
 * The species and move option lists come from the real content roster (`SPECIES`
 * / `MOVES`) so an author can only pick ids that exist, and the sprite options
 * come from the asset manifest's `images`. Export serializes the current
 * definition and POSTs it to the trainer export action, which validates it,
 * writes `src/content/trainers/<id>.json` behind the shared path-safety guard,
 * and reports where the file landed inline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css, on } from "remix/ui";

import type { TrainerDefinition, TrainerQuotes } from "~/content/trainers";

import manifest from "~/content/manifest.json";
import { MOVES } from "~/content/moves";
import { SPECIES } from "~/content/species";
import { MAX_MOVES_PER_MEMBER, MAX_PARTY_SIZE } from "~/content/trainers";

import { TrainerEditor } from "../editors/trainer-editor";

/** The style-object shape the `css()` mixin accepts, used for shared base styles. */
type Styles = Parameters<typeof css>[0];

/** Sentinel `<option>` value meaning "no sprite" in the sprite picker. */
const NO_SPRITE = "";

/** Sentinel `<option>` value meaning "no move" in a move slot picker. */
const NO_MOVE = "";

/** Sorted list of real species ids the party species picker offers. */
const SPECIES_IDS = Object.keys(SPECIES).sort();

/** Sorted list of real move ids the move slot pickers offer. */
const MOVE_IDS = Object.keys(MOVES).sort();

/** Sorted list of manifest image ids the sprite picker offers. */
const SPRITE_IDS = Object.keys(manifest.images).sort();

/** Shared base style for text/number inputs and selectors. */
const FIELD: Styles = {
	padding: "0.35rem 0.5rem",
	fontFamily: "inherit",
	color: "#e5e7eb",
	background: "#18181b",
	border: "1px solid #3f3f46",
	borderRadius: "0.375rem",
};

/** Shared style for the small labels above each control group. */
const LABEL = css({ display: "grid", gap: "0.25rem", fontSize: "0.8rem", color: "#9ca3af" });

/** Shared base style for the small control buttons (add/remove/reorder). */
const CONTROL_BUTTON: Styles = {
	padding: "0.35rem 0.6rem",
	fontFamily: "inherit",
	color: "#e5e7eb",
	background: "#18181b",
	border: "1px solid #3f3f46",
	borderRadius: "0.375rem",
	cursor: "pointer",
};

/**
 * Trainer-content authoring tool. Builds a {@link TrainerEditor} in setup, renders
 * the identity/sprite/quote controls and the party builder around it, and exports
 * the authored trainer to `src/content/trainers/<id>.json` on demand.
 *
 * @param handle Component handle used to schedule re-renders on control changes.
 * @returns The render function for the trainer tool.
 */
export function TrainerTool(handle: Handle<Record<string, never>>) {
	let editor = new TrainerEditor();

	// Local UI state, mirrored back into the view on `handle.update()`.
	let trainer: TrainerDefinition = editor.toDefinition();
	let status = "";
	let statusIsError = false;

	/** Adopts a fresh editor snapshot and re-renders. */
	function apply(next: TrainerDefinition) {
		trainer = next;
		void handle.update();
	}

	/** Reports an export outcome inline and re-renders. */
	function report(message: string, isError: boolean) {
		status = message;
		statusIsError = isError;
		void handle.update();
	}

	/** Serializes the current trainer and POSTs it to the export action. */
	async function exportTrainer() {
		if (trainer.id.length === 0) {
			report("Enter a trainer id before exporting.", true);
			return;
		}
		if (trainer.name.length === 0) {
			report("Enter a trainer name before exporting.", true);
			return;
		}
		if (trainer.party.length === 0) {
			report("Add at least one party member before exporting.", true);
			return;
		}

		report("Exporting…", false);
		try {
			let response = await fetch("/dev/export/trainer", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(trainer),
			});
			let data = (await response.json()) as { path?: string; error?: string };
			if (response.ok) report(`Wrote ${data.path}`, false);
			else report(`Export failed: ${data.error ?? response.statusText}`, true);
		} catch (error) {
			report(`Export failed: ${error instanceof Error ? error.message : String(error)}`, true);
		}
	}

	/** Renders the identity controls (id + display name). */
	function renderIdentity() {
		return (
			<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" })}>
				<label mix={LABEL}>
					Id (filename)
					<input
						type="text"
						value={trainer.id}
						placeholder="rival-blue"
						mix={[
							css({ ...FIELD, width: "12rem" }),
							on<HTMLInputElement, "input">("input", (event) => {
								apply(editor.setId((event.target as HTMLInputElement).value));
							}),
						]}
					/>
				</label>
				<label mix={LABEL}>
					Name
					<input
						type="text"
						value={trainer.name}
						placeholder="Blue"
						mix={[
							css({ ...FIELD, width: "12rem" }),
							on<HTMLInputElement, "input">("input", (event) => {
								apply(editor.setName((event.target as HTMLInputElement).value));
							}),
						]}
					/>
				</label>
				<label mix={LABEL}>
					Sprite
					<select
						value={trainer.spriteId ?? NO_SPRITE}
						mix={[
							css(FIELD),
							on<HTMLSelectElement, "change">("change", (event) => {
								let value = (event.target as HTMLSelectElement).value;
								apply(editor.setSpriteId(value === NO_SPRITE ? null : value));
							}),
						]}
					>
						<option value={NO_SPRITE}>None</option>
						{SPRITE_IDS.map((id) => (
							<option key={id} value={id}>
								{id}
							</option>
						))}
					</select>
				</label>
			</div>
		);
	}

	/** Renders the three battle-quote text inputs. */
	function renderQuotes() {
		let quotes: Array<[kind: keyof TrainerQuotes, label: string, placeholder: string]> = [
			["intro", "Intro quote", "Let's battle!"],
			["win", "Win quote", "I knew I'd win!"],
			["lose", "Lose quote", "How could I lose?"],
		];
		return (
			<div mix={css({ display: "grid", gap: "0.75rem" })}>
				{quotes.map(([kind, label, placeholder]) => (
					<label key={kind} mix={LABEL}>
						{label}
						<input
							type="text"
							value={trainer.quotes[kind]}
							placeholder={placeholder}
							mix={[
								css({ ...FIELD, width: "100%", maxWidth: "32rem" }),
								on<HTMLInputElement, "input">("input", (event) => {
									apply(editor.setQuote(kind, (event.target as HTMLInputElement).value));
								}),
							]}
						/>
					</label>
				))}
			</div>
		);
	}

	/** Renders one party member's controls (species, level, reorder/remove, moves). */
	function renderMember(member: TrainerDefinition["party"][number], index: number) {
		let moves = member.moves ?? [];
		return (
			<li
				key={index}
				mix={css({
					display: "grid",
					gap: "0.5rem",
					padding: "0.75rem",
					background: "#18181b",
					border: "1px solid #3f3f46",
					borderRadius: "0.5rem",
				})}
			>
				<div
					mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" })}
				>
					<span mix={css({ fontSize: "0.8rem", color: "#9ca3af", alignSelf: "center" })}>
						#{index + 1}
					</span>
					<label mix={LABEL}>
						Species
						<select
							value={member.speciesId}
							mix={[
								css(FIELD),
								on<HTMLSelectElement, "change">("change", (event) => {
									apply(editor.setMemberSpecies(index, (event.target as HTMLSelectElement).value));
								}),
							]}
						>
							{SPECIES_IDS.map((id) => (
								<option key={id} value={id}>
									{id}
								</option>
							))}
						</select>
					</label>
					<label mix={LABEL}>
						Level
						<input
							type="number"
							min="1"
							max="100"
							value={String(member.level)}
							mix={[
								css({ ...FIELD, width: "5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									apply(
										editor.setMemberLevel(index, Number((event.target as HTMLInputElement).value)),
									);
								}),
							]}
						/>
					</label>
					<button
						type="button"
						mix={[
							css(CONTROL_BUTTON),
							on<HTMLButtonElement, "click">("click", () => apply(editor.moveMemberUp(index))),
						]}
					>
						↑
					</button>
					<button
						type="button"
						mix={[
							css(CONTROL_BUTTON),
							on<HTMLButtonElement, "click">("click", () => apply(editor.moveMemberDown(index))),
						]}
					>
						↓
					</button>
					<button
						type="button"
						mix={[
							css({ ...CONTROL_BUTTON, color: "#fca5a5", borderColor: "#7f1d1d" }),
							on<HTMLButtonElement, "click">("click", () => apply(editor.removeMember(index))),
						]}
					>
						Remove
					</button>
				</div>

				<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.5rem" })}>
					{Array.from({ length: MAX_MOVES_PER_MEMBER }, (_unused, slot) => (
						<label key={slot} mix={LABEL}>
							Move {slot + 1}
							<select
								value={moves[slot] ?? NO_MOVE}
								mix={[
									css(FIELD),
									on<HTMLSelectElement, "change">("change", (event) => {
										let next = [...moves];
										next[slot] = (event.target as HTMLSelectElement).value;
										apply(editor.setMemberMoves(index, next));
									}),
								]}
							>
								<option value={NO_MOVE}>—</option>
								{MOVE_IDS.map((id) => (
									<option key={id} value={id}>
										{id}
									</option>
								))}
							</select>
						</label>
					))}
				</div>
			</li>
		);
	}

	/** Renders the party builder: existing members plus the add-member control. */
	function renderParty() {
		return (
			<div mix={css({ display: "grid", gap: "0.75rem" })}>
				<div mix={css({ display: "flex", gap: "0.75rem", alignItems: "center" })}>
					<h3 mix={css({ margin: 0, fontSize: "1rem" })}>
						Party ({trainer.party.length}/{MAX_PARTY_SIZE})
					</h3>
					<button
						type="button"
						disabled={!editor.canAddMember}
						mix={[
							css({
								...CONTROL_BUTTON,
								cursor: editor.canAddMember ? "pointer" : "not-allowed",
								opacity: editor.canAddMember ? 1 : 0.5,
							}),
							on<HTMLButtonElement, "click">("click", () => {
								let first = SPECIES_IDS[0];
								if (first) apply(editor.addMember(first));
							}),
						]}
					>
						Add member
					</button>
				</div>

				{trainer.party.length === 0 ? (
					<p mix={css({ margin: 0, color: "#9ca3af", fontSize: "0.85rem" })}>
						No party members yet. Add up to {MAX_PARTY_SIZE}.
					</p>
				) : (
					<ul
						mix={css({ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.75rem" })}
					>
						{trainer.party.map((member, index) => renderMember(member, index))}
					</ul>
				)}
			</div>
		);
	}

	return () => (
		<section mix={css({ display: "grid", gap: "1.5rem", justifyItems: "stretch" })}>
			<header mix={css({ display: "grid", gap: "0.25rem" })}>
				<h2 mix={css({ margin: 0, fontSize: "1.25rem" })}>Trainer</h2>
				<p mix={css({ margin: 0, color: "#9ca3af", fontSize: "0.85rem" })}>
					Design a trainer — sprite, name, quotes, and party — then export it to{" "}
					<code>src/content/trainers</code>.
				</p>
			</header>

			{renderIdentity()}
			{renderQuotes()}
			{renderParty()}

			<div mix={css({ display: "flex", gap: "0.75rem", alignItems: "center" })}>
				<button
					type="button"
					mix={[
						css({
							padding: "0.55rem 1rem",
							fontFamily: "inherit",
							color: "#052e16",
							background: "#4ade80",
							border: "none",
							borderRadius: "0.375rem",
							cursor: "pointer",
						}),
						on<HTMLButtonElement, "click">("click", () => void exportTrainer()),
					]}
				>
					Export JSON
				</button>
			</div>

			{status ? (
				<p
					mix={css({
						margin: 0,
						fontSize: "0.85rem",
						color: statusIsError ? "#f87171" : "#4ade80",
					})}
				>
					{status}
				</p>
			) : null}
		</section>
	);
}
