/**
 * The small app scenes Rooftree's bento leads each colour block with: a list ticked off
 * offline, a barcode landing on the list, a spoken item, a nudge near the shop, a child's
 * chores and the evening summary. Each is live markup on the page ground, cropped by the cell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	BellRingIcon,
	CheckIcon,
	CloudOffIcon,
	HouseIcon,
	LockIcon,
	MapPinIcon,
	MicIcon,
	MoonIcon,
	RepeatIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { dark } from "@sdxc/u/responsive";
import { is, p } from "@sdxc/u/size";
import { leading, tabularNums, text, weight } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";

import type { Person } from "~/resources/views/demos/app/phone";

import { Initials, Row } from "~/resources/views/demos/app/phone";

/** Bar heights of the voice scene's waveform, in tenths of its height, left to right. */
const WAVEFORM = [3, 6, 9, 5, 8, 10, 6, 4, 7, 9, 5, 3, 6, 8, 4, 2] as const;

/** Bar widths of the scan scene's barcode, in units, alternating bar and gap. */
const BARCODE = [2, 1, 1, 2, 3, 1, 1, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 1, 1, 2] as const;

/** The camera's four corner brackets, one horizontal and one vertical stroke per corner. */
const VIEWFINDER_CORNERS = Array.from(
	{ length: 8 },
	() => "linear-gradient(oklch(0.92 0.12 92), oklch(0.92 0.12 92))",
).join(", ");

/** The barcode's width in units, the sum of every bar and gap. */
const BARCODE_WIDTH = BARCODE.reduce((sum, width) => sum + width, 0);

namespace Scene {
	/** Props of the frame every scene sits in. */
	export interface Props {
		/** What the scene shows, read in place of the markup by assistive technology. */
		label: string;
		/** The scene's sheet content. */
		children: RemixNode;
	}
}

/**
 * Crops one app sheet into the cell: the sheet starts below a margin and runs past the
 * media's lower edge, so the cell's fade reads as the rest of the screen. The whole scene
 * is one labelled image, since its rows are a picture of the app and act on nothing.
 *
 * @param handle Runtime handle carrying the label and sheet content.
 * @returns The render function producing the scene.
 */
function Scene(handle: Handle<Scene.Props>) {
	return () => (
		<div
			role="img"
			aria-label={handle.props.label}
			mix={[
				vstack({ gap: 0, align: "center" }),
				p(6, 6, 0, 6),
				raw({ blockSize: "100%", boxSizing: "border-box" }),
			]}
		>
			<div
				mix={[
					vstack({ gap: 2.5, align: "stretch" }),
					is("min(100%, 17rem)"),
					p(3.5),
					text("xs"),
					raw({
						flex: "1",
						boxSizing: "border-box",
						borderRadius: "1.25rem 1.25rem 0 0",
						color: "var(--ui-neutral-fg-emphasis)",
						backgroundColor: "var(--ui-bg)",
						boxShadow: "0 10px 30px -12px oklch(0.3 0.1 290 / 0.35)",
					}),
				]}
			>
				{handle.props.children}
			</div>
		</div>
	);
}

namespace Chip {
	/** Props of a tinted status chip. */
	export interface Props {
		/** The hue of the colour block the chip sits on. */
		hue: number;
		/** The chip's icon and words. */
		children: RemixNode;
	}
}

/**
 * A small status chip in its colour block's hue: the deep ink of that hue on a light wash,
 * or the pale ink on a dark one, both above 4.5:1 on the page ground.
 *
 * @param handle Runtime handle carrying the hue and content.
 * @returns The render function producing the chip.
 */
function Chip(handle: Handle<Chip.Props>) {
	return () => {
		let { children, hue } = handle.props;
		return (
			<span
				mix={[
					hstack({ gap: 1, align: "center" }),
					weight("semibold"),
					raw({
						flexShrink: "0",
						paddingBlock: "0.125rem",
						paddingInline: "0.5rem",
						borderRadius: "9999px",
						fontSize: "0.6875rem",
						color: `oklch(0.42 0.13 ${hue})`,
						backgroundColor: `oklch(0.95 0.04 ${hue})`,
					}),
					dark(
						raw({
							color: `oklch(0.86 0.1 ${hue})`,
							backgroundColor: `oklch(0.3 0.045 ${hue})`,
						}),
					),
				]}
			>
				{children}
			</span>
		);
	};
}

namespace SheetHeader {
	/** Props of a sheet's heading row. */
	export interface Props {
		/** The list or screen name. */
		title: RemixNode;
		/** A trailing chip or note. */
		trailing?: RemixNode;
	}
}

/**
 * The heading row a sheet opens with: the list's name and a trailing status.
 *
 * @param handle Runtime handle carrying the title and trailing status.
 * @returns The render function producing the row.
 */
function SheetHeader(handle: Handle<SheetHeader.Props>) {
	return () => (
		<span mix={[hstack({ gap: 2, align: "center", justify: "between" })]}>
			<span mix={[text("sm"), weight("bold"), leading("tight")]}>{handle.props.title}</span>
			{handle.props.trailing}
		</span>
	);
}

/**
 * Works without signal: the grocery list mid-shop with two ticks made offline and an
 * item still to buy, the chip saying the ticks wait for signal.
 *
 * @returns The render function producing the scene.
 */
export function OfflineScene() {
	return () => (
		<Scene label="Rooftree's grocery list offline: oat milk and lemons ticked off, rice still to buy, two ticks waiting to sync.">
			<SheetHeader
				title="Groceries"
				trailing={
					<Chip hue={292}>
						<CloudOffIcon size={11} />
						Offline · 2 to sync
					</Chip>
				}
			/>
			<Row done person="maya">
				Oat milk
			</Row>
			<Row done note="2 · unwaxed" person="maya">
				Lemons
			</Row>
			<Row person="jonah">Basmati rice</Row>
		</Scene>
	);
}

/**
 * Scan to restock: the camera framing an empty box's barcode, and the item it named
 * already on the list.
 *
 * @returns The render function producing the scene.
 */
export function ScanScene() {
	return () => (
		<Scene label="Rooftree scanning an empty box's barcode and adding Rolled oats, 1 kg, to the grocery list.">
			<div
				mix={[
					raw({
						display: "grid",
						placeItems: "center",
						paddingBlock: "0.875rem",
						borderRadius: "0.875rem",
						backgroundColor: "oklch(0.25 0.03 92)",
						paddingInline: "0.875rem",
						backgroundImage: VIEWFINDER_CORNERS,
						backgroundPosition:
							"top left, top left, top right, top right, bottom left, bottom left, bottom right, bottom right",
						backgroundSize:
							"1rem 2px, 2px 1rem, 1rem 2px, 2px 1rem, 1rem 2px, 2px 1rem, 1rem 2px, 2px 1rem",
						backgroundRepeat: "no-repeat",
						backgroundOrigin: "content-box",
					}),
				]}
			>
				<svg
					viewBox={`0 0 ${BARCODE_WIDTH} 20`}
					width="128"
					height="40"
					preserveAspectRatio="none"
					aria-hidden="true"
					mix={[
						raw({
							padding: "0.375rem",
							borderRadius: "0.25rem",
							backgroundColor: "white",
						}),
					]}
				>
					{barcodeBars()}
				</svg>
			</div>
			<span mix={[hstack({ gap: 2, align: "center" })]}>
				<span
					mix={[
						raw({
							display: "inline-grid",
							placeItems: "center",
							flexShrink: "0",
							inlineSize: "1.5rem",
							blockSize: "1.5rem",
							borderRadius: "9999px",
							color: "white",
							backgroundColor: "var(--ui-brand-bg-solid)",
						}),
					]}
				>
					<CheckIcon size={12} strokeWidth={3} />
				</span>
				<span mix={[vstack({ gap: 0, align: "start" }), raw({ flex: "1", minInlineSize: "0" })]}>
					<span mix={[weight("semibold")]}>Rolled oats, 1 kg</span>
					<span mix={[fg("neutral.muted"), raw({ fontSize: "0.6875rem" })]}>
						Added to Groceries
					</span>
				</span>
			</span>
		</Scene>
	);
}

/**
 * Lays the barcode's bars out from {@link BARCODE}, filling every other run so bars and
 * gaps alternate from the left edge.
 *
 * @returns One `<rect>` per bar.
 */
function barcodeBars() {
	let x = 0;
	let bars: RemixNode[] = [];
	for (let [index, width] of BARCODE.entries()) {
		if (index % 2 === 0) {
			bars.push(<rect key={index} x={x} y="0" width={width} height="20" fill="black" />);
		}
		x += width;
	}
	return bars;
}

/**
 * Add by voice: the words as heard beside the mic, and the two rows they became.
 *
 * @returns The render function producing the scene.
 */
export function VoiceScene() {
	return () => (
		<Scene label="Rooftree hearing “oat milk and two lemons” and adding both as new rows on the grocery list.">
			<span mix={[hstack({ gap: 2.5, align: "center" })]}>
				<span
					mix={[
						raw({
							display: "inline-grid",
							placeItems: "center",
							flexShrink: "0",
							inlineSize: "2rem",
							blockSize: "2rem",
							borderRadius: "9999px",
							color: "white",
							backgroundColor: "var(--ui-brand-bg-solid)",
							boxShadow: "0 0 0 4px color-mix(in oklch, var(--ui-brand-bg-solid) 22%, transparent)",
						}),
					]}
				>
					<MicIcon size={15} />
				</span>
				<span mix={[vstack({ gap: 1, align: "stretch" }), raw({ flex: "1", minInlineSize: "0" })]}>
					<svg
						viewBox={`0 0 ${WAVEFORM.length * 3} 10`}
						height="14"
						preserveAspectRatio="none"
						aria-hidden="true"
						mix={[raw({ inlineSize: "100%", color: "var(--ui-brand-fg)" })]}
					>
						{WAVEFORM.map((height, index) => (
							<rect
								key={index}
								x={index * 3}
								y={(10 - height) / 2}
								width="1.6"
								height={height}
								rx="0.8"
								fill="currentColor"
							/>
						))}
					</svg>
					<span mix={[weight("medium"), raw({ fontStyle: "italic" })]}>
						“oat milk and two lemons”
					</span>
				</span>
			</span>
			<Row note="Just added · by voice">Oat milk</Row>
			<Row note="2 · just added">Lemons</Row>
		</Scene>
	);
}

/**
 * Reminders by place: the lock-screen nudge as the phone passes the shop, over the street
 * it fired on.
 *
 * @returns The render function producing the scene.
 */
export function PlaceScene() {
	return () => (
		<Scene label="A Rooftree notification near Fresh Corner listing three groceries still to buy, over a map with the shop pinned.">
			<span mix={[hstack({ gap: 2, align: "center" })]}>
				<span
					mix={[
						raw({
							display: "inline-grid",
							placeItems: "center",
							flexShrink: "0",
							inlineSize: "1.25rem",
							blockSize: "1.25rem",
							borderRadius: "0.375rem",
							color: "white",
							backgroundColor: "var(--ui-brand-bg-solid)",
						}),
					]}
				>
					<HouseIcon size={11} />
				</span>
				<span mix={[raw({ flex: "1" }), weight("semibold"), fg("neutral.muted")]}>Rooftree</span>
				<span mix={[fg("neutral.muted")]}>now</span>
			</span>
			<span mix={[vstack({ gap: 0.5, align: "start" })]}>
				<span mix={[text("sm"), weight("bold"), leading("tight")]}>
					You're passing Fresh Corner
				</span>
				<span mix={[leading("snug")]}>
					Lemons, baby spinach and parmesan are still on the list.
				</span>
			</span>
			<span mix={[hstack({ gap: 0, align: "center" })]}>
				<Chip hue={15}>
					<MapPinIcon size={11} />
					Within 150 m
				</Chip>
			</span>
			<StreetMap />
		</Scene>
	);
}

/**
 * The place scene's street: two crossing roads with the shop pinned on the corner, drawn
 * in the page's hairline so it recedes behind the nudge.
 *
 * @returns The render function producing the map.
 */
function StreetMap() {
	return () => (
		<svg
			viewBox="0 0 200 60"
			aria-hidden="true"
			mix={[
				raw({
					display: "block",
					inlineSize: "100%",
					blockSize: "auto",
					borderRadius: "0.75rem",
					backgroundColor: "color-mix(in oklch, var(--ui-neutral-fg-emphasis) 5%, var(--ui-bg))",
				}),
			]}
		>
			<path
				d="M0 38 H200 M120 0 V60 M20 0 L70 60"
				stroke="var(--ui-marketing-hairline, currentColor)"
				stroke-width="7"
				fill="none"
			/>
			<circle cx="120" cy="38" r="12" fill="oklch(0.65 0.18 15 / 0.2)" />
			<circle cx="120" cy="38" r="5" fill="oklch(0.6 0.2 15)" />
		</svg>
	);
}

/**
 * Accounts for kids: Leo's own view of his chores, one repeating every morning, with the
 * note that only a grown-up removes anything.
 *
 * @returns The render function producing the scene.
 */
export function KidsScene() {
	return () => (
		<Scene label="Leo's kid account in Rooftree: feed the cat every morning, tidy his room done, and a note that only grown-ups can delete.">
			<SheetHeader
				title={
					<span mix={[hstack({ gap: 2, align: "center" })]}>
						<Initials person="leo" size={1.5} />
						Leo's chores
					</span>
				}
				trailing={
					<Badge color="brand" variant="secondary">
						Kid account
					</Badge>
				}
			/>
			<Row
				note={
					<span mix={[hstack({ gap: 1, align: "center" })]}>
						<RepeatIcon size={10} />
						Every morning
					</span>
				}
			>
				Feed the cat
			</Row>
			<Row done>Tidy your room</Row>
			<span mix={[hstack({ gap: 1.5, align: "center" }), fg("neutral.muted")]}>
				<LockIcon size={11} />
				Only grown-ups can delete
			</span>
		</Scene>
	);
}

/** Who ticked what today, in the order the evening summary credits them. */
const TODAY: readonly Person[] = ["maya", "jonah", "ari", "leo"];

/**
 * Quiet by default: the one evening summary crediting the whole household, and the
 * single ping that still comes through because the chore is yours.
 *
 * @returns The render function producing the scene.
 */
export function QuietScene() {
	return () => (
		<Scene label="Rooftree's evening summary: 14 items ticked and 3 chores done by the household today, and one reminder that watering the plants is yours.">
			<SheetHeader
				title="Evening summary"
				trailing={
					<span mix={[hstack({ gap: 1, align: "center" }), fg("neutral.muted"), tabularNums()]}>
						<MoonIcon size={11} />
						8:00 PM
					</span>
				}
			/>
			<span mix={[hstack({ gap: 2, align: "center" })]}>
				<span mix={[hstack({ gap: 0, align: "center" }), raw({ paddingInlineStart: "0.3rem" })]}>
					{TODAY.map((person) => (
						<span key={person} mix={[raw({ marginInlineStart: "-0.3rem" })]}>
							<Initials person={person} size={1.375} />
						</span>
					))}
				</span>
				<span mix={[leading("snug")]}>14 items ticked, 3 chores done</span>
			</span>
			<span
				mix={[
					hstack({ gap: 2, align: "center" }),
					raw({
						padding: "0.5rem",
						borderRadius: "0.75rem",
						backgroundColor: "color-mix(in oklch, var(--ui-neutral-fg-emphasis) 5%, var(--ui-bg))",
					}),
				]}
			>
				<Chip hue={55}>
					<BellRingIcon size={11} />
					Yours
				</Chip>
				<span mix={[raw({ flex: "1", minInlineSize: "0" }), weight("medium"), leading("snug")]}>
					Water the plants by 9
				</span>
				<Initials person="ari" size={1.125} />
			</span>
		</Scene>
	);
}
