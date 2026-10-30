/**
 * The phone every screen of the page is shown in: a device `ProductFrame` with an ink
 * bezel, a status bar, the camera pill and Rooftree's tab bar, plus the small parts the
 * screens are built from (cards, list rows, people). Screens fill it as live markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	CalendarDaysIcon,
	CheckIcon,
	HouseIcon,
	ListChecksIcon,
	RepeatIcon,
	UtensilsIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { absolute, hstack, relative, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { leading, tabularNums, text, truncate, weight } from "@sdxc/u/typography";
import { ProductFrame } from "@sdxc/ui/patterns";

/** The bezel ink, the same near-black in both schemes, like the hardware. */
const BEZEL = "oklch(0.17 0.004 70)";

/** The screen behind the cards: the page ground a step darker, in either scheme. */
const SCREEN = "color-mix(in oklch, var(--ui-bg) 96%, black)";

/**
 * The glow a staged phone stands in: ember light from above and ruled rings around the
 * device, drawn as gradients so the panel needs no image.
 */
const STAGE_GLOW = [
	"radial-gradient(ellipse 70% 55% at 50% 0%, color-mix(in oklch, var(--ui-brand-bg-solid) 22%, transparent), transparent 70%)",
	"repeating-radial-gradient(circle at 50% 45%, transparent 0 5.5rem, color-mix(in oklch, var(--ui-neutral-fg-emphasis) 6%, transparent) 5.5rem calc(5.5rem + 1px))",
].join(", ");

/** Rooftree's tabs, in bar order; a screen names the one it shows as active. */
const TABS = [
	{ id: "home", label: "Home", icon: HouseIcon },
	{ id: "lists", label: "Lists", icon: ListChecksIcon },
	{ id: "chores", label: "Chores", icon: RepeatIcon },
	{ id: "calendar", label: "Calendar", icon: CalendarDaysIcon },
	{ id: "meals", label: "Meals", icon: UtensilsIcon },
] as const;

/**
 * The household the screens show, each with a hue their initials and calendar entries
 * are tinted with, so one person reads as one colour on every screen.
 */
export const PEOPLE = {
	maya: { name: "Maya", initials: "M", hue: 38 },
	jonah: { name: "Jonah", initials: "J", hue: 250 },
	ari: { name: "Ari", initials: "A", hue: 150 },
	leo: { name: "Leo", initials: "L", hue: 300 },
} as const;

/** One member of {@link PEOPLE}. */
export type Person = keyof typeof PEOPLE;

namespace Phone {
	/** Props of the phone mock. */
	export interface Props {
		/** The tab the bar marks active. */
		tab: (typeof TABS)[number]["id"];
		/** What the screen shows, read in place of the markup by assistive technology. */
		label: string;
		/** Caps the phone's width; it shrinks with its column below that. */
		maxWidth?: string;
		/** Sets the phone on a tinted panel with a brand glow, for media beside a rail. */
		staged?: boolean;
		/** The screen's content, between the status bar and the tab bar. */
		children: RemixNode;
	}
}

/**
 * A phone at 9:19.5 holding one live screen. The whole device is one labelled image to
 * assistive technology, since its rows are a picture of the app and act on nothing.
 *
 * @param handle Runtime handle carrying the active tab, label and screen.
 * @returns The render function producing the device.
 */
export function Phone(handle: Handle<Phone.Props>) {
	return () => {
		let { children, label, maxWidth, staged, tab } = handle.props;
		let device = (
			<ProductFrame
				variant="device"
				role="img"
				aria-label={label}
				mix={[
					raw({ inlineSize: "100%", maxInlineSize: maxWidth ?? "18.5rem", marginInline: "auto" }),
				]}
			>
				<div
					mix={[
						raw({
							backgroundColor: BEZEL,
							padding: "0.5rem",
							borderRadius: "inherit",
							boxShadow: "inset 0 0 0 1.5px rgb(255 255 255 / 0.14)",
						}),
					]}
				>
					<div
						mix={[
							relative(),
							overflow("hidden"),
							vstack({ gap: 0, align: "stretch" }),
							text("xs"),
							raw({
								aspectRatio: "9 / 19.5",
								borderRadius: "13% / 6%",
								backgroundColor: SCREEN,
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						<StatusBar />
						<div
							mix={[
								vstack({ gap: 3, align: "stretch" }),
								overflow("hidden"),
								raw({ flex: "1", paddingInline: "0.875rem", paddingBlockStart: "0.5rem" }),
							]}
						>
							{children}
						</div>
						<TabBar tab={tab} />
					</div>
				</div>
			</ProductFrame>
		);

		if (!staged) return device;

		return (
			<div
				mix={[
					raw({
						paddingBlock: "clamp(1.5rem, 5cqi, 3rem)",
						paddingInline: "clamp(1rem, 6cqi, 4rem)",
						borderRadius: "1.5rem",
						backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 7%, var(--ui-bg))",
						backgroundImage: STAGE_GLOW,
						boxShadow: "inset 0 0 0 1px var(--ui-marketing-hairline)",
					}),
				]}
			>
				{device}
			</div>
		);
	};
}

/**
 * The status bar with the camera pill between the clock and the radios, at the height a
 * phone reserves for it, so screens start where an app's content would.
 *
 * @returns The render function producing the bar.
 */
function StatusBar() {
	return () => (
		<div
			mix={[
				relative(),
				hstack({ gap: 2, align: "center", justify: "between" }),
				raw({ blockSize: "2.75rem", paddingInline: "1.5rem 1.25rem", flexShrink: "0" }),
			]}
		>
			<span mix={[weight("semibold"), tabularNums()]}>9:41</span>
			<span
				mix={[
					absolute(),
					raw({
						insetBlockStart: "0.625rem",
						insetInline: "0",
						marginInline: "auto",
						inlineSize: "32%",
						blockSize: "1.375rem",
						borderRadius: "9999px",
						backgroundColor: BEZEL,
					}),
				]}
			/>
			<svg width="48" height="11" viewBox="0 0 48 11" fill="currentColor" aria-hidden="true">
				<rect x="0" y="7" width="3" height="4" rx="0.8" />
				<rect x="4.5" y="5" width="3" height="6" rx="0.8" />
				<rect x="9" y="2.5" width="3" height="8.5" rx="0.8" />
				<rect x="13.5" y="0" width="3" height="11" rx="0.8" opacity="0.35" />
				<path d="M27 3.2a7 7 0 0 1 9 0l-1.3 1.4a5 5 0 0 0-6.4 0L27 3.2Zm2.6 2.8a3.4 3.4 0 0 1 3.8 0L31.5 8 29.6 6Z" />
				<rect
					x="38.5"
					y="0.5"
					width="8.5"
					height="10"
					rx="2.5"
					fill="none"
					stroke="currentColor"
					opacity="0.4"
				/>
				<rect x="40" y="2" width="5.5" height="7" rx="1.4" />
			</svg>
		</div>
	);
}

/**
 * Rooftree's five tabs over the home indicator, the active one in the brand ink.
 *
 * @param handle Runtime handle carrying the active tab.
 * @returns The render function producing the bar.
 */
function TabBar(handle: Handle<{ tab: Phone.Props["tab"] }>) {
	return () => (
		<div
			mix={[
				vstack({ gap: 2, align: "stretch" }),
				raw({
					flexShrink: "0",
					paddingBlock: "0.5rem 0.375rem",
					backgroundColor: "var(--ui-surface-raised)",
					borderBlockStart: "1px solid var(--ui-marketing-hairline)",
				}),
			]}
		>
			<div mix={[hstack({ gap: 0, align: "center", justify: "around" })]}>
				{TABS.map((entry) => {
					let Icon = entry.icon;
					let isActive = entry.id === handle.props.tab;
					return (
						<span
							key={entry.id}
							mix={[
								vstack({ gap: 0.5, align: "center" }),
								raw({ fontSize: "0.5625rem" }),
								weight("medium"),
								isActive ? fg("brand") : fg("neutral.muted"),
							]}
						>
							<Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} />
							{entry.label}
						</span>
					);
				})}
			</div>
			<span
				mix={[
					raw({
						alignSelf: "center",
						inlineSize: "34%",
						blockSize: "0.25rem",
						borderRadius: "9999px",
						backgroundColor: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			/>
		</div>
	);
}

namespace Card {
	/** Props of a screen card. */
	export interface Props {
		/** The small heading over the card's rows. */
		title?: RemixNode;
		/** A trailing note level with the title, such as a count. */
		meta?: RemixNode;
		/** The card's rows. */
		children: RemixNode;
	}
}

/**
 * A raised card on the app's screen, with an optional small heading and trailing note.
 *
 * @param handle Runtime handle carrying the heading, note and rows.
 * @returns The render function producing the card.
 */
export function Card(handle: Handle<Card.Props>) {
	return () => {
		let { children, meta, title } = handle.props;
		return (
			<div
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					raw({
						padding: "0.75rem",
						borderRadius: "0.875rem",
						backgroundColor: "var(--ui-surface-raised)",
						boxShadow: "var(--ui-shadow-surface)",
					}),
				]}
			>
				{title ? (
					<span mix={[hstack({ gap: 2, align: "center", justify: "between" })]}>
						<span
							mix={[
								weight("semibold"),
								fg("neutral.muted"),
								raw({ fontSize: "0.625rem", letterSpacing: "0.06em", textTransform: "uppercase" }),
							]}
						>
							{title}
						</span>
						{meta ? (
							<span mix={[fg("neutral.muted"), raw({ fontSize: "0.625rem" })]}>{meta}</span>
						) : null}
					</span>
				) : null}
				{children}
			</div>
		);
	};
}

namespace Initials {
	/** Props of one person's initials disc. */
	export interface Props {
		/** Who the disc stands for. */
		person: Person;
		/** Edge length in rem. */
		size?: number;
	}
}

/**
 * A person's initial on a disc in their hue, the mark that tells the household who has
 * an item, a chore or an event.
 *
 * @param handle Runtime handle carrying the person and size.
 * @returns The render function producing the disc.
 */
export function Initials(handle: Handle<Initials.Props>) {
	return () => {
		let { person, size } = handle.props;
		let { hue, initials } = PEOPLE[person];
		let edge = `${size ?? 1.25}rem`;
		return (
			<span
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						flexShrink: "0",
						inlineSize: edge,
						blockSize: edge,
						borderRadius: "9999px",
						fontSize: `calc(${edge} * 0.46)`,
						fontWeight: "650",
						color: "white",
						backgroundColor: `oklch(0.62 0.13 ${hue})`,
						boxShadow: `0 0 0 2px ${SCREEN}`,
					}),
				]}
			>
				{initials}
			</span>
		);
	};
}

namespace Row {
	/** Props of one list row on a screen. */
	export interface Props {
		/** Draws the tick filled and the label struck through. */
		done?: boolean;
		/** Who holds the item. */
		person?: Person;
		/** A muted note under the label, such as a quantity. */
		note?: RemixNode;
		/** The item. */
		children: RemixNode;
	}
}

/**
 * One item with a round tick, the row every list on the screens is built from; a done
 * row keeps its place, struck through, the way a shared list shows what is already in
 * the basket.
 *
 * @param handle Runtime handle carrying the item, its state and holder.
 * @returns The render function producing the row.
 */
export function Row(handle: Handle<Row.Props>) {
	return () => {
		let { children, done, note, person } = handle.props;
		return (
			<span mix={[hstack({ gap: 2, align: "center" })]}>
				<span
					mix={[
						raw({
							display: "inline-grid",
							placeItems: "center",
							flexShrink: "0",
							inlineSize: "1rem",
							blockSize: "1rem",
							borderRadius: "9999px",
							color: "white",
							backgroundColor: done ? "var(--ui-brand-bg-solid)" : "transparent",
							boxShadow: done
								? "none"
								: "inset 0 0 0 1.5px var(--ui-neutral-border-hover, var(--ui-neutral-border))",
						}),
					]}
				>
					{done ? <CheckIcon size={10} strokeWidth={3} /> : null}
				</span>
				<span mix={[vstack({ gap: 0, align: "start" }), raw({ flex: "1", minInlineSize: "0" })]}>
					<span
						mix={[
							truncate(),
							leading("snug"),
							raw({ maxInlineSize: "100%" }),
							done
								? [fg("neutral.muted"), raw({ textDecorationLine: "line-through" })]
								: weight("medium"),
						]}
					>
						{children}
					</span>
					{note ? (
						<span mix={[fg("neutral.muted"), raw({ fontSize: "0.625rem" })]}>{note}</span>
					) : null}
				</span>
				{person ? <Initials person={person} size={1.125} /> : null}
			</span>
		);
	};
}
