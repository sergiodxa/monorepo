/**
 * Species tool view — a content-authoring form built on the canonical tool-view
 * pattern. The component either EDITS an existing roster species or CREATES a
 * brand-new one, seeds a {@link SpeciesEditor} with it, and drives every control
 * through it: dex number/size, base stats, primary/secondary types, growth rate,
 * catch rate and base experience, gender ratio, EV yield, the level-up learnset
 * (add/remove/sort level → move rows), evolutions (method + target + level/item),
 * and the sprite association (an atlas region or a manifest image). There are no
 * framework hooks: local state lives in setup-scope variables and the component
 * re-renders through `handle.update()` when a control changes it.
 *
 * The form is grouped into labeled, collapsible sections — Identity, Base stats,
 * Training, Learnset, Evolutions, and Sprite — so an author can scan and edit one
 * concern at a time. The header carries an explicit mode switch between "edit
 * existing" (a species picker) and "new species" (an id + name + dex form). The
 * new-species form validates the id against the shared id pattern and flags a
 * collision with any existing roster id BEFORE loading it, so creating a species
 * can never silently overwrite an existing entry; on confirm it seeds the editor
 * with {@link SpeciesEditor.createNew}'s complete valid defaults.
 *
 * The type/growth-rate/egg-group option lists come from the game data enums; the
 * move and species option lists come from the real content roster (`MOVES` /
 * `SPECIES`) so an author can only pick ids that exist; the sprite options come
 * from the asset manifest's atlases and images. Export serializes the edited
 * record and POSTs `{ id, species }` to the species export action, which
 * validates it, adds or replaces that one entry in `src/content/species.json`
 * behind the shared path-safety guard, and reports where the file landed inline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { isFailure } from "@pkg/result";
import { css, on } from "remix/ui";

import type { Species } from "~/game/data/species";

import manifest from "~/content/manifest.json";
import { MOVES } from "~/content/moves";
import { SPECIES } from "~/content/species";
import { EvolutionMethod } from "~/game/data/evolution";
import { GrowthRate } from "~/game/data/growth-rate";
import { EggGroup, Gender } from "~/game/data/species";
import { Stat } from "~/game/data/stat";
import { Type } from "~/game/data/type";

import { SpeciesEditor } from "../editors/species-editor";
import { SPECIES_ID_PATTERN, validateSpeciesId } from "../species-id";

/** The style-object shape the `css()` mixin accepts, used for shared base styles. */
type Styles = Parameters<typeof css>[0];

/** Which flow the header is in: editing an existing species or creating a new one. */
type Mode = "edit" | "new";

/** Sentinel `<option>` value meaning "no secondary type" / "no sprite". */
const NONE = "";

/** Sorted list of real species ids the picker and evolution targets offer. */
const SPECIES_IDS = Object.keys(SPECIES).sort();

/** Sorted list of real move ids the learnset move pickers offer. */
const MOVE_IDS = Object.keys(MOVES).sort();

/** Every elemental type value, for the type pickers. */
const TYPE_VALUES = Object.values(Type);

/** Every growth-rate value, for the growth-rate picker. */
const GROWTH_RATE_VALUES = Object.values(GrowthRate);

/** Every egg-group value, shown read-only for context. */
const EGG_GROUP_VALUES = Object.values(EggGroup);

/** Every evolution method value, for the method picker. */
const EVOLUTION_METHODS = Object.values(EvolutionMethod);

/** Sorted list of manifest image ids the image-sprite picker offers. */
const IMAGE_IDS = Object.keys(manifest.images).sort();

/** Sorted list of manifest atlas ids the atlas-sprite picker offers. */
const ATLAS_IDS = Object.keys(manifest.atlases).sort();

/** The six base stats in display order. */
const STAT_VALUES = Object.values(Stat);

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

/** Shared style for a horizontal, wrapping row of controls. */
const CONTROL_ROW = css({
	display: "flex",
	flexWrap: "wrap",
	gap: "0.75rem",
	alignItems: "flex-end",
});

/** Shared base style for the small control buttons (add/remove). */
const CONTROL_BUTTON: Styles = {
	padding: "0.35rem 0.6rem",
	fontFamily: "inherit",
	color: "#e5e7eb",
	background: "#18181b",
	border: "1px solid #3f3f46",
	borderRadius: "0.375rem",
	cursor: "pointer",
};

/** Style for a destructive (remove) variant of the small control button. */
const REMOVE_BUTTON: Styles = { ...CONTROL_BUTTON, color: "#fca5a5", borderColor: "#7f1d1d" };

/** Regions available inside a given atlas id, sorted; empty for an unknown atlas. */
function atlasRegions(atlasId: string): string[] {
	let atlases = manifest.atlases as Record<string, { regions?: Record<string, unknown> }>;
	let atlas = atlases[atlasId];
	return atlas?.regions ? Object.keys(atlas.regions).sort() : [];
}

/**
 * Derives a candidate species id from a free-text name: uppercased, non
 * id-safe characters collapsed to single underscores, and any leading/trailing
 * underscores trimmed (e.g. `"Mr. Mime"` → `"MR_MIME"`). Returns `""` when the
 * name yields nothing usable.
 */
function idFromName(name: string): string {
	return name
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

/**
 * Species-content authoring tool. Edits an existing roster species or creates a
 * brand-new one, loads it into a {@link SpeciesEditor}, renders sectioned controls
 * for every editable field around it, and exports the edited record back into
 * `src/content/species.json` on demand.
 *
 * @param handle Component handle used to schedule re-renders on control changes.
 * @returns The render function for the species tool.
 */
export function SpeciesTool(handle: Handle<Record<string, never>>) {
	// Start on the first roster species so the form is populated immediately.
	let currentId = SPECIES_IDS[0] ?? "";
	let editor = new SpeciesEditor(currentId, SPECIES[currentId]!);
	let species: Species = editor.toSpecies();
	let status = "";
	let statusIsError = false;

	// New-species form state (only meaningful while `mode === "new"`).
	let mode: Mode = "edit";
	let newName = "";
	let newId = "";
	let newDex = SPECIES_IDS.length + 1;
	let newError = "";

	/** Adopts a fresh editor snapshot and re-renders. */
	function apply(next: Species) {
		species = next;
		void handle.update();
	}

	/** Reports an export outcome inline and re-renders. */
	function report(message: string, isError: boolean) {
		status = message;
		statusIsError = isError;
		void handle.update();
	}

	/** Loads a different species from the roster into a fresh editor. */
	function loadSpecies(id: string) {
		let loaded = SPECIES[id];
		if (!loaded) return;
		currentId = id;
		editor = new SpeciesEditor(id, loaded);
		species = editor.toSpecies();
		status = "";
		statusIsError = false;
		void handle.update();
	}

	/** Enters the new-species flow, seeding the form from the next free dex number. */
	function startNew() {
		mode = "new";
		newName = "";
		newId = "";
		newDex = SPECIES_IDS.length + 1;
		newError = "";
		void handle.update();
	}

	/** Leaves the new-species flow, returning to the picker without changes. */
	function cancelNew() {
		mode = "edit";
		newError = "";
		void handle.update();
	}

	/**
	 * Validates the new-species form (id pattern + no collision with an existing
	 * roster id) and, on success, loads a fresh default species into the editor.
	 * Surfaces a clear inline error on an invalid or colliding id.
	 */
	function confirmNew() {
		let validated = validateSpeciesId(newId);
		if (isFailure(validated)) {
			newError = validated.error.message;
			void handle.update();
			return;
		}
		let id = validated.data;
		if (SpeciesEditor.isDuplicateId(id, SPECIES_IDS)) {
			newError = `A species with id "${id}" already exists. Pick a different id or edit it instead.`;
			void handle.update();
			return;
		}
		editor = new SpeciesEditor(id, SpeciesEditor.createNew(newDex));
		currentId = id;
		species = editor.toSpecies();
		mode = "edit";
		newError = "";
		status = `New species "${id}" ready — edit and export to add it.`;
		statusIsError = false;
		void handle.update();
	}

	/** Serializes the edited species and POSTs it to the export action. */
	async function exportSpecies() {
		report("Exporting…", false);
		try {
			let response = await fetch("/dev/export/species", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id: currentId, species }),
			});
			let data = (await response.json()) as { path?: string; error?: string };
			if (response.ok) report(`Wrote ${data.path} (${currentId})`, false);
			else report(`Export failed: ${data.error ?? response.statusText}`, true);
		} catch (error) {
			report(`Export failed: ${error instanceof Error ? error.message : String(error)}`, true);
		}
	}

	/** Reads a number from an input event, defaulting to 0 for blank input. */
	function numberOf(event: Event): number {
		return Number((event.target as HTMLInputElement).value);
	}

	/**
	 * Wraps a group of controls in a collapsible `<details>` section with a header,
	 * so the long form reads as a set of clearly labeled, independently open panels.
	 *
	 * @param title The section heading.
	 * @param children The section body (control rows / fieldsets).
	 * @param open Whether the section starts expanded (defaults to open).
	 */
	function renderSection(title: string, children: RemixNode, open: boolean = true) {
		return (
			<details
				open={open}
				mix={css({
					border: "1px solid #27272a",
					borderRadius: "0.5rem",
					background: "#0c0c0f",
					padding: "0.75rem 1rem",
				})}
			>
				<summary
					mix={css({
						cursor: "pointer",
						fontSize: "1rem",
						fontWeight: "600",
						color: "#e5e7eb",
						userSelect: "none",
						listStyle: "revert",
					})}
				>
					{title}
				</summary>
				<div mix={css({ display: "grid", gap: "0.75rem", paddingTop: "0.75rem" })}>{children}</div>
			</details>
		);
	}

	/** Renders the new-species form (name → suggested id, id, dex) with a collision guard. */
	function renderNewForm() {
		return (
			<div
				mix={css({
					display: "grid",
					gap: "0.75rem",
					border: "1px solid #3f3f46",
					borderRadius: "0.5rem",
					background: "#0c0c0f",
					padding: "1rem",
				})}
			>
				<h3 mix={css({ margin: 0, fontSize: "1rem", color: "#e5e7eb" })}>New species</h3>
				<div mix={CONTROL_ROW}>
					<label mix={LABEL}>
						Name
						<input
							type="text"
							value={newName}
							placeholder="Mr. Mime"
							mix={[
								css({ ...FIELD, width: "12rem" }),
								on<HTMLInputElement, "input">("input", (event) => {
									newName = (event.target as HTMLInputElement).value;
									// Auto-suggest the id from the name until the author edits it directly.
									newId = idFromName(newName);
									newError = "";
									void handle.update();
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Id
						<input
							type="text"
							value={newId}
							placeholder="MR_MIME"
							pattern={SPECIES_ID_PATTERN.source}
							mix={[
								css({ ...FIELD, width: "12rem" }),
								on<HTMLInputElement, "input">("input", (event) => {
									newId = (event.target as HTMLInputElement).value;
									newError = "";
									void handle.update();
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Dex #
						<input
							type="number"
							min="1"
							value={String(newDex)}
							mix={[
								css({ ...FIELD, width: "5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									newDex = numberOf(event);
									void handle.update();
								}),
							]}
						/>
					</label>
				</div>
				<div mix={css({ display: "flex", gap: "0.75rem", alignItems: "center" })}>
					<button
						type="button"
						mix={[css(CONTROL_BUTTON), on<HTMLButtonElement, "click">("click", () => confirmNew())]}
					>
						Create
					</button>
					<button
						type="button"
						mix={[css(CONTROL_BUTTON), on<HTMLButtonElement, "click">("click", () => cancelNew())]}
					>
						Cancel
					</button>
				</div>
				{newError ? (
					<p mix={css({ margin: 0, fontSize: "0.85rem", color: "#f87171" })}>{newError}</p>
				) : null}
			</div>
		);
	}

	/** Renders the mode switch: the species picker plus a "New species" button. */
	function renderModeSwitch() {
		return (
			<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" })}>
				<label mix={LABEL}>
					Editing species
					<select
						value={currentId}
						disabled={mode === "new"}
						mix={[
							css({ ...FIELD, opacity: mode === "new" ? 0.6 : 1 }),
							on<HTMLSelectElement, "change">("change", (event) => {
								loadSpecies((event.target as HTMLSelectElement).value);
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
				<button
					type="button"
					mix={[css(CONTROL_BUTTON), on<HTMLButtonElement, "click">("click", () => startNew())]}
				>
					New species…
				</button>
			</div>
		);
	}

	/** Renders the Identity section: id (read-only), dex, size, and the two types. */
	function renderIdentity() {
		let secondary = species.types[1] ?? NONE;
		return renderSection(
			"Identity",
			<>
				<div mix={CONTROL_ROW}>
					<label mix={LABEL}>
						Id
						<input
							type="text"
							value={currentId}
							readOnly
							mix={css({ ...FIELD, width: "12rem", opacity: 0.7 })}
						/>
					</label>
					<label mix={LABEL}>
						Dex #
						<input
							type="number"
							min="1"
							value={String(species.number)}
							mix={[
								css({ ...FIELD, width: "5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									apply(editor.setNumber(numberOf(event)));
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Weight (kg)
						<input
							type="number"
							step="0.1"
							value={String(species.size.weight)}
							mix={[
								css({ ...FIELD, width: "6rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									apply(editor.setSize("weight", numberOf(event)));
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Height (m)
						<input
							type="number"
							step="0.1"
							value={String(species.size.height)}
							mix={[
								css({ ...FIELD, width: "6rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									apply(editor.setSize("height", numberOf(event)));
								}),
							]}
						/>
					</label>
				</div>
				<div mix={CONTROL_ROW}>
					<label mix={LABEL}>
						Primary type
						<select
							value={species.types[0]}
							mix={[
								css(FIELD),
								on<HTMLSelectElement, "change">("change", (event) => {
									apply(editor.setPrimaryType((event.target as HTMLSelectElement).value));
								}),
							]}
						>
							{TYPE_VALUES.map((type) => (
								<option key={type} value={type}>
									{type}
								</option>
							))}
						</select>
					</label>
					<label mix={LABEL}>
						Secondary type
						<select
							value={secondary}
							mix={[
								css(FIELD),
								on<HTMLSelectElement, "change">("change", (event) => {
									apply(editor.setSecondaryType((event.target as HTMLSelectElement).value));
								}),
							]}
						>
							<option value={NONE}>None</option>
							{TYPE_VALUES.map((type) => (
								<option key={type} value={type}>
									{type}
								</option>
							))}
						</select>
					</label>
				</div>
			</>,
		);
	}

	/** Renders the six base-stat number inputs. */
	function renderStats() {
		return renderSection(
			"Base stats",
			<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem" })}>
				{STAT_VALUES.map((stat) => (
					<label key={stat} mix={LABEL}>
						{stat}
						<input
							type="number"
							min="0"
							value={String(species.stats[stat])}
							mix={[
								css({ ...FIELD, width: "5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									apply(editor.setStat(stat, numberOf(event)));
								}),
							]}
						/>
					</label>
				))}
			</div>,
		);
	}

	/** Renders the Training section: catch rate, base exp, growth rate, gender, EV yield. */
	function renderTraining() {
		let gender = species.gender;
		let genderless = gender === Gender.Genderless;
		let male = gender === Gender.Genderless ? 0 : (gender[Gender.Male] ?? 0);
		let female = gender === Gender.Genderless ? 0 : (gender[Gender.Female] ?? 0);
		let yields = species.evYield ?? {};
		return renderSection(
			"Training",
			<>
				<div mix={CONTROL_ROW}>
					<label mix={LABEL}>
						Catch rate
						<input
							type="number"
							min="0"
							value={String(species.catchRate)}
							mix={[
								css({ ...FIELD, width: "6rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									apply(editor.setCatchRate(numberOf(event)));
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Base exp
						<input
							type="number"
							min="0"
							value={String(species.baseExperience)}
							mix={[
								css({ ...FIELD, width: "6rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									apply(editor.setBaseExperience(numberOf(event)));
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Growth rate
						<select
							value={species.growthRate}
							mix={[
								css(FIELD),
								on<HTMLSelectElement, "change">("change", (event) => {
									apply(
										editor.setGrowthRate((event.target as HTMLSelectElement).value as GrowthRate),
									);
								}),
							]}
						>
							{GROWTH_RATE_VALUES.map((rate) => (
								<option key={rate} value={rate}>
									{rate}
								</option>
							))}
						</select>
					</label>
					<label mix={LABEL}>
						Egg group
						<select value={species.eggGroup[0]} disabled mix={css({ ...FIELD, opacity: 0.6 })}>
							{EGG_GROUP_VALUES.map((group) => (
								<option key={group} value={group}>
									{group}
								</option>
							))}
						</select>
					</label>
				</div>
				<div mix={CONTROL_ROW}>
					<label
						mix={css({
							display: "flex",
							gap: "0.4rem",
							alignItems: "center",
							fontSize: "0.8rem",
							color: "#9ca3af",
						})}
					>
						<input
							type="checkbox"
							checked={genderless}
							mix={on<HTMLInputElement, "change">("change", (event) => {
								let checked = (event.target as HTMLInputElement).checked;
								apply(checked ? editor.setGenderless() : editor.setGenderRatio(50, 50));
							})}
						/>
						Genderless
					</label>
					<label mix={LABEL}>
						Male %
						<input
							type="number"
							min="0"
							max="100"
							step="0.1"
							disabled={genderless}
							value={String(male)}
							mix={[
								css({ ...FIELD, width: "6rem", opacity: genderless ? 0.5 : 1 }),
								on<HTMLInputElement, "change">("change", (event) => {
									apply(editor.setGenderRatio(numberOf(event), female));
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Female %
						<input
							type="number"
							min="0"
							max="100"
							step="0.1"
							disabled={genderless}
							value={String(female)}
							mix={[
								css({ ...FIELD, width: "6rem", opacity: genderless ? 0.5 : 1 }),
								on<HTMLInputElement, "change">("change", (event) => {
									apply(editor.setGenderRatio(male, numberOf(event)));
								}),
							]}
						/>
					</label>
				</div>
				<fieldset
					mix={css({ border: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" })}
				>
					<legend mix={css({ fontSize: "0.85rem", color: "#9ca3af", padding: 0 })}>EV yield</legend>
					<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem" })}>
						{STAT_VALUES.map((stat) => (
							<label key={stat} mix={LABEL}>
								{stat}
								<input
									type="number"
									min="0"
									value={String(yields[stat] ?? 0)}
									mix={[
										css({ ...FIELD, width: "5rem" }),
										on<HTMLInputElement, "change">("change", (event) => {
											apply(editor.setEvYield(stat, numberOf(event)));
										}),
									]}
								/>
							</label>
						))}
					</div>
				</fieldset>
			</>,
		);
	}

	/** Renders one level-up learnset row (level + move + remove). */
	function renderLearnsetRow(entry: Species["learnset"][number], index: number) {
		// Only level-up rows are editable here; other methods are shown read-only.
		if (!("level" in entry)) {
			let moveId = "moveId" in entry ? entry.moveId : `TM/HM ${entry.tmhm}`;
			return (
				<li
					key={index}
					mix={css({
						display: "flex",
						gap: "0.5rem",
						alignItems: "center",
						fontSize: "0.8rem",
						color: "#9ca3af",
					})}
				>
					<span>{"tmhm" in entry ? "TM/HM" : "tutor" in entry ? "Tutor" : "Egg"}</span>
					<span>{moveId}</span>
					<button
						type="button"
						mix={[
							css(REMOVE_BUTTON),
							on<HTMLButtonElement, "click">("click", () =>
								apply(editor.removeLearnsetMove(index)),
							),
						]}
					>
						Remove
					</button>
				</li>
			);
		}
		return (
			<li key={index} mix={css({ display: "flex", gap: "0.5rem", alignItems: "flex-end" })}>
				<label mix={LABEL}>
					Level
					<input
						type="number"
						min="0"
						value={String(entry.level)}
						mix={[
							css({ ...FIELD, width: "5rem" }),
							on<HTMLInputElement, "change">("change", (event) => {
								apply(editor.setLearnsetLevel(index, numberOf(event)));
							}),
						]}
					/>
				</label>
				<label mix={LABEL}>
					Move
					<select
						value={entry.moveId}
						mix={[
							css(FIELD),
							on<HTMLSelectElement, "change">("change", (event) => {
								apply(editor.setLearnsetMove(index, (event.target as HTMLSelectElement).value));
							}),
						]}
					>
						{MOVE_IDS.map((id) => (
							<option key={id} value={id}>
								{id}
							</option>
						))}
					</select>
				</label>
				<button
					type="button"
					mix={[
						css(REMOVE_BUTTON),
						on<HTMLButtonElement, "click">("click", () => apply(editor.removeLearnsetMove(index))),
					]}
				>
					Remove
				</button>
			</li>
		);
	}

	/** Renders the Learnset section: rows plus add/sort controls. */
	function renderLearnset() {
		return renderSection(
			`Learnset (${editor.levelUpMoveCount} level-up)`,
			<>
				<div mix={css({ display: "flex", gap: "0.75rem", alignItems: "center" })}>
					<button
						type="button"
						mix={[
							css(CONTROL_BUTTON),
							on<HTMLButtonElement, "click">("click", () => {
								let first = MOVE_IDS[0];
								if (first) apply(editor.addLearnsetMove(1, first));
							}),
						]}
					>
						Add move
					</button>
					<button
						type="button"
						mix={[
							css(CONTROL_BUTTON),
							on<HTMLButtonElement, "click">("click", () => apply(editor.sortLearnset())),
						]}
					>
						Sort by level
					</button>
				</div>
				{species.learnset.length === 0 ? (
					<p mix={css({ margin: 0, color: "#9ca3af", fontSize: "0.85rem" })}>No moves yet.</p>
				) : (
					<ul
						mix={css({ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" })}
					>
						{species.learnset.map((entry, index) => renderLearnsetRow(entry, index))}
					</ul>
				)}
			</>,
		);
	}

	/** Renders one evolution row (method + target + level/item + remove). */
	function renderEvolutionRow(evolution: Species["evolutions"][number], index: number) {
		return (
			<li
				key={index}
				mix={css({ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" })}
			>
				<label mix={LABEL}>
					Method
					<select
						value={evolution.method}
						mix={[
							css(FIELD),
							on<HTMLSelectElement, "change">("change", (event) => {
								apply(
									editor.setEvolutionMethod(
										index,
										(event.target as HTMLSelectElement).value as EvolutionMethod,
									),
								);
							}),
						]}
					>
						{EVOLUTION_METHODS.map((method) => (
							<option key={method} value={method}>
								{method}
							</option>
						))}
					</select>
				</label>
				<label mix={LABEL}>
					Target
					<select
						value={evolution.speciesId}
						mix={[
							css(FIELD),
							on<HTMLSelectElement, "change">("change", (event) => {
								apply(editor.setEvolutionTarget(index, (event.target as HTMLSelectElement).value));
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
				{"level" in evolution ? (
					<label mix={LABEL}>
						Level
						<input
							type="number"
							min="1"
							value={String(evolution.level)}
							mix={[
								css({ ...FIELD, width: "5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									apply(editor.setEvolutionLevel(index, numberOf(event)));
								}),
							]}
						/>
					</label>
				) : null}
				{"itemId" in evolution ? (
					<label mix={LABEL}>
						Item id
						<input
							type="text"
							value={evolution.itemId}
							placeholder="THUNDER_STONE"
							mix={[
								css({ ...FIELD, width: "12rem" }),
								on<HTMLInputElement, "input">("input", (event) => {
									apply(editor.setEvolutionItem(index, (event.target as HTMLInputElement).value));
								}),
							]}
						/>
					</label>
				) : null}
				<button
					type="button"
					mix={[
						css(REMOVE_BUTTON),
						on<HTMLButtonElement, "click">("click", () => apply(editor.removeEvolution(index))),
					]}
				>
					Remove
				</button>
			</li>
		);
	}

	/** Renders the Evolutions section: rows plus the add control. */
	function renderEvolutions() {
		return renderSection(
			`Evolutions (${editor.evolutionCount})`,
			<>
				<div mix={css({ display: "flex", gap: "0.75rem", alignItems: "center" })}>
					<button
						type="button"
						mix={[
							css(CONTROL_BUTTON),
							on<HTMLButtonElement, "click">("click", () => {
								let target = SPECIES_IDS[0];
								if (target) apply(editor.addEvolution(target, 1));
							}),
						]}
					>
						Add evolution
					</button>
				</div>
				{species.evolutions.length === 0 ? (
					<p mix={css({ margin: 0, color: "#9ca3af", fontSize: "0.85rem" })}>No evolutions.</p>
				) : (
					<ul
						mix={css({ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" })}
					>
						{species.evolutions.map((evolution, index) => renderEvolutionRow(evolution, index))}
					</ul>
				)}
			</>,
		);
	}

	/** Renders the Sprite section: source (none / atlas region / image) controls. */
	function renderSprite() {
		let sprite = species.sprite ?? null;
		let spriteMode = sprite === null ? "none" : "atlas" in sprite ? "atlas" : "image";
		let atlasId = sprite && "atlas" in sprite ? sprite.atlas : (ATLAS_IDS[0] ?? "");
		let region = sprite && "region" in sprite ? sprite.region : NONE;
		let imageId = sprite && "image" in sprite ? sprite.image : (IMAGE_IDS[0] ?? NONE);
		let regions = atlasRegions(atlasId);
		return renderSection(
			"Sprite",
			<div mix={CONTROL_ROW}>
				<label mix={LABEL}>
					Source
					<select
						value={spriteMode}
						mix={[
							css(FIELD),
							on<HTMLSelectElement, "change">("change", (event) => {
								let value = (event.target as HTMLSelectElement).value;
								if (value === "none") apply(editor.clearSprite());
								else if (value === "atlas") {
									apply(
										editor.setAtlasSprite(
											ATLAS_IDS[0] ?? "",
											atlasRegions(ATLAS_IDS[0] ?? "")[0] ?? "",
										),
									);
								} else apply(editor.setImageSprite(IMAGE_IDS[0] ?? ""));
							}),
						]}
					>
						<option value="none">None</option>
						<option value="atlas">Atlas region</option>
						<option value="image">Image</option>
					</select>
				</label>
				{spriteMode === "atlas" ? (
					<>
						<label mix={LABEL}>
							Atlas
							<select
								value={atlasId}
								mix={[
									css(FIELD),
									on<HTMLSelectElement, "change">("change", (event) => {
										let next = (event.target as HTMLSelectElement).value;
										apply(editor.setAtlasSprite(next, atlasRegions(next)[0] ?? ""));
									}),
								]}
							>
								{ATLAS_IDS.length === 0 ? <option value="">(no atlases)</option> : null}
								{ATLAS_IDS.map((id) => (
									<option key={id} value={id}>
										{id}
									</option>
								))}
							</select>
						</label>
						<label mix={LABEL}>
							Region
							<select
								value={region}
								mix={[
									css(FIELD),
									on<HTMLSelectElement, "change">("change", (event) => {
										apply(
											editor.setAtlasSprite(atlasId, (event.target as HTMLSelectElement).value),
										);
									}),
								]}
							>
								{regions.length === 0 ? <option value="">(no regions)</option> : null}
								{regions.map((name) => (
									<option key={name} value={name}>
										{name}
									</option>
								))}
							</select>
						</label>
					</>
				) : null}
				{spriteMode === "image" ? (
					<label mix={LABEL}>
						Image
						<select
							value={imageId}
							mix={[
								css(FIELD),
								on<HTMLSelectElement, "change">("change", (event) => {
									apply(editor.setImageSprite((event.target as HTMLSelectElement).value));
								}),
							]}
						>
							{IMAGE_IDS.length === 0 ? <option value="">(no images)</option> : null}
							{IMAGE_IDS.map((id) => (
								<option key={id} value={id}>
									{id}
								</option>
							))}
						</select>
					</label>
				) : null}
			</div>,
		);
	}

	return () => (
		<section mix={css({ display: "grid", gap: "1rem", justifyItems: "stretch" })}>
			<header mix={css({ display: "grid", gap: "0.25rem" })}>
				<h2 mix={css({ margin: 0, fontSize: "1.25rem" })}>Species</h2>
				<p mix={css({ margin: 0, color: "#9ca3af", fontSize: "0.85rem" })}>
					Edit an existing species or create a new one, adjust its identity, stats, training,
					learnset, evolutions, and sprite, then export it into{" "}
					<code>src/content/species.json</code>.
				</p>
			</header>

			{renderModeSwitch()}
			{mode === "new" ? renderNewForm() : null}

			{renderIdentity()}
			{renderStats()}
			{renderTraining()}
			{renderLearnset()}
			{renderEvolutions()}
			{renderSprite()}

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
						on<HTMLButtonElement, "click">("click", () => void exportSpecies()),
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
