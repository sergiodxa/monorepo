/**
 * Today's bake: the day's special named by the bakery's own calendar, a chalkboard of what
 * comes out of the oven when (each batch marked out already or still to come at the moment
 * the page was asked for), and the season's three bakes beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { dark } from "@sdxc/u/responsive";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import type { Bake } from "~/resources/views/demos/bakery/art";
import type { LocalDay, Season } from "~/resources/views/demos/bakery/hours";

import { BUTTER, CREAM, Drawing, gingham } from "~/resources/views/demos/bakery/art";
import {
	dayAfter,
	formatTime,
	localClock,
	seasonOf,
	WEEK,
} from "~/resources/views/demos/bakery/hours";
import { renderNearView } from "~/resources/views/demos/near-view";

/** Each weekday's special, Sunday first; Monday has none because the shop is shut. */
const DAY_SPECIALS: ReadonlyArray<{ name: string; line: string; bake: Bake } | null> = [
	{ name: "Morning buns", line: "Laminated, rolled in orange sugar.", bake: "bun" },
	null,
	{ name: "Cardamom buns", line: "Knotted by hand, the Swedish way.", bake: "bun" },
	{ name: "Seeded rye", line: "Dark, dense and full of sunflower seeds.", bake: "loaf" },
	{ name: "Rosemary focaccia", line: "A tray as big as the table.", bake: "focaccia" },
	{ name: "Challah", line: "Braided at five, glazed twice.", bake: "braid" },
	{ name: "Almond croissants", line: "Yesterday's croissants, made better.", bake: "croissant" },
];

/** The oven's day, in minutes after local midnight; the day's special goes in at eleven. */
const BATCHES: ReadonlyArray<{ at: number; what: string | null }> = [
	{ at: 7 * 60, what: "Croissants and the first sourdough" },
	{ at: 9 * 60 + 30, what: "Second sourdough and baguettes" },
	{ at: 11 * 60, what: null },
	{ at: 13 * 60 + 30, what: "Cookies, still soft in the middle" },
];

/** The season's bakes, priced, with a line each. */
const SEASONAL: Record<
	Season,
	{ title: string; items: ReadonlyArray<{ name: string; price: string; line: string; bake: Bake }> }
> = {
	autumn: {
		title: "This autumn",
		items: [
			{
				name: "Pumpkin & brown-butter loaf",
				price: "$10",
				line: "Roast pumpkin from Ferris Farm, two miles up the road.",
				bake: "loaf",
			},
			{
				name: "Apple cider hand pie",
				price: "$5.50",
				line: "Fits in a coat pocket. Mostly.",
				bake: "pie",
			},
			{ name: "Pecan pie by the slice", price: "$6", line: "Whole pies to order.", bake: "pie" },
		],
	},
	winter: {
		title: "This winter",
		items: [
			{ name: "Stollen", price: "$18", line: "Marzipan through the middle.", bake: "loaf" },
			{ name: "Gingerbread buns", price: "$4.50", line: "With a molasses glaze.", bake: "bun" },
			{ name: "Hot chocolate", price: "$4", line: "Made with milk, never water.", bake: "cup" },
		],
	},
	spring: {
		title: "This spring",
		items: [
			{ name: "Rhubarb galette", price: "$6", line: "Tart, pink, and gone by noon.", bake: "pie" },
			{
				name: "Wild garlic focaccia",
				price: "$7",
				line: "While the garlic lasts.",
				bake: "focaccia",
			},
			{ name: "Lemon poppy buns", price: "$4.50", line: "With a sharp lemon glaze.", bake: "bun" },
		],
	},
	summer: {
		title: "This summer",
		items: [
			{
				name: "Peach & ricotta tart",
				price: "$6.50",
				line: "Peaches from the Saturday market.",
				bake: "pie",
			},
			{
				name: "Tomato focaccia",
				price: "$7",
				line: "Topped with whatever is ripest.",
				bake: "focaccia",
			},
			{ name: "Iced coffee", price: "$4", line: "Cold-brewed overnight.", bake: "cup" },
		],
	},
};

/** The day the board describes: today when the shop opens today, else the next day it opens. */
function boardDay(now: Date): { day: LocalDay; isToday: boolean } {
	let { date } = localClock(now);
	for (let offset = 0; offset <= 14; offset++) {
		let day = dayAfter(date, offset);
		if (day.opening !== null) return { day, isToday: offset === 0 };
	}
	return { day: dayAfter(date, 0), isToday: true };
}

/**
 * The today band: the day's special as the title, the chalkboard of batches with each one
 * marked "out now" or "at 11 am", and the three seasonal bakes as illustrated cards.
 *
 * @param handle Runtime handle carrying the instant the page was asked for.
 * @returns The render function producing the band.
 */
export function Specials(handle: Handle<{ now: Date }>) {
	return () => {
		let { now } = handle.props;
		let { day, isToday } = boardDay(now);
		let minutes = isToday ? localClock(now).minutes : -1;
		let special = DAY_SPECIALS[day.weekday] ?? DAY_SPECIALS[2]!;
		let dayName = WEEK[day.weekday]?.name ?? "";
		let season = SEASONAL[seasonOf(day.date)];
		let closes = day.opening?.closes ?? 0;
		let batches = BATCHES.filter((batch) => batch.at < closes);

		return (
			<LandingSection
				id="today"
				tone="tinted"
				mix={[gingham("var(--ui-color-brand-400)", "2.5rem", 7), renderNearView(760, 1500)]}
			>
				<LandingHeader
					eyebrow={isToday ? `Today, ${dayName}` : `We're closed today · Next up, ${dayName}`}
					description={
						<>
							Every day has its own bake. <strong>{special.name}</strong>:{" "}
							{special.line.toLowerCase()}
						</>
					}
				>
					{dayName} is {special.name.toLowerCase()} day
				</LandingHeader>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))",
							gap: "1.5rem",
							alignItems: "stretch",
						}),
					]}
				>
					<Chalkboard
						batches={batches}
						minutes={minutes}
						special={special.name}
						bake={special.bake}
						heading={isToday ? "Out of the oven today" : `Out of the oven on ${dayName}`}
					/>
					<div mix={[raw({ display: "flex", flexDirection: "column", gap: "0.75rem" })]}>
						<p
							mix={[
								raw({
									margin: "0",
									fontFamily: "var(--ui-font-display)",
									fontWeight: "700",
									fontSize: "1.375rem",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{season.title}
						</p>
						<ul
							mix={[
								raw({
									listStyle: "none",
									margin: "0",
									padding: "0",
									display: "grid",
									gap: "0.75rem",
								}),
							]}
						>
							{season.items.map((item) => (
								<li
									key={item.name}
									mix={[
										raw({
											display: "grid",
											gridTemplateColumns: "5.5rem 1fr",
											alignItems: "center",
											gap: "1rem",
											padding: "0.75rem 1rem",
											borderRadius: "var(--ui-landing-card-radius-inner)",
											backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
											boxShadow: "var(--ui-shadow-surface)",
										}),
									]}
								>
									<Drawing bake={item.bake} />
									<span mix={[raw({ display: "flex", flexDirection: "column", gap: "0.125rem" })]}>
										<span
											mix={[
												raw({
													display: "flex",
													justifyContent: "space-between",
													gap: "0.75rem",
													fontWeight: "700",
													color: "var(--ui-neutral-fg-emphasis)",
												}),
											]}
										>
											<span>{item.name}</span>
											<span mix={[raw({ fontVariantNumeric: "tabular-nums", flexShrink: "0" })]}>
												{item.price}
											</span>
										</span>
										<span mix={[raw({ fontSize: "0.9375rem", color: "var(--ui-neutral-fg)" })]}>
											{item.line}
										</span>
									</span>
								</li>
							))}
						</ul>
					</div>
				</div>
			</LandingSection>
		);
	};
}

namespace Chalkboard {
	/** The batches to list, the local minute that splits "out now" from "coming", and the special. */
	export interface Props {
		batches: ReadonlyArray<{ at: number; what: string | null }>;
		minutes: number;
		special: string;
		bake: Bake;
		heading: string;
	}
}

/**
 * A green chalkboard in a wooden frame: the day's batches by time, each one ticked "Out now"
 * once its time has passed on the bakery's clock, with the special drawn in the corner.
 *
 * @param handle Runtime handle carrying the batches and the current local minute.
 * @returns The render function producing the board.
 */
function Chalkboard(handle: Handle<Chalkboard.Props>) {
	return () => {
		let { bake, batches, heading, minutes, special } = handle.props;
		return (
			<div
				data-slot="chalkboard"
				mix={[
					raw({
						position: "relative",
						display: "flex",
						flexDirection: "column",
						gap: "1rem",
						padding: "1.5rem clamp(1.25rem, 4cqi, 2rem)",
						borderRadius: "var(--ui-landing-card-radius-outer)",
						backgroundColor: "oklch(0.33 0.04 155)",
						border: "0.625rem solid oklch(0.55 0.08 55)",
						color: CREAM,
					}),
					dark(raw({ borderColor: "oklch(0.42 0.07 50)" })),
				]}
			>
				<p
					mix={[
						raw({
							margin: "0",
							fontFamily: "var(--ui-font-display)",
							fontWeight: "700",
							fontSize: "1.5rem",
							paddingInlineEnd: "4.5rem",
							color: BUTTER,
						}),
					]}
				>
					{heading}
				</p>
				<ol
					mix={[
						raw({
							listStyle: "none",
							margin: "0",
							padding: "0",
							display: "flex",
							flexDirection: "column",
							gap: "0.875rem",
						}),
					]}
				>
					{batches.map((batch) => {
						let out = minutes >= batch.at;
						return (
							<li
								key={batch.at}
								data-out={out ? "true" : "false"}
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "4.75rem 1fr",
										gap: "0.75rem",
										alignItems: "baseline",
										paddingBlockEnd: "0.75rem",
										borderBlockEnd: "1px dashed color-mix(in oklch, white 25%, transparent)",
									}),
								]}
							>
								<span mix={[raw({ fontWeight: "800", fontVariantNumeric: "tabular-nums" })]}>
									{formatTime(batch.at)}
								</span>
								<span mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.25rem 0.5rem" })]}>
									<span>{batch.what ?? `${special}, today's special`}</span>
									<span
										mix={[
											raw({
												fontSize: "0.8125rem",
												fontWeight: "700",
												paddingInline: "0.5rem",
												borderRadius: "9999px",
												color: out ? "oklch(0.3 0.04 155)" : CREAM,
												backgroundColor: out ? BUTTER : "transparent",
												boxShadow: out ? "none" : `inset 0 0 0 1px ${CREAM}`,
											}),
										]}
									>
										{out ? "Out now" : "Coming"}
									</span>
								</span>
							</li>
						);
					})}
				</ol>
				<p mix={[raw({ margin: "0", fontSize: "0.9375rem", opacity: "0.85" })]}>
					When a tray sells out, it's gone until tomorrow. Order ahead to be sure.
				</p>
				<span
					mix={[
						raw({
							position: "absolute",
							insetInlineEnd: "0.75rem",
							insetBlockStart: "0.75rem",
							inlineSize: "4.5rem",
							transform: "rotate(8deg)",
						}),
					]}
				>
					<Drawing bake={bake} />
				</span>
			</div>
		);
	};
}
