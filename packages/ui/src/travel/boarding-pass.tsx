/**
 * A wallet-style boarding pass: the airline's band, the route in large airport codes, a grid of
 * flight details, a perforated tear line and a scannable-looking code. `PassCode` draws that code
 * as a square pattern derived from the caller's string, the same string always giving the same art.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { PlaneIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";

/** Modules along each side of the code art, finder squares included. */
const CODE_SIZE = 25;

/** Light modules around the code art, so the pattern reads apart from the card. */
const QUIET_ZONE = 2;

/** Modules along each side of a finder square. */
const FINDER_SIZE = 7;

/** Radius of the half-circle notches cut where the stub tears off. */
const NOTCH = "0.75rem";

/** Container the pass names, so its parts measure the pass instead of the page. */
const CONTAINER_NAME = "ui-boarding-pass";

/** The light colour the code art's quiet zone and finder rings are painted with. */
const LIGHT = "var(--ui-surface-raised, var(--ui-bg))";

/** Prop types for {@link BoardingPass} and {@link PassCode}. */
export namespace BoardingPass {
	/** One end of the flight. */
	export interface Place {
		/** The airport's three-letter code, set large. */
		code: string;
		city: RemixNode;
		/** Departure or arrival time, formatted by the caller. */
		time: RemixNode;
	}

	/** The airline printed on the band. */
	export interface Airline {
		name: RemixNode;
		/** A small logo drawn before the name, such as an `<svg>` or `<img>`. */
		mark?: RemixNode;
	}

	/** The caption over each field, in the page's language. */
	export interface Labels {
		passenger: RemixNode;
		flight: RemixNode;
		date: RemixNode;
		gate: RemixNode;
		boards: RemixNode;
		seat: RemixNode;
		zone: RemixNode;
		cabin: RemixNode;
		confirmation: RemixNode;
		/** Read before the origin for assistive technology, e.g. "From". */
		from?: string;
		/** Read before the destination for assistive technology, e.g. "To". */
		to?: string;
		/** Names the code art, e.g. "Boarding code for confirmation K7Q2XR". */
		code: string;
	}

	/** Every native `<article>` attribute, plus the trip it prints. */
	export interface Props extends Omit<TagProps<"article">, "children"> {
		/** Names the pass for assistive technology, e.g. "Boarding pass, MRW to VLS". */
		label: string;
		airline: Airline;
		passenger: RemixNode;
		from: Place;
		to: Place;
		flight: RemixNode;
		date: RemixNode;
		gate: RemixNode;
		/** When boarding starts, formatted by the caller. */
		boards: RemixNode;
		seat: RemixNode;
		zone: RemixNode;
		cabin: RemixNode;
		confirmation: RemixNode;
		/** The data the code art stands for; the same string always draws the same pattern. */
		code: string;
		labels: Labels;
	}
}

/** Prop types for {@link PassCode}. */
export namespace PassCode {
	/** Every native `<svg>` attribute, plus the data to draw and its spoken name. */
	export interface Props extends Omit<TagProps<"svg">, "children"> {
		/** The data the pattern is derived from. */
		code: string;
		/** Names the image, e.g. "Boarding code for confirmation K7Q2XR". */
		label: string;
	}
}

/**
 * Hashes a string with 32-bit FNV-1a, a fixed function, so a code renders the same pattern on
 * the server, in every browser and on every visit.
 *
 * @param text The string to hash.
 * @returns An unsigned 32-bit hash.
 */
function hash(text: string): number {
	let value = 0x811c9dc5;
	for (let index = 0; index < text.length; index++) {
		value ^= text.charCodeAt(index);
		value = Math.imul(value, 0x01000193);
	}
	return value >>> 0;
}

/**
 * A seeded mulberry32 generator: each call returns the next number in [0, 1) of a sequence
 * fixed by `seed`.
 *
 * @param seed The sequence's starting state.
 * @returns A function drawing the next number.
 */
function sequence(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Whether a module belongs to a finder square or the light ring around it, at the top-left,
 * top-right and bottom-left corners.
 */
function inFinder(x: number, y: number): boolean {
	let near = FINDER_SIZE + 1;
	let far = CODE_SIZE - near;
	return (x < near && y < near) || (x >= far && y < near) || (x < near && y >= far);
}

/**
 * The dark data modules of a code as one SVG path: timing stripes along row and column six,
 * and a seeded half-and-half fill everywhere outside the finder squares.
 *
 * @param code The data the pattern is derived from.
 * @returns Path data in module units, offset by the quiet zone.
 */
function modulePath(code: string): string {
	let next = sequence(hash(code));
	let parts: string[] = [];
	for (let y = 0; y < CODE_SIZE; y++) {
		for (let x = 0; x < CODE_SIZE; x++) {
			if (inFinder(x, y)) continue;
			let dark = x === 6 || y === 6 ? (x + y) % 2 === 0 : next() < 0.5;
			if (dark) parts.push(`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`);
		}
	}
	return parts.join("");
}

/**
 * Renders a code-like pattern as an `<svg role="img">` named by `label`: a 25-module square
 * with a finder square in three corners and a quiet zone around it. It is decorative art standing
 * in for a real code; equal `code` strings always draw equal patterns, and different ones differ.
 *
 * @param handle Runtime handle carrying the art's props.
 * @returns The render function producing the art's markup.
 * @example
 * <PassCode code="LKW482|K7Q2XR|14C" label="Boarding code for confirmation K7Q2XR" />
 */
export function PassCode(handle: Handle<PassCode.Props>) {
	return () => {
		let { code, label, mix, ...rest } = handle.props;
		let extent = CODE_SIZE + QUIET_ZONE * 2;
		let corners: Array<[number, number]> = [
			[0, 0],
			[CODE_SIZE - FINDER_SIZE, 0],
			[0, CODE_SIZE - FINDER_SIZE],
		];
		return (
			<svg
				role="img"
				aria-label={label}
				viewBox={`0 0 ${extent} ${extent}`}
				shape-rendering="crispEdges"
				data-slot="pass-code"
				{...rest}
				mix={mergeMix(
					[
						raw({
							display: "block",
							inlineSize: "100%",
							maxInlineSize: "9rem",
							aspectRatio: "1",
							color: "var(--ui-neutral-fg-emphasis)",
							"& [data-light]": { fill: LIGHT },
						}),
					],
					mix,
				)}
			>
				<rect data-light="" width={extent} height={extent} />
				<path data-slot="pass-code-modules" d={modulePath(code)} fill="currentColor" />
				{corners.map(([x, y]) => (
					<g
						key={`${x}-${y}`}
						data-slot="pass-code-finder"
						transform={`translate(${x + QUIET_ZONE} ${y + QUIET_ZONE})`}
					>
						<rect width={FINDER_SIZE} height={FINDER_SIZE} fill="currentColor" />
						<rect data-light="" x="1" y="1" width={FINDER_SIZE - 2} height={FINDER_SIZE - 2} />
						<rect
							x="2"
							y="2"
							width={FINDER_SIZE - 4}
							height={FINDER_SIZE - 4}
							fill="currentColor"
						/>
					</g>
				))}
			</svg>
		);
	};
}

/**
 * The CSS mask cutting a half-circle notch out of both corners on one edge of a pass part, so the
 * two parts meet at a tear line with a round bite out of each side.
 */
function notchMask(edge: "top" | "bottom"): string {
	let y = edge === "top" ? "0" : "100%";
	let circle = (x: string) =>
		`radial-gradient(circle at ${x} ${y}, transparent ${NOTCH}, black calc(${NOTCH} + 0.5px))`;
	return `${circle("0")} 0 0 / 51% 100% no-repeat, ${circle("100%")} 100% 0 / 51% 100% no-repeat`;
}

/**
 * Renders the pass: an `<article>` named by `label` whose top part holds the airline band, the
 * route and the details as a `<dl>`, and whose stub, below a perforated tear, holds the
 * {@link PassCode}. It prints in full colour, unshadowed and outlined, on one page.
 *
 * @param handle Runtime handle carrying the pass's props.
 * @returns The render function producing the pass's markup.
 * @example
 * <BoardingPass
 * 	label="Boarding pass, MRW to VLS"
 * 	airline={{ name: "Larkwing Air" }}
 * 	passenger="Ana Ortiz"
 * 	from={{ code: "MRW", city: "Marrow Bay", time: "08:40" }}
 * 	to={{ code: "VLS", city: "Vellis", time: "11:05" }}
 * 	flight="LK 482" date="14 Mar" gate="B12" boards="08:05" seat="14C" zone="3" cabin="Economy"
 * 	confirmation="K7Q2XR"
 * 	code="LK482|K7Q2XR|14C"
 * 	labels={labels}
 * />
 */
export function BoardingPass(handle: Handle<BoardingPass.Props>) {
	return () => {
		let {
			label,
			airline,
			passenger,
			from,
			to,
			flight,
			date,
			gate,
			boards,
			seat,
			zone,
			cabin,
			confirmation,
			code,
			labels,
			mix,
			...rest
		} = handle.props;
		let part = raw({
			backgroundColor: LIGHT,
			"@media print": {
				mask: "none",
				border: "1px solid var(--ui-neutral-border-strong)",
			},
		});

		return (
			<article
				aria-label={label}
				data-slot="boarding-pass"
				{...rest}
				mix={mergeMix(
					[
						raw({
							container: `${CONTAINER_NAME} / inline-size`,
							inlineSize: "100%",
							maxInlineSize: "24rem",
							color: "var(--ui-neutral-fg-emphasis)",
							filter:
								"drop-shadow(0 1px 1px color-mix(in oklab, var(--ui-neutral-fg-emphasis) 10%, transparent)) drop-shadow(0 8px 20px color-mix(in oklab, var(--ui-neutral-fg-emphasis) 12%, transparent))",
							"@media print": {
								filter: "none",
								breakInside: "avoid",
								printColorAdjust: "exact",
							},
						}),
					],
					mix,
				)}
			>
				<div
					data-slot="boarding-pass-main"
					mix={[
						part,
						raw({
							overflow: "hidden",
							borderStartStartRadius: "1rem",
							borderStartEndRadius: "1rem",
							paddingBlockEnd: "1rem",
							mask: notchMask("bottom"),
							"@media print": { borderBlockEnd: "0" },
						}),
					]}
				>
					<header
						data-slot="boarding-pass-band"
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								paddingBlock: "0.75rem",
								paddingInline: "1.25rem",
								backgroundColor: "var(--ui-brand-bg-solid)",
								color: "var(--ui-brand-fg-on-solid)",
								fontWeight: "600",
								"& svg, & img": { blockSize: "1.25rem", inlineSize: "auto" },
							}),
						]}
					>
						{airline.mark === undefined ? null : (
							<span data-slot="boarding-pass-mark" mix={[raw({ display: "flex" })]}>
								{airline.mark}
							</span>
						)}
						<span data-slot="boarding-pass-airline">{airline.name}</span>
					</header>
					<div
						data-slot="boarding-pass-route"
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
								alignItems: "center",
								gap: "0.5rem",
								paddingBlock: "1.25rem 1rem",
								paddingInline: "1.25rem",
							}),
						]}
					>
						<BoardingPassPlace place={from} caption={labels.from} side="start" />
						<span
							aria-hidden="true"
							data-slot="boarding-pass-plane"
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "0.25rem",
									color: "var(--ui-brand-fg)",
									"&::before, &::after": {
										content: '""',
										inlineSize: "1rem",
										borderBlockStart: "1.5px dashed var(--ui-neutral-border-strong)",
									},
									"& svg": { rotate: "45deg", inlineSize: "1.25rem", blockSize: "1.25rem" },
									"&:dir(rtl) svg": { rotate: "-135deg" },
								}),
							]}
						>
							<PlaneIcon />
						</span>
						<BoardingPassPlace place={to} caption={labels.to} side="end" />
					</div>
					<dl
						data-slot="boarding-pass-fields"
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
								gap: "0.875rem 0.75rem",
								margin: "0",
								paddingInline: "1.25rem",
								[`@container ${CONTAINER_NAME} (inline-size < 17rem)`]: {
									gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
								},
							}),
						]}
					>
						<BoardingPassField caption={labels.passenger} field="passenger" wide>
							{passenger}
						</BoardingPassField>
						<BoardingPassField caption={labels.flight} field="flight">
							{flight}
						</BoardingPassField>
						<BoardingPassField caption={labels.date} field="date">
							{date}
						</BoardingPassField>
						<BoardingPassField caption={labels.boards} field="boards">
							{boards}
						</BoardingPassField>
						<BoardingPassField caption={labels.gate} field="gate" large>
							{gate}
						</BoardingPassField>
						<BoardingPassField caption={labels.seat} field="seat" large>
							{seat}
						</BoardingPassField>
						<BoardingPassField caption={labels.zone} field="zone" large>
							{zone}
						</BoardingPassField>
						<BoardingPassField caption={labels.cabin} field="cabin">
							{cabin}
						</BoardingPassField>
						<BoardingPassField caption={labels.confirmation} field="confirmation">
							{confirmation}
						</BoardingPassField>
					</dl>
				</div>
				<div
					data-slot="boarding-pass-stub"
					mix={[
						part,
						raw({
							display: "grid",
							justifyItems: "center",
							gap: "1rem",
							paddingBlockEnd: "1.25rem",
							borderEndStartRadius: "1rem",
							borderEndEndRadius: "1rem",
							mask: notchMask("top"),
							"@media print": { borderBlockStartStyle: "dashed" },
						}),
					]}
				>
					<div
						aria-hidden="true"
						data-slot="boarding-pass-tear"
						mix={[
							raw({
								justifySelf: "stretch",
								marginInline: `calc(${NOTCH} + 0.375rem)`,
								borderBlockStart: "2px dashed var(--ui-neutral-border)",
								"@media print": { display: "none" },
							}),
						]}
					/>
					<PassCode code={code} label={labels.code} mix={[raw({ inlineSize: "60%" })]} />
				</div>
			</article>
		);
	};
}

/** Props of {@link BoardingPassPlace}. */
interface BoardingPassPlaceProps {
	place: BoardingPass.Place;
	/** Read before the code, such as "From"; visually hidden. */
	caption?: string;
	side: "start" | "end";
}

/** One end of the route: the airport code set large, the city and the time beneath it. */
function BoardingPassPlace(handle: Handle<BoardingPassPlaceProps>) {
	return () => {
		let { place, caption, side } = handle.props;
		return (
			<p
				data-slot={side === "start" ? "boarding-pass-from" : "boarding-pass-to"}
				mix={[
					raw({
						display: "grid",
						margin: "0",
						minInlineSize: "0",
						textAlign: side,
						lineHeight: "1.2",
					}),
				]}
			>
				{caption === undefined ? null : <span mix={[visuallyHidden()]}>{`${caption} `}</span>}
				<span
					data-slot="boarding-pass-code"
					mix={[
						raw({
							fontSize: "2.25rem",
							fontWeight: "700",
							letterSpacing: "0.02em",
							lineHeight: "1",
							fontVariantNumeric: "tabular-nums",
						}),
					]}
				>
					{place.code}
				</span>
				<span
					mix={[
						raw({
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
							fontSize: "0.75rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					{place.city}
				</span>
				<span mix={[raw({ fontSize: "0.875rem", fontWeight: "600" })]}>{place.time}</span>
			</p>
		);
	};
}

/** Props of {@link BoardingPassField}. */
interface BoardingPassFieldProps {
	caption: RemixNode;
	/** Written to `data-field`, so a test or a script finds the field by name. */
	field: string;
	/** Spans the whole row, for the passenger's name. */
	wide?: boolean;
	/** Sets the value a step larger, for what a traveller scans for at the gate. */
	large?: boolean;
	children?: RemixNode;
}

/** One detail of the pass: a small caption over its value, as a `<dt>`/`<dd>` pair. */
function BoardingPassField(handle: Handle<BoardingPassFieldProps>) {
	return () => {
		let { caption, field, wide, large, children } = handle.props;
		return (
			<div
				data-field={field}
				mix={[raw({ minInlineSize: "0", gridColumn: wide ? "1 / -1" : undefined })]}
			>
				<dt
					mix={[
						raw({
							fontSize: "0.625rem",
							fontWeight: "600",
							letterSpacing: "0.06em",
							textTransform: "uppercase",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					{caption}
				</dt>
				<dd
					mix={[
						raw({
							margin: "0",
							overflowWrap: "anywhere",
							fontSize: large ? "1.25rem" : "0.9375rem",
							fontWeight: large ? "700" : "600",
							fontVariantNumeric: "tabular-nums",
							lineHeight: "1.25",
						}),
					]}
				>
					{children}
				</dd>
			</div>
		);
	};
}
