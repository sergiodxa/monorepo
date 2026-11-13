/**
 * Finding and getting into the bakery: a street map drawn in SVG (park, river, the bus stop,
 * the walk from it, the car park behind the shop) beside directions for each way of
 * arriving, then the access and parking details a visitor checks before setting out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { BikeIcon, BusIcon, CarIcon, FootprintsIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { dark } from "@sdxc/u/responsive";
import { CheckList, CheckRow, LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { BERRY, BUTTER, CREAM, INK, SAGE } from "~/resources/views/demos/bakery/art";
import { renderNearView } from "~/resources/views/demos/near-view";

/** The map's colours as custom properties, re-pointed for dark mode on the map's wrapper. */
const MAP_LIGHT = {
	"--map-land": "oklch(0.95 0.03 85)",
	"--map-block": "oklch(0.9 0.035 75)",
	"--map-road": "white",
	"--map-edge": "oklch(0.82 0.03 70)",
	"--map-park": "oklch(0.86 0.07 145)",
	"--map-water": "oklch(0.85 0.06 230)",
	"--map-label": "oklch(0.35 0.03 50)",
};

/** The same map at night: cocoa land, unlit roads, the park and river darkened to match. */
const MAP_DARK = {
	"--map-land": "oklch(0.24 0.02 50)",
	"--map-block": "oklch(0.29 0.022 50)",
	"--map-road": "oklch(0.38 0.02 55)",
	"--map-edge": "oklch(0.2 0.02 50)",
	"--map-park": "oklch(0.36 0.05 145)",
	"--map-water": "oklch(0.36 0.05 230)",
	"--map-label": "oklch(0.86 0.03 75)",
};

/** Each way of arriving, with its icon and the directions in plain words. */
const DIRECTIONS = [
	{
		icon: BusIcon,
		title: "By bus",
		body: "Take Route 4 to the Alder & 5th stop. Walk two minutes west, past the library, to the striped awning on the corner.",
	},
	{
		icon: FootprintsIcon,
		title: "On foot from the park",
		body: "Leave Linden Park by the Pine Street gate and walk down 3rd Avenue. We're on your right at the bottom.",
	},
	{
		icon: BikeIcon,
		title: "By bike",
		body: "Racks for eight bikes under the awning, out of the rain. The river path comes out at the end of Mill Lane.",
	},
	{
		icon: CarIcon,
		title: "By car",
		body: "Turn into the lane off 3rd Avenue just past us. Six free spaces behind the shop, two of them wide accessible bays.",
	},
] as const;

/**
 * The visit band: the address and the map on the left, the four ways of arriving on the
 * right.
 *
 * @returns The render function producing the band.
 */
export function Visit() {
	return () => (
		<LandingSection id="visit" mix={[renderNearView(820, 1500)]}>
			<LandingHeader
				eyebrow="Find us"
				description={
					<>
						<strong>14 Alder Street, Millbrook</strong>, on the corner of 3rd Avenue, across from
						the library and a short walk from Linden Park.
					</>
				}
			>
				The corner with the striped awning
			</LandingHeader>
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))",
						gap: "clamp(1.5rem, 5cqi, 3.5rem)",
						alignItems: "center",
					}),
				]}
			>
				<StreetMap />
				<ul
					mix={[
						raw({
							listStyle: "none",
							margin: "0",
							padding: "0",
							display: "flex",
							flexDirection: "column",
							gap: "1.5rem",
						}),
					]}
				>
					{DIRECTIONS.map((way) => (
						<li
							key={way.title}
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "2.75rem 1fr",
									gap: "1rem",
									alignItems: "start",
								}),
							]}
						>
							<span
								aria-hidden="true"
								mix={[
									raw({
										display: "grid",
										placeItems: "center",
										inlineSize: "2.75rem",
										blockSize: "2.75rem",
										borderRadius: "0.875rem",
										backgroundColor: "var(--ui-brand-bg-tint-hover)",
										color: "var(--ui-brand-fg)",
									}),
								]}
							>
								<way.icon size={22} />
							</span>
							<span mix={[raw({ display: "flex", flexDirection: "column", gap: "0.25rem" })]}>
								<span
									mix={[
										raw({
											fontFamily: "var(--ui-font-display)",
											fontWeight: "700",
											fontSize: "1.25rem",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
									]}
								>
									{way.title}
								</span>
								<span mix={[raw({ lineHeight: "1.5", color: "var(--ui-neutral-fg)" })]}>
									{way.body}
								</span>
							</span>
						</li>
					))}
				</ul>
			</div>
		</LandingSection>
	);
}

/**
 * A street label laid along a road.
 *
 * @param handle Runtime handle carrying the position, rotation and text.
 * @returns The render function producing the label.
 */
function StreetName(handle: Handle<{ x: number; y: number; rotate?: number; children: string }>) {
	return () => {
		let { children, rotate, x, y } = handle.props;
		return (
			<text
				x={x}
				y={y}
				transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
				text-anchor="middle"
				font-size="13"
				font-weight="700"
				fill="var(--map-label)"
				mix={[raw({ fontFamily: "var(--ui-font-sans)", letterSpacing: "0.04em" })]}
			>
				{children}
			</text>
		);
	};
}

/**
 * The neighbourhood as a hand-drawn map: Alder Street and 3rd Avenue crossing at the bakery,
 * the park to the north-west, the river to the south-east, the bus stop and the dashed walk
 * from it, the car park behind the shop, and a key. It is one image with a full description.
 *
 * @returns The render function producing the map.
 */
function StreetMap() {
	return () => (
		<div
			data-slot="street-map"
			mix={[
				raw({
					...MAP_LIGHT,
					borderRadius: "var(--ui-landing-radius-frame)",
					overflow: "hidden",
					boxShadow: `0 0 0 3px ${INK}, 0 6px 0 3px ${INK}`,
					backgroundColor: "var(--map-land)",
				}),
				dark(raw({ ...MAP_DARK, boxShadow: "0 0 0 2px var(--ui-landing-hairline)" })),
			]}
		>
			<svg
				viewBox="0 0 640 460"
				role="img"
				aria-label="Map of the streets around Hollyhock Bakery. The bakery is on the north-west corner of Alder Street and 3rd Avenue. The Route 4 bus stop is two blocks east on Alder Street, a two-minute walk. Linden Park is two blocks north-west, the river runs to the south-east, and the car park is behind the bakery, reached by a lane off 3rd Avenue."
				mix={[raw({ display: "block", inlineSize: "100%", blockSize: "auto" })]}
			>
				<rect width="640" height="460" fill="var(--map-land)" />
				<path d="M0 0h250v150H0Z" fill="var(--map-park)" />
				{[
					[36, 36],
					[160, 32],
					[214, 58],
					[206, 112],
					[44, 118],
					[100, 126],
				].map(([x, y]) => (
					<circle
						key={`${x}-${y}`}
						cx={x}
						cy={y}
						r="11"
						fill={SAGE}
						stroke={INK}
						stroke-width="2"
						opacity="0.9"
					/>
				))}
				<text
					x="125"
					y="80"
					text-anchor="middle"
					font-size="15"
					font-weight="800"
					fill="var(--map-label)"
					mix={[raw({ fontFamily: "var(--ui-font-display)" })]}
				>
					Linden Park
				</text>
				<path d="M470 460c20-80 80-130 170-150v150Z" fill="var(--map-water)" />
				<path
					d="M470 460c20-80 80-130 170-150"
					fill="none"
					stroke="var(--map-edge)"
					stroke-width="3"
				/>
				<text
					x="590"
					y="420"
					text-anchor="middle"
					font-size="13"
					font-style="italic"
					fill="var(--map-label)"
					mix={[raw({ fontFamily: "var(--ui-font-sans)" })]}
				>
					Mill River
				</text>
				{[
					[280, 0, 170, 140],
					[490, 0, 150, 140],
					[0, 190, 100, 140],
					[180, 290, 170, 170],
					[400, 290, 70, 100],
					[0, 380, 100, 80],
				].map(([x, y, w, h]) => (
					<rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="8" fill="var(--map-block)" />
				))}
				<rect x="490" y="290" width="150" height="40" rx="8" fill="var(--map-block)" />
				<text
					x="560"
					y="315"
					text-anchor="middle"
					font-size="12"
					fill="var(--map-label)"
					mix={[raw({ fontFamily: "var(--ui-font-sans)" })]}
				>
					Library
				</text>
				<g fill="var(--map-road)" stroke="var(--map-edge)" stroke-width="2">
					<rect x="-4" y="150" width="648" height="36" />
					<rect x="-4" y="250" width="648" height="40" />
					<rect x="100" y="150" width="36" height="314" />
					<rect x="350" y="-4" width="40" height="468" />
				</g>
				<rect x="102" y="152" width="32" height="32" fill="var(--map-road)" />
				<rect x="102" y="252" width="32" height="36" fill="var(--map-road)" />
				<rect x="352" y="152" width="36" height="32" fill="var(--map-road)" />
				<rect x="352" y="252" width="36" height="36" fill="var(--map-road)" />
				<StreetName x={250} y={274}>
					ALDER STREET
				</StreetName>
				<StreetName x={530} y={173}>
					PINE STREET
				</StreetName>
				<StreetName x={374} y={390} rotate={-90}>
					3RD AVENUE
				</StreetName>
				<StreetName x={124} y={360} rotate={-90}>
					MILL LANE
				</StreetName>
				<rect x="200" y="186" width="150" height="64" rx="6" fill="var(--map-block)" />
				<g data-slot="car-park">
					<rect
						x="206"
						y="192"
						width="88"
						height="40"
						rx="4"
						fill="var(--map-road)"
						stroke={INK}
						stroke-width="2"
						stroke-dasharray="4 3"
					/>
					{[0, 1, 2, 3, 4, 5].map((index) => (
						<path
							key={index}
							d={`M${220 + index * 13} 194v14`}
							stroke="var(--map-edge)"
							stroke-width="2"
						/>
					))}
					<rect x="234" y="214" width="20" height="14" rx="3" fill="oklch(0.6 0.12 250)" />
					<text
						x="244"
						y="225"
						text-anchor="middle"
						font-size="11"
						font-weight="800"
						fill="white"
						mix={[raw({ fontFamily: "var(--ui-font-sans)" })]}
					>
						P
					</text>
					<path d="M294 197h56" stroke="var(--map-road)" stroke-width="8" />
				</g>
				<g data-slot="bakery">
					<rect
						x="300"
						y="206"
						width="46"
						height="40"
						rx="5"
						fill={BUTTER}
						stroke={INK}
						stroke-width="3"
					/>
					<path d="M300 236h46" stroke={INK} stroke-width="2" />
					{[0, 1, 2, 3].map((index) => (
						<rect
							key={index}
							x={300 + index * 11.5}
							y="236"
							width="5.75"
							height="10"
							fill={BERRY}
						/>
					))}
				</g>
				<path
					d="M534 266H410c-10 0-14-6-20-14l-10-6h-30"
					fill="none"
					stroke={BERRY}
					stroke-width="4"
					stroke-dasharray="2 9"
					stroke-linecap="round"
				/>
				<g data-slot="bus-stop">
					<circle cx="548" cy="268" r="14" fill={CREAM} stroke={INK} stroke-width="3" />
					<text
						x="548"
						y="273"
						text-anchor="middle"
						font-size="13"
						font-weight="800"
						fill={INK}
						mix={[raw({ fontFamily: "var(--ui-font-sans)" })]}
					>
						4
					</text>
					<text
						x="548"
						y="246"
						text-anchor="middle"
						font-size="12"
						font-weight="700"
						fill="var(--map-label)"
						mix={[raw({ fontFamily: "var(--ui-font-sans)" })]}
					>
						Bus stop
					</text>
				</g>
				<g data-slot="pin">
					<path
						d="M323 112c-16 0-28 12-28 27 0 20 28 44 28 44s28-24 28-44c0-15-12-27-28-27Z"
						fill={BERRY}
						stroke={INK}
						stroke-width="3"
					/>
					<circle cx="323" cy="139" r="9" fill={CREAM} stroke={INK} stroke-width="2" />
					<rect
						x="248"
						y="62"
						width="150"
						height="34"
						rx="10"
						fill={CREAM}
						stroke={INK}
						stroke-width="3"
					/>
					<text
						x="323"
						y="85"
						text-anchor="middle"
						font-size="17"
						font-weight="800"
						fill={INK}
						mix={[raw({ fontFamily: "var(--ui-font-display)" })]}
					>
						Hollyhock
					</text>
				</g>
				<g transform="translate(596 52)">
					<circle r="22" fill={CREAM} stroke={INK} stroke-width="3" />
					<path
						d="M0-14 7 6 0 2-7 6Z"
						fill={BERRY}
						stroke={INK}
						stroke-width="2"
						stroke-linejoin="round"
					/>
					<text
						y="18"
						text-anchor="middle"
						font-size="10"
						font-weight="800"
						fill={INK}
						mix={[raw({ fontFamily: "var(--ui-font-sans)" })]}
					>
						N
					</text>
				</g>
				<g transform="translate(16 420)" mix={[raw({ fontFamily: "var(--ui-font-sans)" })]}>
					<rect width="214" height="28" rx="8" fill={CREAM} stroke={INK} stroke-width="2" />
					<path
						d="M12 14h26"
						stroke={BERRY}
						stroke-width="4"
						stroke-dasharray="2 7"
						stroke-linecap="round"
					/>
					<text x="46" y="19" font-size="12" font-weight="700" fill={INK}>
						2-minute walk from the bus
					</text>
				</g>
			</svg>
		</div>
	);
}

/** The details a wheelchair user, a parent with a pram or a driver checks before coming. */
const ACCESS = [
	"Step-free front door, 36 inches wide, with a push-button opener.",
	"Two tables at wheelchair height, and chairs with arms to push up from.",
	"An accessible toilet with grab rails, through the café.",
	"A large-print menu at the counter, and we're happy to read it out.",
	"A quiet hour on Tuesdays from 2 to 3 pm: music off, lights low.",
	"Assistance dogs welcome inside; every other dog gets water on the porch.",
] as const;

/** Parking and the back way in. */
const PARKING = [
	"Six free spaces behind the shop, reached by the lane off 3rd Avenue.",
	"Two of them are wide accessible bays, nearest the back door.",
	"A gentle ramp from the back door straight to the counter.",
	"Street parking on Alder is free after 6 pm and all day Sunday.",
	"Racks for eight bikes under the awning, out of the rain.",
] as const;

/**
 * The getting-in band: access inside the shop and parking outside it, as two cards of
 * checked facts, each with a small drawing of the door or the car park.
 *
 * @returns The render function producing the band.
 */
export function GettingIn() {
	return () => (
		<LandingSection id="getting-in" tone="tinted" mix={[renderNearView(640, 1250)]}>
			<LandingHeader
				eyebrow="Access and parking"
				description="Everything we could think of. If there's something we've missed, call us and we'll sort it before you arrive."
			>
				Easy to get in, easy to park
			</LandingHeader>
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))",
						gap: "1.5rem",
					}),
				]}
			>
				<InfoCard title="Getting in" drawing={<DoorDrawing />} items={ACCESS} />
				<InfoCard title="Parking" drawing={<ParkingDrawing />} items={PARKING} />
			</div>
		</LandingSection>
	);
}

namespace InfoCard {
	/** The card's title, its drawing and its checked facts. */
	export interface Props {
		title: string;
		drawing: RemixNode;
		items: readonly string[];
	}
}

/**
 * One card of facts: the drawing and title side by side, then the facts as a checked list.
 *
 * @param handle Runtime handle carrying the title, drawing and facts.
 * @returns The render function producing the card.
 */
function InfoCard(handle: Handle<InfoCard.Props>) {
	return () => {
		let { drawing, items, title } = handle.props;
		return (
			<div
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						gap: "1.25rem",
						padding: "1.5rem",
						borderRadius: "var(--ui-landing-card-radius-outer)",
						backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
						boxShadow: "var(--ui-shadow-surface)",
					}),
				]}
			>
				<div mix={[raw({ display: "flex", alignItems: "center", gap: "1rem" })]}>
					<span mix={[raw({ inlineSize: "4.5rem", flexShrink: "0" })]}>{drawing}</span>
					<span
						mix={[
							raw({
								fontFamily: "var(--ui-font-display)",
								fontWeight: "700",
								fontSize: "1.5rem",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{title}
					</span>
				</div>
				<CheckList>
					{items.map((item) => (
						<CheckRow key={item}>{item}</CheckRow>
					))}
				</CheckList>
			</div>
		);
	};
}

/**
 * The front door with its ramp and push button, the access card's picture.
 *
 * @returns The render function producing the drawing.
 */
function DoorDrawing() {
	return () => (
		<svg
			viewBox="0 0 80 80"
			aria-hidden="true"
			focusable="false"
			mix={[raw({ display: "block", inlineSize: "100%" })]}
		>
			<path d="M8 72h64" stroke={INK} stroke-width="3" stroke-linecap="round" />
			<path
				d="M4 72l16-6h40l16 6Z"
				fill={BUTTER}
				stroke={INK}
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<rect x="22" y="10" width="36" height="56" rx="3" fill={SAGE} stroke={INK} stroke-width="3" />
			<rect
				x="28"
				y="16"
				width="24"
				height="20"
				rx="2"
				fill={CREAM}
				stroke={INK}
				stroke-width="2"
			/>
			<circle cx="52" cy="44" r="2.5" fill={BUTTER} stroke={INK} stroke-width="1.5" />
			<rect
				x="62"
				y="34"
				width="10"
				height="12"
				rx="2"
				fill="oklch(0.6 0.12 250)"
				stroke={INK}
				stroke-width="2"
			/>
		</svg>
	);
}

/**
 * A parking sign beside a small car, the parking card's picture.
 *
 * @returns The render function producing the drawing.
 */
function ParkingDrawing() {
	return () => (
		<svg
			viewBox="0 0 80 80"
			aria-hidden="true"
			focusable="false"
			mix={[raw({ display: "block", inlineSize: "100%" })]}
		>
			<path d="M18 36v38" stroke={INK} stroke-width="3" />
			<rect
				x="4"
				y="6"
				width="28"
				height="30"
				rx="5"
				fill="oklch(0.6 0.12 250)"
				stroke={INK}
				stroke-width="3"
			/>
			<text
				x="18"
				y="29"
				text-anchor="middle"
				font-size="20"
				font-weight="800"
				fill="white"
				mix={[raw({ fontFamily: "var(--ui-font-sans)" })]}
			>
				P
			</text>
			<path
				d="M36 62v-8l6-12h24l6 12v8Z"
				fill={BERRY}
				stroke={INK}
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<path
				d="M44 44h20l3 8H41Z"
				fill={CREAM}
				stroke={INK}
				stroke-width="2"
				stroke-linejoin="round"
			/>
			<circle cx="44" cy="64" r="6" fill={INK} />
			<circle cx="64" cy="64" r="6" fill={INK} />
		</svg>
	);
}
