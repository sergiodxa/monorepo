/**
 * The RPG-Maker-XP-style event editor dialog for the map tool, built on the
 * canonical framework-free view pattern (`function C(handle) { return () => <jsx/> }`,
 * `css()` styling, `on()` for events, no React hooks). Opening the dialog on a placed
 * or clicked event hands it a working copy of that {@link MapEvent}; every control
 * mutates the copy in setup scope and re-renders through `handle.update()`, and only
 * **OK** commits the copy back to the map editor (**Cancel** discards it), matching
 * RPG Maker's modal edit-then-apply flow.
 *
 * The dialog mirrors RPG Maker's structure. A header holds the event **Name** and its
 * id. A page **tab strip** (New / Copy / Delete / Clear Page) selects the
 * {@link EventPage} the panels below edit. Per active page the panels are:
 * **Conditions** (required global `switches` and a `selfSwitch`; variables are shown
 * disabled with a note since the schema has none), **Graphic** (a None / atlas-region
 * / raw-image sprite picker with a small preview), **Autonomous Movement** (type,
 * speed, frequency, and a route step-list for `route`), **Options** (the five
 * behaviour toggles), **Trigger** (the five trigger radios), and the **List of Event
 * Commands** — an editable, indented tree over the recursive command union, with
 * species/move/item pickers drawn from the real `SPECIES`/`MOVES`/`ITEMS` content so
 * authors can only pick valid ids.
 *
 * The command tree's pure add/edit/delete/nest logic lives in `event-page-editor.ts`;
 * this file is the imperative shell that renders it and wires the controls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css, on } from "remix/ui";

import type {
	AutonomousMovement,
	EventCommand,
	EventPage,
	MapEvent,
	PageConditions,
	PageOptions,
	SpriteRef,
} from "~/presentation/render/map-schema";

import { ITEMS } from "~/content/items";
import manifest from "~/content/manifest.json";
import { SPECIES } from "~/content/species";

import {
	addChoice,
	appendCommand,
	clonePage,
	type CommandKind,
	COMMAND_KINDS,
	type CommandPath,
	defaultCommand,
	defaultPage,
	DIRECTIONS,
	MOVEMENT_TYPES,
	readCommand,
	removeChoice,
	removeCommand,
	toggleElse,
	TRIGGERS,
	updateCommand,
} from "../editors/event-page-editor";

/** The raw parameter type of the `css()` mixin, narrowed by {@link Styles}. */
type CssMixinStyles = Parameters<typeof css>[0];

/**
 * The style-object shape the `css()` mixin accepts, used for shared base styles.
 *
 * The mixin's own parameter type is derived from `CSSStyleDeclaration`, so it
 * carries that interface's `Symbol.iterator` member and reads as an iterable.
 * Dropping the symbol keys leaves the same plain property bag the base styles
 * actually are, so they can be spread into an override object.
 */
type Styles = { [K in keyof CssMixinStyles as K extends symbol ? never : K]: CssMixinStyles[K] };

/** Sentinel `<option>` value meaning "no sprite" in the graphic picker. */
const NO_SPRITE = "";

/** Sorted list of real species ids the wild/trainer pickers offer. */
const SPECIES_IDS = Object.keys(SPECIES).sort();

/** Sorted list of real item ids the give-item picker offers. */
const ITEM_IDS = Object.keys(ITEMS).sort();

/** Sorted list of manifest atlas ids the graphic picker offers. */
const ATLAS_IDS = Object.keys(
	(manifest as { atlases?: Record<string, unknown> }).atlases ?? {},
).sort();

/** Sorted list of manifest image ids the graphic picker offers. */
const IMAGE_IDS = Object.keys(
	(manifest as { images?: Record<string, string> }).images ?? {},
).sort();

/** The indigo accent marking the active tab / control. */
const ACCENT = "#6366f1";

/** The idle border color shared by the small controls. */
const IDLE_BORDER = "#3f3f46";

/** Shared base style for text/number inputs and selectors. */
const FIELD: Styles = {
	padding: "0.3rem 0.45rem",
	fontFamily: "inherit",
	fontSize: "0.8rem",
	color: "#e5e7eb",
	background: "#18181b",
	border: "1px solid #3f3f46",
	borderRadius: "0.3rem",
};

/** Shared base style for the small control buttons. */
const CONTROL_BUTTON: Styles = {
	padding: "0.3rem 0.6rem",
	fontFamily: "inherit",
	fontSize: "0.8rem",
	color: "#e5e7eb",
	background: "#18181b",
	border: "1px solid #3f3f46",
	borderRadius: "0.3rem",
	cursor: "pointer",
};

/** Raw style object for the small labels above each control group. */
const LABEL_STYLE: Styles = {
	display: "grid",
	gap: "0.25rem",
	fontSize: "0.75rem",
	color: "#9ca3af",
};

/** Shared mixin for the small labels above each control group. */
const LABEL = css(LABEL_STYLE);

/** Shared style for one bordered panel (Conditions / Graphic / …). */
const PANEL: Styles = {
	display: "grid",
	gap: "0.5rem",
	padding: "0.75rem",
	background: "#141417",
	border: "1px solid #27272a",
	borderRadius: "0.4rem",
};

/** The heading style shared by each panel. */
const PANEL_TITLE = css({
	margin: 0,
	fontSize: "0.8rem",
	fontWeight: 600,
	color: "#e5e7eb",
	textTransform: "uppercase",
	letterSpacing: "0.03em",
});

/** Props for the event editor dialog. */
export interface EventEditorProps {
	/** The event being edited (a snapshot; the dialog edits a working copy of it). */
	event: MapEvent;
	/** Commits the edited name + pages back to the map (the OK action). */
	onCommit: (patch: { name: string | undefined; pages: EventPage[] }) => void;
	/** Discards the edits and closes the dialog (the Cancel action). */
	onCancel: () => void;
}

/**
 * The event editor dialog. Holds a working copy of the event's name and pages in
 * setup scope, edits them through the pure page/command helpers, and commits on OK or
 * discards on Cancel.
 *
 * @param handle Component handle exposing the event props and scheduling re-renders.
 * @returns The render function for the dialog.
 */
export function EventEditor(handle: Handle<EventEditorProps>) {
	// Working copy of the event's editable state (committed only on OK).
	let name = handle.props.event.name ?? "";
	let pages: EventPage[] =
		handle.props.event.pages.length > 0 ? handle.props.event.pages.map(clonePage) : [defaultPage()];
	let activePage = 0;

	/** Re-renders the dialog after a working-copy mutation. */
	function refresh() {
		void handle.update();
	}

	/** The page currently being edited. */
	function page(): EventPage {
		return pages[activePage]!;
	}

	/** Replaces the active page with `next` and re-renders. */
	function setPage(next: EventPage) {
		pages = pages.map((entry, index) => (index === activePage ? next : entry));
		refresh();
	}

	/** Appends a fresh default page and selects it. */
	function newPage() {
		pages = [...pages, defaultPage()];
		activePage = pages.length - 1;
		refresh();
	}

	/** Duplicates the active page (deep copy) and selects the copy. */
	function copyPage() {
		let copy = clonePage(page());
		pages = [...pages.slice(0, activePage + 1), copy, ...pages.slice(activePage + 1)];
		activePage += 1;
		refresh();
	}

	/** Deletes the active page, keeping at least one page. */
	function deletePage() {
		if (pages.length <= 1) return;
		pages = pages.filter((_, index) => index !== activePage);
		activePage = Math.min(activePage, pages.length - 1);
		refresh();
	}

	/** Resets the active page's contents to a fresh default page. */
	function clearPage() {
		setPage(defaultPage());
	}

	/** Replaces the active page's command list and re-renders. */
	function setCommands(commands: EventCommand[]) {
		setPage({ ...page(), commands });
	}

	return () => {
		let current = page();
		return (
			<div
				mix={css({
					position: "fixed",
					inset: "0",
					zIndex: "50",
					display: "grid",
					placeItems: "center",
					padding: "1.5rem",
					background: "rgba(3, 3, 6, 0.72)",
				})}
			>
				<section
					mix={css({
						display: "grid",
						gap: "1rem",
						width: "min(64rem, 100%)",
						maxHeight: "90vh",
						overflow: "auto",
						padding: "1.25rem",
						background: "#0b0b0e",
						border: `1px solid ${IDLE_BORDER}`,
						borderRadius: "0.6rem",
						boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
					})}
				>
					{/* Header: name + id. */}
					<div
						mix={css({
							display: "flex",
							flexWrap: "wrap",
							gap: "1rem",
							alignItems: "flex-end",
							justifyContent: "space-between",
						})}
					>
						<label mix={LABEL}>
							Name
							<input
								type="text"
								value={name}
								placeholder="Old Man"
								mix={[
									css({ ...FIELD, width: "16rem", fontSize: "0.9rem" }),
									on<HTMLInputElement, "input">("input", (event) => {
										name = (event.target as HTMLInputElement).value;
									}),
								]}
							/>
						</label>
						<span mix={css({ fontSize: "0.78rem", color: "#9ca3af" })}>
							id <code mix={css({ color: "#e5e7eb" })}>{handle.props.event.id}</code> @{" "}
							{handle.props.event.x},{handle.props.event.y}
						</span>
					</div>

					{/* Page tab strip + page controls. */}
					<div mix={css({ display: "grid", gap: "0.5rem" })}>
						<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.35rem" })}>
							{pages.map((_, index) => (
								<button
									key={index}
									type="button"
									mix={[
										css({
											...CONTROL_BUTTON,
											borderColor: index === activePage ? ACCENT : IDLE_BORDER,
											background: index === activePage ? "#1e1b4b" : "#18181b",
										}),
										on<HTMLButtonElement, "click">("click", () => {
											activePage = index;
											refresh();
										}),
									]}
								>
									Page {index + 1}
								</button>
							))}
						</div>
						<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.35rem" })}>
							<button
								type="button"
								mix={[
									css(CONTROL_BUTTON),
									on<HTMLButtonElement, "click">("click", () => newPage()),
								]}
							>
								New Page
							</button>
							<button
								type="button"
								mix={[
									css(CONTROL_BUTTON),
									on<HTMLButtonElement, "click">("click", () => copyPage()),
								]}
							>
								Copy Page
							</button>
							<button
								type="button"
								disabled={pages.length <= 1}
								mix={[
									css({ ...CONTROL_BUTTON, opacity: pages.length <= 1 ? 0.5 : 1 }),
									on<HTMLButtonElement, "click">("click", () => deletePage()),
								]}
							>
								Delete Page
							</button>
							<button
								type="button"
								mix={[
									css(CONTROL_BUTTON),
									on<HTMLButtonElement, "click">("click", () => clearPage()),
								]}
							>
								Clear Page
							</button>
						</div>
					</div>

					{/* Two-column panel grid: conditions/graphic/movement/options/trigger + commands. */}
					<div
						mix={css({
							display: "grid",
							gap: "0.75rem",
							gridTemplateColumns: "minmax(0, 22rem) minmax(0, 1fr)",
							alignItems: "start",
						})}
					>
						<div mix={css({ display: "grid", gap: "0.75rem" })}>
							<ConditionsPanel
								conditions={current.conditions as PageConditions}
								onChange={(conditions) => setPage({ ...current, conditions })}
							/>
							<GraphicPanel
								graphic={current.graphic}
								onChange={(graphic) => setPage({ ...current, graphic })}
							/>
							<MovementPanel
								movement={current.autonomousMovement as AutonomousMovement}
								onChange={(autonomousMovement) => setPage({ ...current, autonomousMovement })}
							/>
							<OptionsPanel
								options={current.options as PageOptions}
								onChange={(options) => setPage({ ...current, options })}
							/>
							<TriggerPanel
								trigger={current.trigger}
								onChange={(trigger) => setPage({ ...current, trigger })}
							/>
						</div>

						<CommandsPanel commands={current.commands} onChange={setCommands} />
					</div>

					{/* OK / Cancel. */}
					<div mix={css({ display: "flex", justifyContent: "flex-end", gap: "0.6rem" })}>
						<button
							type="button"
							mix={[
								css({ ...CONTROL_BUTTON, padding: "0.5rem 1.25rem" }),
								on<HTMLButtonElement, "click">("click", () => handle.props.onCancel()),
							]}
						>
							Cancel
						</button>
						<button
							type="button"
							mix={[
								css({
									padding: "0.5rem 1.5rem",
									fontFamily: "inherit",
									fontSize: "0.85rem",
									color: "#052e16",
									background: "#4ade80",
									border: "none",
									borderRadius: "0.3rem",
									cursor: "pointer",
								}),
								on<HTMLButtonElement, "click">("click", () => {
									let trimmed = name.trim();
									handle.props.onCommit({
										name: trimmed.length > 0 ? trimmed : undefined,
										pages: pages.map(clonePage),
									});
								}),
							]}
						>
							OK
						</button>
					</div>
				</section>
			</div>
		);
	};
}

/** Props for the page conditions panel. */
interface ConditionsPanelProps {
	/** The active page's conditions. */
	conditions: PageConditions;
	/** Called with the updated conditions. */
	onChange: (conditions: PageConditions) => void;
}

/**
 * The Conditions panel: an editable list of required global `switches` (all must be
 * ON) and an optional `selfSwitch` name. Variables are shown disabled with a note
 * because the event schema has none.
 *
 * @param handle Component handle exposing the conditions props.
 * @returns The render function for the conditions panel.
 */
function ConditionsPanel(handle: Handle<ConditionsPanelProps>) {
	return () => {
		let { conditions, onChange } = handle.props;
		let switches = conditions.switches ?? [];
		let selfEnabled = conditions.selfSwitch !== undefined;
		return (
			<section mix={css(PANEL)}>
				<h4 mix={PANEL_TITLE}>Conditions</h4>

				<div mix={css({ display: "grid", gap: "0.35rem" })}>
					<span mix={css({ fontSize: "0.75rem", color: "#9ca3af" })}>
						Switches (all must be ON)
					</span>
					{switches.map((flag, index) => (
						<div key={index} mix={css({ display: "flex", gap: "0.35rem" })}>
							<input
								type="text"
								value={flag}
								placeholder="story-flag"
								mix={[
									css({ ...FIELD, flex: "1" }),
									on<HTMLInputElement, "input">("input", (event) => {
										let next = switches.map((entry, i) =>
											i === index ? (event.target as HTMLInputElement).value : entry,
										);
										onChange({ ...conditions, switches: next });
									}),
								]}
							/>
							<button
								type="button"
								mix={[
									css({ ...CONTROL_BUTTON, padding: "0.2rem 0.45rem" }),
									on<HTMLButtonElement, "click">("click", () => {
										let next = switches.filter((_, i) => i !== index);
										onChange({ ...conditions, switches: next.length > 0 ? next : undefined });
									}),
								]}
							>
								×
							</button>
						</div>
					))}
					<button
						type="button"
						mix={[
							css({ ...CONTROL_BUTTON, justifySelf: "start", padding: "0.2rem 0.5rem" }),
							on<HTMLButtonElement, "click">("click", () => {
								onChange({ ...conditions, switches: [...switches, ""] });
							}),
						]}
					>
						+ Switch
					</button>
				</div>

				<label
					mix={css({
						display: "flex",
						gap: "0.4rem",
						alignItems: "center",
						fontSize: "0.75rem",
						color: "#9ca3af",
					})}
				>
					<input
						type="checkbox"
						checked={selfEnabled}
						mix={on<HTMLInputElement, "change">("change", (event) => {
							let checked = (event.target as HTMLInputElement).checked;
							onChange({
								...conditions,
								selfSwitch: checked ? (conditions.selfSwitch ?? "A") : undefined,
							});
						})}
					/>
					Self switch
				</label>
				{selfEnabled ? (
					<input
						type="text"
						value={conditions.selfSwitch ?? ""}
						placeholder="A"
						mix={[
							css({ ...FIELD, width: "6rem" }),
							on<HTMLInputElement, "input">("input", (event) => {
								onChange({ ...conditions, selfSwitch: (event.target as HTMLInputElement).value });
							}),
						]}
					/>
				) : null}

				<label
					mix={css({
						display: "flex",
						gap: "0.4rem",
						alignItems: "center",
						fontSize: "0.72rem",
						color: "#6b7280",
					})}
					title="The event schema has no variables; this axis is intentionally omitted."
				>
					<input type="checkbox" disabled checked={false} />
					Variable (not supported)
				</label>
			</section>
		);
	};
}

/** Props for the page graphic (sprite) panel. */
interface GraphicPanelProps {
	/** The active page's graphic (atlas region, raw image rect, or null). */
	graphic: SpriteRef;
	/** Called with the updated graphic. */
	onChange: (graphic: SpriteRef) => void;
}

/**
 * The Graphic panel: a None / atlas-region / raw-image sprite picker matching the
 * schema's `SpriteRef` union, with a small text preview of the chosen reference.
 *
 * @param handle Component handle exposing the graphic props.
 * @returns The render function for the graphic panel.
 */
function GraphicPanel(handle: Handle<GraphicPanelProps>) {
	return () => {
		let { graphic, onChange } = handle.props;
		let mode = graphic === null ? "none" : "atlas" in graphic ? "atlas" : "image";
		return (
			<section mix={css(PANEL)}>
				<h4 mix={PANEL_TITLE}>Graphic</h4>
				<div mix={css({ display: "flex", gap: "0.6rem", alignItems: "center" })}>
					<div
						mix={css({
							width: "44px",
							height: "44px",
							display: "grid",
							placeItems: "center",
							fontSize: "0.65rem",
							color: "#6b7280",
							borderRadius: "0.3rem",
							border: graphic === null ? "2px dashed #3f3f46" : `2px solid ${ACCENT}`,
							background: "#18181b",
						})}
					>
						{graphic === null ? "none" : "atlas" in graphic ? "atlas" : "img"}
					</div>
					<label mix={css({ ...LABEL_STYLE, flex: "1" })}>
						Source
						<select
							value={mode}
							mix={[
								css(FIELD),
								on<HTMLSelectElement, "change">("change", (event) => {
									let next = (event.target as HTMLSelectElement).value;
									if (next === "none") onChange(null);
									else if (next === "atlas") onChange({ atlas: ATLAS_IDS[0] ?? "", region: "" });
									else onChange({ image: IMAGE_IDS[0] ?? "", x: 0, y: 0, w: 16, h: 16 });
								}),
							]}
						>
							<option value={NO_SPRITE} selected={mode === "none"}>
								None
							</option>
							<option value="atlas" selected={mode === "atlas"}>
								Atlas region
							</option>
							<option value="image" selected={mode === "image"}>
								Raw image rect
							</option>
						</select>
					</label>
				</div>

				{graphic !== null && "atlas" in graphic ? (
					<div mix={css({ display: "flex", gap: "0.4rem" })}>
						<select
							value={graphic.atlas}
							mix={[
								css({ ...FIELD, width: "50%" }),
								on<HTMLSelectElement, "change">("change", (event) => {
									onChange({
										atlas: (event.target as HTMLSelectElement).value,
										region: graphic.region,
									});
								}),
							]}
						>
							{ATLAS_IDS.length === 0 ? <option value="">(no atlases)</option> : null}
							{ATLAS_IDS.map((id) => (
								<option key={id} value={id} selected={graphic.atlas === id}>
									{id}
								</option>
							))}
						</select>
						<input
							type="text"
							value={graphic.region}
							placeholder="hero.down"
							mix={[
								css({ ...FIELD, width: "50%" }),
								on<HTMLInputElement, "input">("input", (event) => {
									onChange({
										atlas: graphic.atlas,
										region: (event.target as HTMLInputElement).value,
									});
								}),
							]}
						/>
					</div>
				) : null}

				{graphic !== null && "image" in graphic ? (
					<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.4rem" })}>
						<select
							value={graphic.image}
							mix={[
								css({ ...FIELD, width: "100%" }),
								on<HTMLSelectElement, "change">("change", (event) => {
									onChange({ ...graphic, image: (event.target as HTMLSelectElement).value });
								}),
							]}
						>
							{IMAGE_IDS.length === 0 ? <option value="">(no images)</option> : null}
							{IMAGE_IDS.map((id) => (
								<option key={id} value={id} selected={graphic.image === id}>
									{id}
								</option>
							))}
						</select>
						{(["x", "y", "w", "h"] as const).map((field) => (
							<label key={field} mix={css({ ...LABEL_STYLE, width: "3.5rem" })}>
								{field}
								<input
									type="number"
									min={field === "w" || field === "h" ? "1" : "0"}
									value={String(graphic[field])}
									mix={[
										css(FIELD),
										on<HTMLInputElement, "change">("change", (event) => {
											onChange({
												...graphic,
												[field]: Number((event.target as HTMLInputElement).value),
											});
										}),
									]}
								/>
							</label>
						))}
					</div>
				) : null}
			</section>
		);
	};
}

/** Props for the autonomous-movement panel. */
interface MovementPanelProps {
	/** The active page's autonomous movement. */
	movement: AutonomousMovement;
	/** Called with the updated movement. */
	onChange: (movement: AutonomousMovement) => void;
}

/**
 * The Autonomous Movement panel: a Type select (Fixed / Random / Route), Speed and
 * Freq numeric fields, and — for Route — an ordered step-list editor (up / down /
 * left / right) matching the schema's `route` direction list.
 *
 * @param handle Component handle exposing the movement props.
 * @returns The render function for the movement panel.
 */
function MovementPanel(handle: Handle<MovementPanelProps>) {
	return () => {
		let { movement, onChange } = handle.props;
		let route = movement.route ?? [];
		return (
			<section mix={css(PANEL)}>
				<h4 mix={PANEL_TITLE}>Autonomous Movement</h4>
				<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.5rem" })}>
					<label mix={LABEL}>
						Type
						<select
							value={movement.type}
							mix={[
								css(FIELD),
								on<HTMLSelectElement, "change">("change", (event) => {
									onChange({
										...movement,
										type: (event.target as HTMLSelectElement).value as typeof movement.type,
									});
								}),
							]}
						>
							{MOVEMENT_TYPES.map((entry) => (
								<option key={entry.id} value={entry.id} selected={movement.type === entry.id}>
									{entry.label}
								</option>
							))}
						</select>
					</label>
					<label mix={LABEL}>
						Speed
						<input
							type="number"
							min="1"
							value={movement.speed === undefined ? "" : String(movement.speed)}
							placeholder="—"
							mix={[
								css({ ...FIELD, width: "5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									let raw = (event.target as HTMLInputElement).value.trim();
									onChange({
										...movement,
										speed: raw === "" ? undefined : Math.max(1, Number(raw)),
									});
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Freq
						<input
							type="number"
							min="1"
							value={movement.freq === undefined ? "" : String(movement.freq)}
							placeholder="—"
							mix={[
								css({ ...FIELD, width: "5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									let raw = (event.target as HTMLInputElement).value.trim();
									onChange({
										...movement,
										freq: raw === "" ? undefined : Math.max(1, Number(raw)),
									});
								}),
							]}
						/>
					</label>
				</div>

				{movement.type === "route" ? (
					<div mix={css({ display: "grid", gap: "0.35rem" })}>
						<span mix={css({ fontSize: "0.75rem", color: "#9ca3af" })}>
							Route: {route.length > 0 ? route.join(" → ") : "(none)"}
						</span>
						<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.3rem" })}>
							{DIRECTIONS.map((direction) => (
								<button
									key={direction}
									type="button"
									mix={[
										css({ ...CONTROL_BUTTON, padding: "0.2rem 0.5rem" }),
										on<HTMLButtonElement, "click">("click", () => {
											onChange({ ...movement, route: [...route, direction] });
										}),
									]}
								>
									+{direction}
								</button>
							))}
							<button
								type="button"
								mix={[
									css({ ...CONTROL_BUTTON, padding: "0.2rem 0.5rem" }),
									on<HTMLButtonElement, "click">("click", () => {
										onChange({ ...movement, route: route.slice(0, -1) });
									}),
								]}
							>
								Undo
							</button>
							<button
								type="button"
								mix={[
									css({ ...CONTROL_BUTTON, padding: "0.2rem 0.5rem" }),
									on<HTMLButtonElement, "click">("click", () => {
										onChange({ ...movement, route: [] });
									}),
								]}
							>
								Clear
							</button>
						</div>
					</div>
				) : null}
			</section>
		);
	};
}

/** Props for the page options panel. */
interface OptionsPanelProps {
	/** The active page's options. */
	options: PageOptions;
	/** Called with the updated options. */
	onChange: (options: PageOptions) => void;
}

/** The five page option toggles, keyed by schema field with a human label. */
const OPTION_FIELDS: ReadonlyArray<{ id: keyof PageOptions; label: string }> = [
	{ id: "moveAnimation", label: "Move Animation" },
	{ id: "stopAnimation", label: "Stop Animation" },
	{ id: "directionFix", label: "Direction Fix" },
	{ id: "through", label: "Through" },
	{ id: "alwaysOnTop", label: "Always on Top" },
] as const;

/**
 * The Options panel: the five RPG-Maker behaviour toggles (Move Animation, Stop
 * Animation, Direction Fix, Through, Always on Top), each a checkbox mapped to the
 * matching optional boolean on the page's `options`.
 *
 * @param handle Component handle exposing the options props.
 * @returns The render function for the options panel.
 */
function OptionsPanel(handle: Handle<OptionsPanelProps>) {
	return () => {
		let { options, onChange } = handle.props;
		return (
			<section mix={css(PANEL)}>
				<h4 mix={PANEL_TITLE}>Options</h4>
				<div mix={css({ display: "grid", gap: "0.3rem" })}>
					{OPTION_FIELDS.map((entry) => (
						<label
							key={entry.id}
							mix={css({
								display: "flex",
								gap: "0.4rem",
								alignItems: "center",
								fontSize: "0.78rem",
								color: "#d1d5db",
							})}
						>
							<input
								type="checkbox"
								checked={options[entry.id] === true}
								mix={on<HTMLInputElement, "change">("change", (event) => {
									let checked = (event.target as HTMLInputElement).checked;
									onChange({ ...options, [entry.id]: checked });
								})}
							/>
							{entry.label}
						</label>
					))}
				</div>
			</section>
		);
	};
}

/** Props for the trigger panel. */
interface TriggerPanelProps {
	/** The active page's trigger. */
	trigger: EventPage["trigger"];
	/** Called with the updated trigger. */
	onChange: (trigger: EventPage["trigger"]) => void;
}

/**
 * The Trigger panel: the five trigger radios (Action Button, Player Touch, Event
 * Touch, Autorun, Parallel Process) mapping to the schema's `trigger` union.
 *
 * @param handle Component handle exposing the trigger props.
 * @returns The render function for the trigger panel.
 */
function TriggerPanel(handle: Handle<TriggerPanelProps>) {
	return () => {
		let { trigger, onChange } = handle.props;
		return (
			<section mix={css(PANEL)}>
				<h4 mix={PANEL_TITLE}>Trigger</h4>
				<div mix={css({ display: "grid", gap: "0.3rem" })}>
					{TRIGGERS.map((entry) => (
						<label
							key={entry.id}
							mix={css({
								display: "flex",
								gap: "0.4rem",
								alignItems: "center",
								fontSize: "0.78rem",
								color: "#d1d5db",
							})}
						>
							<input
								type="radio"
								name="event-trigger"
								checked={trigger === entry.id}
								mix={on<HTMLInputElement, "change">("change", () => onChange(entry.id))}
							/>
							{entry.label}
						</label>
					))}
				</div>
			</section>
		);
	};
}

/** Props for the event-command list panel. */
interface CommandsPanelProps {
	/** The active page's command list. */
	commands: EventCommand[];
	/** Called with the updated command list. */
	onChange: (commands: EventCommand[]) => void;
}

/** One flattened command row: its command, its path, and its nesting depth. */
interface CommandRow {
	/** The command at this row. */
	command: EventCommand;
	/** The path locating it in the (possibly nested) command tree. */
	path: CommandPath;
	/** How deeply nested it is (for indentation). */
	depth: number;
	/** A short prefix label ("When "x"", "Else", …) for a branch header row, if any. */
	prefix?: string;
}

/**
 * Flattens a (possibly nested) command tree into indented rows for display, walking
 * `show-choices` choices and `conditional-branch` then/else lists depth-first so the
 * nesting reads top-to-bottom like RPG Maker's event script. Each row carries the
 * {@link CommandPath} needed to edit or delete it.
 *
 * @param commands The command list to flatten.
 * @param base The path prefix leading to this list (empty at the root).
 * @param depth The nesting depth of this list.
 * @param rows The accumulator the flattened rows are pushed into.
 */
function flattenCommands(
	commands: EventCommand[],
	base: CommandPath,
	depth: number,
	rows: CommandRow[],
): void {
	for (let index = 0; index < commands.length; index++) {
		let command = commands[index]!;
		let path: CommandPath = [...base, { index, branch: "then" }];
		rows.push({ command, path, depth });

		if (command.kind === "show-choices") {
			for (let choiceIndex = 0; choiceIndex < command.choices.length; choiceIndex++) {
				let choice = command.choices[choiceIndex]!;
				let childBase: CommandPath = [...base, { index, branch: "choice", choice: choiceIndex }];
				rows.push({
					command,
					path: childBase,
					depth: depth + 1,
					prefix: `When "${choice.label || "…"}"`,
				});
				flattenCommands(choice.commands, childBase, depth + 2, rows);
			}
		} else if (command.kind === "conditional-branch") {
			let thenBase: CommandPath = [...base, { index, branch: "then" }];
			flattenCommands(command.then, thenBase, depth + 1, rows);
			if (command.else !== undefined) {
				let elseBase: CommandPath = [...base, { index, branch: "else" }];
				rows.push({ command, path: elseBase, depth, prefix: "Else" });
				flattenCommands(command.else, elseBase, depth + 1, rows);
			}
		}
	}
}

/** A short one-line summary of a command for the list row. */
function summarize(command: EventCommand): string {
	switch (command.kind) {
		case "text":
			return `Text: ${command.text || "…"}`;
		case "show-choices":
			return `Show Choices: ${command.choices.map((choice) => choice.label || "…").join(", ")}`;
		case "conditional-branch": {
			let condition = command.condition;
			let label = condition.switch
				? `switch ${condition.switch}`
				: condition.selfSwitch
					? `self ${condition.selfSwitch}`
					: "…";
			return `Conditional Branch: ${label} ON`;
		}
		case "control-switch":
			return `Control Switch: ${command.flag || "…"} = ${command.value ? "ON" : "OFF"}`;
		case "control-self-switch":
			return `Control Self Switch: ${command.name || "…"} = ${command.value ? "ON" : "OFF"}`;
		case "start-trainer-battle":
			return `Start Trainer Battle: ${command.trainer.name || "(unnamed)"} (${command.trainer.party.length})`;
		case "wild-encounter":
			return `Wild Encounter: ${command.speciesId || "…"} Lv${command.level}`;
		case "heal-party":
			return "Heal Party";
		case "give-item":
			return `Give Item: ${command.itemId || "…"} ×${command.count}`;
		case "warp":
			return `Warp: ${command.map || "…"} (${command.x}, ${command.y})`;
		case "face-player":
			return "Face Player";
		case "move":
			return `Move: ${command.steps.length > 0 ? command.steps.join(" ") : "(no steps)"}`;
		case "wait":
			return `Wait: ${command.frames} frames`;
	}
}

/**
 * The List of Event Commands panel: an indented, editable tree over the recursive
 * command union. Selecting a row opens its fields editor below; the insert menu
 * appends a fresh command (into a chosen branch when a nesting row is selected), and
 * each row can be deleted. Nesting from `show-choices` branches and
 * `conditional-branch` then/else is shown by indentation.
 *
 * @param handle Component handle exposing the commands props and scheduling re-renders.
 * @returns The render function for the commands panel.
 */
function CommandsPanel(handle: Handle<CommandsPanelProps>) {
	// The path of the currently selected row (for the fields editor), or null.
	let selectedPath: CommandPath | null = null;
	// The command kind the insert menu will add.
	let insertKind: CommandKind = "text";

	/** Compares two paths for equality (same steps in the same order). */
	function samePath(a: CommandPath, b: CommandPath): boolean {
		if (a.length !== b.length) return false;
		return a.every(
			(step, index) =>
				step.index === b[index]!.index &&
				step.branch === b[index]!.branch &&
				step.choice === b[index]!.choice,
		);
	}

	return () => {
		let { commands, onChange } = handle.props;
		let rows: CommandRow[] = [];
		flattenCommands(commands, [], 0, rows);

		// Rows that are real commands (not branch-header markers) are selectable/deletable.
		let selected =
			selectedPath && !selectedPath[selectedPath.length - 1]
				? null
				: selectedPath
					? readCommand(commands, selectedPath)
					: null;

		/** Appends a fresh command of `insertKind` into the target list. */
		function insertAt(target: CommandPath) {
			let command = defaultCommand(insertKind, {
				speciesId: SPECIES_IDS[0],
				itemId: ITEM_IDS[0],
			});
			onChange(appendCommand(commands, target, command));
		}

		return (
			<section mix={css({ ...PANEL, minHeight: "20rem" })}>
				<div mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
					<h4 mix={PANEL_TITLE}>List of Event Commands</h4>
					<span mix={css({ fontSize: "0.72rem", color: "#6b7280" })}>{rows.length} lines</span>
				</div>

				{/* The command list. */}
				<div
					mix={css({
						display: "grid",
						gap: "1px",
						maxHeight: "20rem",
						overflow: "auto",
						padding: "0.35rem",
						background: "#0b0b0e",
						border: "1px solid #27272a",
						borderRadius: "0.3rem",
						fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
						fontSize: "0.74rem",
					})}
				>
					{rows.length === 0 ? (
						<span mix={css({ color: "#6b7280", padding: "0.25rem" })}>@&gt; (empty)</span>
					) : null}
					{rows.map((row, rowIndex) => {
						if (row.prefix !== undefined) {
							// A branch header row (When "x" / Else): a label + an insert-into-branch target.
							let isSelected = selectedPath !== null && samePath(selectedPath, row.path);
							return (
								<div
									key={rowIndex}
									mix={css({
										display: "flex",
										alignItems: "center",
										gap: "0.4rem",
										paddingLeft: `${0.25 + row.depth * 1}rem`,
										color: "#a5b4fc",
									})}
								>
									<button
										type="button"
										title="Add a command into this branch"
										mix={[
											css({
												...CONTROL_BUTTON,
												padding: "0.05rem 0.4rem",
												fontSize: "0.7rem",
												borderColor: isSelected ? ACCENT : IDLE_BORDER,
											}),
											on<HTMLButtonElement, "click">("click", () => {
												selectedPath = row.path;
												void handle.update();
											}),
										]}
									>
										{row.prefix}
									</button>
								</div>
							);
						}

						let isSelected = selectedPath !== null && samePath(selectedPath, row.path);
						return (
							<div
								key={rowIndex}
								mix={css({
									display: "flex",
									alignItems: "center",
									gap: "0.4rem",
									paddingLeft: `${0.25 + row.depth * 1}rem`,
								})}
							>
								<button
									type="button"
									mix={[
										css({
											flex: "1",
											textAlign: "left",
											padding: "0.15rem 0.4rem",
											fontFamily: "inherit",
											fontSize: "inherit",
											color: isSelected ? "#e0e7ff" : "#d1d5db",
											background: isSelected ? "#1e1b4b" : "transparent",
											border: "none",
											borderRadius: "0.2rem",
											cursor: "pointer",
										}),
										on<HTMLButtonElement, "click">("click", () => {
											selectedPath = row.path;
											void handle.update();
										}),
									]}
								>
									@&gt; {summarize(row.command)}
								</button>
								<button
									type="button"
									title="Delete this command"
									mix={[
										css({ ...CONTROL_BUTTON, padding: "0.05rem 0.4rem", fontSize: "0.7rem" }),
										on<HTMLButtonElement, "click">("click", () => {
											onChange(removeCommand(commands, row.path));
											if (selectedPath && samePath(selectedPath, row.path)) selectedPath = null;
											void handle.update();
										}),
									]}
								>
									×
								</button>
							</div>
						);
					})}
				</div>

				{/* Insert menu: choose a kind and add it (to the root, or a selected branch). */}
				<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" })}>
					<select
						value={insertKind}
						mix={[
							css(FIELD),
							on<HTMLSelectElement, "change">("change", (event) => {
								insertKind = (event.target as HTMLSelectElement).value as CommandKind;
								void handle.update();
							}),
						]}
					>
						{COMMAND_KINDS.map((entry) => (
							<option key={entry.id} value={entry.id} selected={insertKind === entry.id}>
								{entry.label}
							</option>
						))}
					</select>
					<button
						type="button"
						mix={[
							css(CONTROL_BUTTON),
							on<HTMLButtonElement, "click">("click", () => {
								// Insert into the selected branch when a branch header is selected, else root.
								let target =
									selectedPath !== null &&
									(selectedPath[selectedPath.length - 1]!.branch === "choice" ||
										selectedPath[selectedPath.length - 1]!.branch === "else")
										? selectedPath
										: [];
								insertAt(target as CommandPath);
								void handle.update();
							}),
						]}
					>
						+ Insert
					</button>
					{selectedPath !== null ? (
						<button
							type="button"
							mix={[
								css({ ...CONTROL_BUTTON }),
								on<HTMLButtonElement, "click">("click", () => {
									selectedPath = null;
									void handle.update();
								}),
							]}
						>
							Deselect
						</button>
					) : null}
				</div>

				{/* The fields editor for the selected command. */}
				{selected !== null && selectedPath !== null ? (
					<CommandFields
						command={selected}
						onChange={(next) =>
							onChange(updateCommand(commands, selectedPath as CommandPath, next))
						}
						onAddChoice={() => onChange(addChoice(commands, selectedPath as CommandPath))}
						onRemoveChoice={(choiceIndex) =>
							onChange(removeChoice(commands, selectedPath as CommandPath, choiceIndex))
						}
						onToggleElse={() => onChange(toggleElse(commands, selectedPath as CommandPath))}
					/>
				) : null}
			</section>
		);
	};
}

/** Props for one command's fields editor. */
interface CommandFieldsProps {
	/** The command whose fields are edited. */
	command: EventCommand;
	/** Called with the updated command. */
	onChange: (command: EventCommand) => void;
	/** Adds an empty choice to a `show-choices` command. */
	onAddChoice: () => void;
	/** Removes the choice at the given index from a `show-choices` command. */
	onRemoveChoice: (choiceIndex: number) => void;
	/** Toggles the `else` branch on a `conditional-branch` command. */
	onToggleElse: () => void;
}

/**
 * Renders the editable fields for the selected command, per its `kind`. Species,
 * move, and item pickers are drawn from the real content roster so only valid ids can
 * be authored; nesting commands (`show-choices`, `conditional-branch`) expose
 * choice/else management here while their nested command lists are edited inline in
 * the tree above.
 *
 * @param handle Component handle exposing the command props.
 * @returns The render function for one command's fields.
 */
function CommandFields(handle: Handle<CommandFieldsProps>) {
	return () => {
		let { command, onChange, onAddChoice, onRemoveChoice, onToggleElse } = handle.props;
		return (
			<div
				mix={css({
					display: "grid",
					gap: "0.5rem",
					padding: "0.6rem",
					background: "#141417",
					border: `1px solid ${ACCENT}`,
					borderRadius: "0.3rem",
				})}
			>
				<span mix={css({ fontSize: "0.72rem", color: "#a5b4fc", textTransform: "uppercase" })}>
					Edit: {command.kind}
				</span>
				{renderCommandFields(command, { onChange, onAddChoice, onRemoveChoice, onToggleElse })}
			</div>
		);
	};
}

/** The mutation callbacks a command's fields editor needs. */
interface CommandFieldCallbacks {
	onChange: (command: EventCommand) => void;
	onAddChoice: () => void;
	onRemoveChoice: (choiceIndex: number) => void;
	onToggleElse: () => void;
}

/** A labeled text input row for a command field. */
function textRow(
	label: string,
	value: string,
	placeholder: string,
	onInput: (value: string) => void,
) {
	return (
		<label mix={LABEL}>
			{label}
			<input
				type="text"
				value={value}
				placeholder={placeholder}
				mix={[
					css(FIELD),
					on<HTMLInputElement, "input">("input", (event) => {
						onInput((event.target as HTMLInputElement).value);
					}),
				]}
			/>
		</label>
	);
}

/** A labeled number input row for a command field. */
function numberRow(label: string, value: number, min: number, onInput: (value: number) => void) {
	return (
		<label mix={LABEL}>
			{label}
			<input
				type="number"
				min={String(min)}
				value={String(value)}
				mix={[
					css({ ...FIELD, width: "7rem" }),
					on<HTMLInputElement, "change">("change", (event) => {
						onInput(Math.max(min, Number((event.target as HTMLInputElement).value)));
					}),
				]}
			/>
		</label>
	);
}

/** A labeled select row backed by a list of ids for a command field. */
function selectRow(
	label: string,
	value: string,
	ids: readonly string[],
	onSelect: (value: string) => void,
) {
	return (
		<label mix={LABEL}>
			{label}
			<select
				value={value}
				mix={[
					css(FIELD),
					on<HTMLSelectElement, "change">("change", (event) => {
						onSelect((event.target as HTMLSelectElement).value);
					}),
				]}
			>
				{ids.length === 0 ? <option value="">(none)</option> : null}
				{ids.map((id) => (
					<option key={id} value={id} selected={value === id}>
						{id}
					</option>
				))}
			</select>
		</label>
	);
}

/**
 * Builds the field controls for one command by its `kind`. Split out of the component
 * so the discriminated-union switch stays a plain function returning JSX.
 *
 * @param command The command being edited.
 * @param cb The mutation callbacks (change / choice / else).
 */
function renderCommandFields(command: EventCommand, cb: CommandFieldCallbacks) {
	switch (command.kind) {
		case "text":
			return (
				<textarea
					value={command.text}
					placeholder="Message text"
					rows={2}
					mix={[
						css({ ...FIELD, resize: "vertical" }),
						on<HTMLTextAreaElement, "change">("change", (event) => {
							cb.onChange({ kind: "text", text: (event.target as HTMLTextAreaElement).value });
						}),
					]}
				/>
			);
		case "show-choices":
			return (
				<div mix={css({ display: "grid", gap: "0.4rem" })}>
					{textRow("Prompt (optional)", command.prompt ?? "", "Which one?", (value) =>
						cb.onChange({ ...command, prompt: value.trim().length > 0 ? value : undefined }),
					)}
					{command.choices.map((choice, choiceIndex) => (
						<div key={choiceIndex} mix={css({ display: "flex", gap: "0.35rem" })}>
							<input
								type="text"
								value={choice.label}
								placeholder={`Choice ${choiceIndex + 1}`}
								mix={[
									css({ ...FIELD, flex: "1" }),
									on<HTMLInputElement, "input">("input", (event) => {
										let choices = command.choices.map((entry, i) =>
											i === choiceIndex
												? { ...entry, label: (event.target as HTMLInputElement).value }
												: entry,
										);
										cb.onChange({ ...command, choices });
									}),
								]}
							/>
							<button
								type="button"
								disabled={command.choices.length <= 1}
								mix={[
									css({
										...CONTROL_BUTTON,
										padding: "0.2rem 0.45rem",
										opacity: command.choices.length <= 1 ? 0.5 : 1,
									}),
									on<HTMLButtonElement, "click">("click", () => cb.onRemoveChoice(choiceIndex)),
								]}
							>
								×
							</button>
						</div>
					))}
					<button
						type="button"
						mix={[
							css({ ...CONTROL_BUTTON, justifySelf: "start", padding: "0.2rem 0.5rem" }),
							on<HTMLButtonElement, "click">("click", () => cb.onAddChoice()),
						]}
					>
						+ Choice
					</button>
				</div>
			);
		case "conditional-branch":
			return (
				<div mix={css({ display: "grid", gap: "0.4rem" })}>
					{textRow("Switch (global flag)", command.condition.switch ?? "", "story-flag", (value) =>
						cb.onChange({
							...command,
							condition: {
								...command.condition,
								switch: value.trim().length > 0 ? value : undefined,
							},
						}),
					)}
					{textRow("Self switch", command.condition.selfSwitch ?? "", "A", (value) =>
						cb.onChange({
							...command,
							condition: {
								...command.condition,
								selfSwitch: value.trim().length > 0 ? value : undefined,
							},
						}),
					)}
					<label
						mix={css({
							display: "flex",
							gap: "0.4rem",
							alignItems: "center",
							fontSize: "0.75rem",
							color: "#9ca3af",
						})}
					>
						<input
							type="checkbox"
							checked={command.else !== undefined}
							mix={on<HTMLInputElement, "change">("change", () => cb.onToggleElse())}
						/>
						Has Else branch
					</label>
				</div>
			);
		case "control-switch":
			return (
				<div mix={css({ display: "grid", gap: "0.4rem" })}>
					{textRow("Flag", command.flag, "story-flag", (value) =>
						cb.onChange({ ...command, flag: value }),
					)}
					<label
						mix={css({
							display: "flex",
							gap: "0.4rem",
							alignItems: "center",
							fontSize: "0.75rem",
							color: "#9ca3af",
						})}
					>
						<input
							type="checkbox"
							checked={command.value}
							mix={on<HTMLInputElement, "change">("change", (event) => {
								cb.onChange({ ...command, value: (event.target as HTMLInputElement).checked });
							})}
						/>
						Turn ON (unchecked = OFF)
					</label>
				</div>
			);
		case "control-self-switch":
			return (
				<div mix={css({ display: "grid", gap: "0.4rem" })}>
					{textRow("Self switch", command.name, "A", (value) =>
						cb.onChange({ ...command, name: value }),
					)}
					<label
						mix={css({
							display: "flex",
							gap: "0.4rem",
							alignItems: "center",
							fontSize: "0.75rem",
							color: "#9ca3af",
						})}
					>
						<input
							type="checkbox"
							checked={command.value}
							mix={on<HTMLInputElement, "change">("change", (event) => {
								cb.onChange({ ...command, value: (event.target as HTMLInputElement).checked });
							})}
						/>
						Turn ON (unchecked = OFF)
					</label>
				</div>
			);
		case "start-trainer-battle":
			return renderTrainerFields(command, cb);
		case "wild-encounter":
			return (
				<div mix={css({ display: "flex", gap: "0.5rem", flexWrap: "wrap" })}>
					{selectRow("Species", command.speciesId, SPECIES_IDS, (value) =>
						cb.onChange({ ...command, speciesId: value }),
					)}
					{numberRow("Level", command.level, 1, (value) =>
						cb.onChange({ ...command, level: value }),
					)}
				</div>
			);
		case "heal-party":
			return (
				<span mix={css({ fontSize: "0.75rem", color: "#9ca3af" })}>Fully heals the party.</span>
			);
		case "give-item":
			return (
				<div mix={css({ display: "flex", gap: "0.5rem", flexWrap: "wrap" })}>
					{selectRow("Item", command.itemId, ITEM_IDS, (value) =>
						cb.onChange({ ...command, itemId: value }),
					)}
					{numberRow("Count", command.count, 1, (value) =>
						cb.onChange({ ...command, count: value }),
					)}
				</div>
			);
		case "warp":
			return (
				<div mix={css({ display: "flex", gap: "0.5rem", flexWrap: "wrap" })}>
					{textRow("Map id", command.map, "route-2", (value) =>
						cb.onChange({ ...command, map: value }),
					)}
					{numberRow("X", command.x, 0, (value) => cb.onChange({ ...command, x: value }))}
					{numberRow("Y", command.y, 0, (value) => cb.onChange({ ...command, y: value }))}
				</div>
			);
		case "face-player":
			return (
				<span mix={css({ fontSize: "0.75rem", color: "#9ca3af" })}>Turns to face the player.</span>
			);
		case "move":
			return (
				<div mix={css({ display: "grid", gap: "0.35rem" })}>
					<span mix={css({ fontSize: "0.75rem", color: "#9ca3af" })}>
						Steps: {command.steps.length > 0 ? command.steps.join(" → ") : "(none)"}
					</span>
					<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.3rem" })}>
						{DIRECTIONS.map((direction) => (
							<button
								key={direction}
								type="button"
								mix={[
									css({ ...CONTROL_BUTTON, padding: "0.2rem 0.5rem" }),
									on<HTMLButtonElement, "click">("click", () => {
										cb.onChange({ ...command, steps: [...command.steps, direction] });
									}),
								]}
							>
								+{direction}
							</button>
						))}
						<button
							type="button"
							mix={[
								css({ ...CONTROL_BUTTON, padding: "0.2rem 0.5rem" }),
								on<HTMLButtonElement, "click">("click", () => {
									cb.onChange({ ...command, steps: [] });
								}),
							]}
						>
							Clear
						</button>
					</div>
				</div>
			);
		case "wait":
			return (
				<div>
					{numberRow("Frames", command.frames, 0, (value) =>
						cb.onChange({ ...command, frames: value }),
					)}
				</div>
			);
	}
}

/**
 * The fields for a `start-trainer-battle` command: an optional name and reward, and
 * an ordered party of species+level members chosen from the real roster. Kept
 * separate from the main switch so the trainer sub-form stays readable.
 *
 * @param command The trainer-battle command being edited.
 * @param cb The mutation callbacks.
 */
function renderTrainerFields(
	command: Extract<EventCommand, { kind: "start-trainer-battle" }>,
	cb: CommandFieldCallbacks,
) {
	let trainer = command.trainer;
	return (
		<div mix={css({ display: "grid", gap: "0.4rem" })}>
			<div mix={css({ display: "flex", gap: "0.5rem", flexWrap: "wrap" })}>
				{textRow("Trainer name", trainer.name ?? "", "Youngster Joey", (value) =>
					cb.onChange({
						...command,
						trainer: { ...trainer, name: value.trim().length > 0 ? value : undefined },
					}),
				)}
				{numberRow("Reward", trainer.reward ?? 0, 0, (value) =>
					cb.onChange({ ...command, trainer: { ...trainer, reward: value } }),
				)}
			</div>
			<span mix={css({ fontSize: "0.72rem", color: "#9ca3af" })}>Party</span>
			{trainer.party.map((member, index) => (
				<div key={index} mix={css({ display: "flex", gap: "0.4rem", alignItems: "flex-end" })}>
					<label mix={css({ ...LABEL_STYLE, flex: "1" })}>
						Species
						<select
							value={member.speciesId}
							mix={[
								css(FIELD),
								on<HTMLSelectElement, "change">("change", (event) => {
									let party = trainer.party.map((entry, i) =>
										i === index
											? { ...entry, speciesId: (event.target as HTMLSelectElement).value }
											: entry,
									);
									cb.onChange({ ...command, trainer: { ...trainer, party } });
								}),
							]}
						>
							{SPECIES_IDS.map((id) => (
								<option key={id} value={id} selected={member.speciesId === id}>
									{id}
								</option>
							))}
						</select>
					</label>
					<label mix={css({ ...LABEL_STYLE, width: "4.5rem" })}>
						Level
						<input
							type="number"
							min="1"
							value={String(member.level)}
							mix={[
								css(FIELD),
								on<HTMLInputElement, "change">("change", (event) => {
									let level = Math.max(1, Number((event.target as HTMLInputElement).value));
									let party = trainer.party.map((entry, i) =>
										i === index ? { ...entry, level } : entry,
									);
									cb.onChange({ ...command, trainer: { ...trainer, party } });
								}),
							]}
						/>
					</label>
					<button
						type="button"
						mix={[
							css({ ...CONTROL_BUTTON, padding: "0.25rem 0.45rem" }),
							on<HTMLButtonElement, "click">("click", () => {
								let party = trainer.party.filter((_, i) => i !== index);
								cb.onChange({ ...command, trainer: { ...trainer, party } });
							}),
						]}
					>
						×
					</button>
				</div>
			))}
			<button
				type="button"
				mix={[
					css({ ...CONTROL_BUTTON, justifySelf: "start", padding: "0.2rem 0.5rem" }),
					on<HTMLButtonElement, "click">("click", () => {
						let party = [...trainer.party, { speciesId: SPECIES_IDS[0] ?? "", level: 5 }];
						cb.onChange({ ...command, trainer: { ...trainer, party } });
					}),
				]}
			>
				+ Party member
			</button>
		</div>
	);
}
