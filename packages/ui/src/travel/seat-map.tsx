/**
 * An aircraft cabin seat picker: a fuselage with a rounded nose, column letters over a grid of
 * seats, row numbers down the aisle and exits marked on both walls. Every seat is a native radio
 * under one name, so a form posts the pick and arrow keys move between seats without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";

/** How tall the cabin grows before it scrolls, unless `--ui-seat-map-max-height` says otherwise. */
const MAX_HEIGHT = "var(--ui-seat-map-max-height, 36rem)";

/** A seat's height: 40px, or the 44px touch target on a coarse pointer. */
const SEAT_HEIGHT = "max(2.5rem, var(--ui-target-size, 0px))";

/** A seat column: never narrower than 32px, and no wider than a comfortable 44px. */
const SEAT_COLUMN = "minmax(2rem, 2.75rem)";

/** An aisle column, wide enough for a two-digit row number. */
const AISLE_COLUMN = "minmax(1.25rem, 2rem)";

/** The strip inside each wall where exits and the wing are drawn. */
const WALL_COLUMN = "0.75rem";

/** Prop types for {@link SeatMap} and {@link SeatMap.Legend}. */
export namespace SeatMap {
	/** Whether a seat can be picked; `"taken"` and `"blocked"` seats render disabled. */
	export type Status = "available" | "taken" | "blocked";

	/** What a seat offers; every kind but `"standard"` is tinted. */
	export type Kind = "standard" | "extra-legroom" | "exit" | "premium";

	/** One seat of a row. */
	export interface Seat {
		/** The seat's code and the value the form posts, such as "14C". */
		id: string;
		status: Status;
		/** @default "standard" */
		kind?: Kind;
		/** The seat's surcharge, formatted by the caller, shown small under the letter. */
		price?: RemixNode;
	}

	/** One row of the cabin, its seats in the order of the layout's letters. */
	export interface Row {
		number: number;
		seats: Seat[];
	}

	/** A cabin section's title, drawn across the cabin above row `from`. */
	export interface Section {
		from: number;
		title: RemixNode;
	}

	/** Words appended to a seat's spoken name, in the page's language. */
	export interface Labels {
		/** Read after a seat that cannot be picked because someone has it, e.g. "taken". */
		taken: string;
		/** Read after a seat that cannot be picked for any other reason, e.g. "unavailable". */
		blocked?: string;
		/** Read after a seat beside an aisle, e.g. "aisle". */
		aisle?: string;
		/** Read after a seat against a wall, e.g. "window". */
		window?: string;
		/** Read after a seat in one of `exitRows`, e.g. "exit row". */
		exit?: string;
		/** Read after a seat of each tinted kind, e.g. `{ "extra-legroom": "extra legroom" }`. */
		kinds?: Partial<Record<Exclude<Kind, "standard">, string>>;
	}

	/** Every native `<fieldset>` attribute, plus the cabin to draw. */
	export interface Props extends Omit<TagProps<"fieldset">, "children"> {
		rows: Row[];
		/** Seat letters in cabin order, a space for each aisle, e.g. "ABC DEF". */
		layout: string;
		/** The form field the picked seat's id posts under. */
		name: string;
		/** The seat id checked on load. */
		selected?: string;
		/** Names the radio group for assistive technology, e.g. "Choose a seat". */
		label: string;
		labels: Labels;
		/** A visible header under the nose, such as "Main deck · Larkwing A321". */
		deck?: RemixNode;
		/** First and last rows the wing spans, drawn on both walls. */
		wings?: [number, number];
		/** Rows with an emergency exit, marked on both walls. */
		exitRows?: number[];
		/** Section titles, each drawn above the row it starts at. */
		sections?: Section[];
		/** Asks the browser to require a pick before the form submits. */
		required?: boolean;
	}

	/** What one legend entry explains. */
	export type Swatch = "available" | "selected" | "taken" | "blocked" | Exclude<Kind, "standard">;

	/** One legend entry: the swatch drawn and its caption. */
	export interface LegendItem {
		swatch: Swatch;
		label: RemixNode;
	}

	/** Every native `<ul>` attribute, plus the entries to explain. */
	export interface LegendProps extends Omit<TagProps<"ul">, "children"> {
		items: LegendItem[];
	}
}

/** One column of the cabin grid: a seat with its letter, or an aisle. */
type Column = { kind: "seat"; letter: string } | { kind: "aisle" };

/**
 * Reads a layout string into its columns, one per letter and one per run of spaces, so
 * `"ABC  DEF"` and `"ABC DEF"` both make a single aisle.
 *
 * @param layout Seat letters with spaces for aisles.
 * @returns The columns between the two walls, in cabin order.
 */
function parseLayout(layout: string): Column[] {
	let columns: Column[] = [];
	for (let character of layout.trim()) {
		if (character.trim() === "") {
			if (columns.at(-1)?.kind !== "aisle") columns.push({ kind: "aisle" });
			continue;
		}
		columns.push({ kind: "seat", letter: character });
	}
	return columns;
}

/**
 * The seat and its spoken extras for one grid column of a row: whether it sits by an aisle or a
 * wall, read from the columns either side of it.
 */
function seatPlacement(columns: Column[], index: number): { aisle: boolean; window: boolean } {
	return {
		aisle: columns[index - 1]?.kind === "aisle" || columns[index + 1]?.kind === "aisle",
		window: index === 0 || index === columns.length - 1,
	};
}

/**
 * Renders the cabin as a `<fieldset>` named by `label`. Each seat is a radio named `name` with
 * the seat's id as its value, so the pick posts with the form and arrow keys move through the
 * cabin natively; taken and blocked seats are disabled radios.
 *
 * @param handle Runtime handle carrying the cabin's props.
 * @returns The render function producing the cabin's markup.
 * @example
 * <SeatMap
 * 	name="seat"
 * 	label="Choose a seat"
 * 	labels={{ taken: "taken", aisle: "aisle", window: "window", exit: "exit row" }}
 * 	layout="ABC DEF"
 * 	rows={rows}
 * 	selected="14C"
 * 	exitRows={[12]}
 * 	wings={[10, 18]}
 * />
 */
export function SeatMap(handle: Handle<SeatMap.Props>) {
	return () => {
		let {
			rows,
			layout,
			name,
			selected,
			label,
			labels,
			deck,
			wings,
			exitRows,
			sections,
			required,
			mix,
			...rest
		} = handle.props;
		let columns = parseLayout(layout);
		let template = [
			WALL_COLUMN,
			...columns.map((column) => (column.kind === "seat" ? SEAT_COLUMN : AISLE_COLUMN)),
			WALL_COLUMN,
		].join(" ");
		let exits = new Set(exitRows ?? []);
		let titles = new Map((sections ?? []).map((section) => [section.from, section.title]));

		/** The words read after a seat's code, joined with commas. */
		function extras(seat: SeatMap.Seat, row: number, index: number): string {
			let words: Array<string | undefined> = [];
			let placement = seatPlacement(columns, index);
			if (placement.window) words.push(labels.window);
			if (placement.aisle) words.push(labels.aisle);
			if (seat.kind !== undefined && seat.kind !== "standard")
				words.push(labels.kinds?.[seat.kind]);
			if (exits.has(row)) words.push(labels.exit);
			if (seat.status === "taken") words.push(labels.taken);
			if (seat.status === "blocked") words.push(labels.blocked ?? labels.taken);
			return words
				.filter((word) => word !== undefined && word !== "")
				.map((word) => `, ${word}`)
				.join("");
		}

		return (
			<fieldset
				data-slot="seat-map"
				{...rest}
				mix={mergeMix(
					[
						raw({
							minInlineSize: "0",
							margin: "0",
							padding: "0",
							border: "0",
						}),
					],
					mix,
				)}
			>
				<legend mix={[visuallyHidden()]}>{label}</legend>
				<div
					data-slot="seat-map-cabin"
					mix={[
						raw({
							maxBlockSize: MAX_HEIGHT,
							overflow: "auto",
							overscrollBehavior: "contain",
							scrollPaddingBlockStart: "2.5rem",
						}),
					]}
				>
					<div
						data-slot="seat-map-fuselage"
						mix={[
							raw({
								position: "relative",
								inlineSize: "fit-content",
								minInlineSize: "100%",
								marginInline: "auto",
								paddingBlock: "5rem 1.5rem",
								paddingInline: "0.25rem",
								backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
								border: "2px solid var(--ui-neutral-border)",
								borderBlockEnd: "0",
								borderStartStartRadius: "50% 4.5rem",
								borderStartEndRadius: "50% 4.5rem",
							}),
						]}
					>
						<svg
							aria-hidden="true"
							viewBox="0 0 64 16"
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "1.75rem",
									insetInlineStart: "50%",
									translate: "-50% 0",
									inlineSize: "4rem",
									blockSize: "1rem",
									color: "var(--ui-neutral-border-strong)",
									opacity: "0.5",
								}),
							]}
						>
							<path d="M4 14 Q32 -2 60 14 L50 15 Q32 6 14 15 Z" fill="currentColor" />
						</svg>
						{deck === undefined ? null : (
							<p
								data-slot="seat-map-deck"
								mix={[
									raw({
										margin: "0 0 0.75rem",
										textAlign: "center",
										fontSize: "0.75rem",
										fontWeight: "600",
										color: "var(--ui-neutral-fg)",
									}),
								]}
							>
								{deck}
							</p>
						)}
						<div
							data-slot="seat-map-grid"
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: template,
									justifyContent: "center",
									rowGap: "0.375rem",
									columnGap: "0.25rem",
								}),
							]}
						>
							<div
								aria-hidden="true"
								data-slot="seat-map-letters"
								mix={[
									raw({
										display: "grid",
										gridColumn: "1 / -1",
										gridTemplateColumns: "subgrid",
										position: "sticky",
										insetBlockStart: "0",
										zIndex: "1",
										paddingBlock: "0.375rem",
										backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
										fontSize: "0.75rem",
										fontWeight: "600",
										textAlign: "center",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								<span />
								{columns.map((column, index) => (
									<span key={index}>{column.kind === "seat" ? column.letter : null}</span>
								))}
								<span />
							</div>
							{rows.flatMap((row) => {
								let title = titles.get(row.number);
								let wing = wings !== undefined && row.number >= wings[0] && row.number <= wings[1];
								let exit = exits.has(row.number);
								let seatIndex = 0;
								return [
									title === undefined ? null : (
										<p
											key={`section-${row.number}`}
											data-slot="seat-map-section"
											mix={[
												raw({
													gridColumn: "1 / -1",
													margin: "0.75rem 0 0.25rem",
													paddingBlockEnd: "0.25rem",
													borderBlockEnd: "1px solid var(--ui-neutral-border)",
													textAlign: "center",
													fontSize: "0.75rem",
													fontWeight: "600",
													color: "var(--ui-neutral-fg-emphasis)",
												}),
											]}
										>
											{title}
										</p>
									),
									<div
										key={`row-${row.number}`}
										data-slot="seat-map-row"
										data-row={row.number}
										data-exit={exit ? "" : undefined}
										data-wing={wing ? "" : undefined}
										mix={[
											raw({
												display: "grid",
												gridColumn: "1 / -1",
												gridTemplateColumns: "subgrid",
												alignItems: "center",
											}),
										]}
									>
										<SeatMapWall side="start" exit={exit} />
										{columns.map((column, index) => {
											if (column.kind === "aisle") {
												return (
													<span
														key={`aisle-${index}`}
														aria-hidden="true"
														data-slot="seat-map-row-number"
														mix={[
															raw({
																textAlign: "center",
																fontSize: "0.6875rem",
																fontVariantNumeric: "tabular-nums",
																color: "var(--ui-neutral-fg-muted)",
															}),
														]}
													>
														{row.number}
													</span>
												);
											}
											let seat = row.seats[seatIndex];
											seatIndex += 1;
											if (seat === undefined) return <span key={`gap-${index}`} />;
											return (
												<SeatMapSeat
													key={seat.id}
													seat={seat}
													letter={column.letter}
													name={name}
													checked={seat.id === selected}
													required={required}
													extras={extras(seat, row.number, index)}
												/>
											);
										})}
										<SeatMapWall side="end" exit={exit} />
									</div>,
								];
							})}
						</div>
					</div>
				</div>
			</fieldset>
		);
	};
}

/** Props of {@link SeatMapWall}. */
interface SeatMapWallProps {
	side: "start" | "end";
	exit: boolean;
}

/**
 * One wall cell of a row: a swept tint where the wing joins the fuselage, and an outward
 * chevron in the success tone at an exit, mirrored on the two sides.
 */
function SeatMapWall(handle: Handle<SeatMapWallProps>) {
	return () => {
		let { side, exit } = handle.props;
		return (
			<span
				aria-hidden="true"
				data-slot="seat-map-wall"
				data-side={side}
				mix={[
					raw({
						alignSelf: "stretch",
						display: "grid",
						placeItems: "center",
						marginBlock: "-0.1875rem",
						color: "var(--ui-success-fg)",
						"[data-wing] > &": {
							backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
						},
						"[data-wing] > &[data-side=start]": { borderStartStartRadius: "0.5rem" },
						"[data-wing] > &[data-side=end]": { borderStartEndRadius: "0.5rem" },
						"&[data-side=end] svg, &[data-side=start]:dir(rtl) svg": { scale: "-1 1" },
						"&[data-side=end]:dir(rtl) svg": { scale: "1 1" },
					}),
				]}
			>
				{exit ? (
					<svg viewBox="0 0 8 12" mix={[raw({ inlineSize: "0.5rem", blockSize: "0.75rem" })]}>
						<path
							d="M6.5 1 L1.5 6 L6.5 11"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				) : null}
			</span>
		);
	};
}

/** Props of {@link SeatMapSeat}. */
interface SeatMapSeatProps {
	seat: SeatMap.Seat;
	letter: string;
	name: string;
	checked: boolean;
	required?: boolean;
	/** Comma-led words read after the seat's code. */
	extras: string;
}

/**
 * One seat: a label drawn as a seat back around a visually hidden radio. The radio keeps focus
 * and checkedness native, and the label's spoken name is the seat's code and its extras while
 * the drawn letter stays out of the accessibility tree.
 */
function SeatMapSeat(handle: Handle<SeatMapSeatProps>) {
	return () => {
		let { seat, letter, name, checked, required, extras } = handle.props;
		let disabled = seat.status !== "available";
		return (
			<label
				data-slot="seat-map-seat"
				data-status={seat.status}
				data-kind={seat.kind ?? "standard"}
				mix={[seatStyle()]}
			>
				<input
					type="radio"
					name={name}
					value={seat.id}
					checked={checked ? true : undefined}
					disabled={disabled ? true : undefined}
					required={required ? true : undefined}
					mix={[visuallyHidden()]}
				/>
				<span aria-hidden="true" data-slot="seat-map-letter">
					{letter}
				</span>
				<span mix={[visuallyHidden()]}>{`${seat.id}${extras}`}</span>
				{seat.price === undefined || disabled ? null : (
					<span data-slot="seat-map-price">{seat.price}</span>
				)}
			</label>
		);
	};
}

/**
 * A seat's or a legend swatch's look, keyed off `data-status`, `data-kind` and the radio's own
 * `:checked`: tinted kinds, a cross over a taken seat, a dashed outline for a blocked one, and the
 * brand fill with a ring for the pick, so the pick reads by shape as well as colour.
 */
function seatStyle() {
	return raw({
		position: "relative",
		display: "grid",
		placeContent: "center",
		justifyItems: "center",
		gap: "0.0625rem",
		minInlineSize: "2rem",
		minBlockSize: SEAT_HEIGHT,
		boxSizing: "border-box",
		paddingBlock: "0.125rem",
		border: "1.5px solid var(--ui-brand-border)",
		borderStartStartRadius: "0.625rem",
		borderStartEndRadius: "0.625rem",
		borderEndStartRadius: "0.25rem",
		borderEndEndRadius: "0.25rem",
		backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
		color: "var(--ui-brand-fg-emphasis)",
		fontSize: "0.75rem",
		fontWeight: "600",
		lineHeight: "1",
		cursor: "pointer",
		userSelect: "none",
		transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
		"@media (prefers-reduced-motion: reduce)": { transition: "none" },
		"& [data-slot=seat-map-price]": {
			fontSize: "0.5625rem",
			fontWeight: "500",
			fontVariantNumeric: "tabular-nums",
			whiteSpace: "nowrap",
			color: "var(--ui-neutral-fg-muted)",
		},
		"&[data-kind=extra-legroom]": {
			backgroundColor: "var(--ui-brand-bg-tint-hover)",
			borderColor: "var(--ui-brand-border-strong)",
		},
		"&[data-kind=exit]": {
			backgroundColor: "var(--ui-success-bg-tint)",
			borderColor: "var(--ui-success-border-strong)",
			color: "var(--ui-success-fg-emphasis)",
		},
		"&[data-kind=premium]": {
			backgroundColor: "var(--ui-warning-bg-tint)",
			borderColor: "var(--ui-warning-border-strong)",
			color: "var(--ui-warning-fg-emphasis)",
		},
		"&:has(input:enabled):hover": { backgroundColor: "var(--ui-brand-bg-tint-pressed)" },
		"&:has(input:focus-visible)": {
			outline: "2px solid var(--ui-brand-ring)",
			outlineOffset: "2px",
		},
		"&:has(input:checked), &[data-status=selected]": {
			backgroundColor: "var(--ui-brand-bg-solid)",
			borderColor: "var(--ui-brand-border-strong)",
			color: "var(--ui-brand-fg-on-solid)",
			boxShadow:
				"0 0 0 2px var(--ui-surface-raised, var(--ui-bg)), 0 0 0 3.5px var(--ui-brand-bg-solid)",
		},
		"&:has(input:checked) [data-slot=seat-map-price]": { color: "inherit", opacity: "0.85" },
		"&[data-status=taken]": {
			cursor: "not-allowed",
			borderColor: "var(--ui-neutral-border)",
			backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
			backgroundImage:
				"linear-gradient(45deg, transparent calc(50% - 0.75px), var(--ui-neutral-border-strong) calc(50% - 0.75px) calc(50% + 0.75px), transparent calc(50% + 0.75px)), linear-gradient(-45deg, transparent calc(50% - 0.75px), var(--ui-neutral-border-strong) calc(50% - 0.75px) calc(50% + 0.75px), transparent calc(50% + 0.75px))",
			color: "transparent",
		},
		"&[data-status=blocked]": {
			cursor: "not-allowed",
			borderStyle: "dashed",
			borderColor: "var(--ui-neutral-border)",
			backgroundColor: "transparent",
			color: "transparent",
		},
	});
}

/**
 * Renders the key to the cabin: a wrapping list of swatches drawn exactly like the seats they
 * explain, each beside the caller's caption.
 *
 * @param handle Runtime handle carrying the legend's props.
 * @returns The render function producing the legend's markup.
 * @example
 * <SeatMap.Legend
 * 	items={[
 * 		{ swatch: "available", label: "Available" },
 * 		{ swatch: "extra-legroom", label: "Extra legroom" },
 * 		{ swatch: "taken", label: "Taken" },
 * 	]}
 * />
 */
SeatMap.Legend = function SeatMapLegend(handle: Handle<SeatMap.LegendProps>) {
	return () => {
		let { items, mix, ...rest } = handle.props;
		return (
			<ul
				data-slot="seat-map-legend"
				{...rest}
				mix={mergeMix(
					[
						raw({
							display: "flex",
							flexWrap: "wrap",
							gap: "0.5rem 1rem",
							margin: "0",
							padding: "0",
							listStyle: "none",
							fontSize: "0.75rem",
							color: "var(--ui-neutral-fg)",
						}),
					],
					mix,
				)}
			>
				{items.map((item) => {
					let status =
						item.swatch === "taken" || item.swatch === "blocked" || item.swatch === "selected"
							? item.swatch
							: "available";
					let kind =
						status === "available" && item.swatch !== "available" ? item.swatch : "standard";
					return (
						<li
							key={item.swatch}
							data-swatch={item.swatch}
							mix={[raw({ display: "flex", alignItems: "center", gap: "0.375rem" })]}
						>
							<span
								aria-hidden="true"
								data-slot="seat-map-swatch"
								data-status={status}
								data-kind={kind}
								mix={[
									seatStyle(),
									raw({
										minInlineSize: "1rem",
										minBlockSize: "1.125rem",
										inlineSize: "1rem",
										cursor: "default",
									}),
								]}
							/>
							<span>{item.label}</span>
						</li>
					);
				})}
			</ul>
		);
	};
};
