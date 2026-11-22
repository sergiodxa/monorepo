/**
 * The menu and prices: four boards (bread, pastry, pies and cakes, drinks) in the shared
 * price list, with what goes into each bake in a plain line and a key for the vegan and
 * gluten-free marks underneath.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { LandingHeader, LandingSection, PriceList } from "@sdxc/ui/landing";

import { renderNearView } from "~/resources/views/demos/near-view";

/** A dietary mark: the letters on the menu and what they mean. */
type Diet = "V" | "GF";

/** What each mark stands for, spelled out for screen readers and the key below the menu. */
const DIET_NAMES: Record<Diet, string> = { V: "vegan", GF: "gluten-free" };

/** The menu's boards, each a title, when it is served, and its items. */
const BOARDS: ReadonlyArray<{
	title: string;
	when: string;
	items: ReadonlyArray<{ name: string; price: string; line: string; diet?: Diet[] }>;
}> = [
	{
		title: "Bread",
		when: "From 7 am until it runs out",
		items: [
			{
				name: "Country sourdough",
				price: "$9",
				line: "Two-day ferment, big and crackly. 900 g.",
				diet: ["V"],
			},
			{ name: "Seeded rye", price: "$10", line: "Sunflower, flax and pumpkin seeds.", diet: ["V"] },
			{ name: "Baguette", price: "$4", line: "Out at 7 and again at 9:30.", diet: ["V"] },
			{ name: "Sandwich loaf", price: "$7", line: "Soft white, sliced if you ask." },
			{
				name: "Buckwheat & millet loaf",
				price: "$11",
				line: "Baked on its own day, in its own tins.",
				diet: ["V", "GF"],
			},
		],
	},
	{
		title: "Pastry",
		when: "From 7 am",
		items: [
			{ name: "Butter croissant", price: "$4.25", line: "Three days from dough to plate." },
			{ name: "Pain au chocolat", price: "$4.75", line: "Two sticks of dark chocolate." },
			{ name: "Cardamom bun", price: "$4.50", line: "Our most-asked-for bake." },
			{ name: "Morning bun", price: "$4.50", line: "Orange sugar, Sundays only." },
			{ name: "Oat & date cookie", price: "$3", line: "Chewy, not too sweet.", diet: ["V"] },
		],
	},
	{
		title: "Pies & cakes",
		when: "By the slice, or whole with two days' notice",
		items: [
			{ name: "Pie of the season", price: "$6 / $34", line: "Slice or whole 9-inch pie." },
			{ name: "Carrot cake", price: "$5.50", line: "Cream cheese frosting, walnuts on top." },
			{ name: "Lemon drizzle", price: "$4.50", line: "Sharp and sticky." },
			{
				name: "Flourless chocolate cake",
				price: "$6",
				line: "Rich, so we cut it thin.",
				diet: ["GF"],
			},
			{ name: "Birthday cake", price: "from $42", line: "Order three days ahead. We write names." },
		],
	},
	{
		title: "To drink",
		when: "Oat milk at no extra charge",
		items: [
			{ name: "Filter coffee", price: "$2.75", line: "Free refills while you sit." },
			{ name: "Flat white", price: "$4", line: "Beans roasted on Pine Street." },
			{ name: "Pot of tea", price: "$3.50", line: "Breakfast, Earl Grey or mint." },
			{ name: "Hot chocolate", price: "$4", line: "Made with milk, topped with a marshmallow." },
			{ name: "Apple juice", price: "$3", line: "Pressed at Ferris Farm." },
		],
	},
];

/**
 * The dietary letters after an item's line, each with its full word for screen readers.
 *
 * @param handle Runtime handle carrying the marks.
 * @returns The render function producing the marks.
 */
function DietMarks(handle: Handle<{ diet: Diet[] }>) {
	return () => (
		<span mix={[raw({ display: "inline-flex", gap: "0.25rem", marginInlineStart: "0.375rem" })]}>
			{handle.props.diet.map((mark) => (
				<abbr
					key={mark}
					title={DIET_NAMES[mark]}
					aria-label={DIET_NAMES[mark]}
					mix={[
						raw({
							textDecoration: "none",
							fontSize: "0.6875rem",
							fontWeight: "800",
							lineHeight: "1",
							paddingBlock: "0.1875rem",
							paddingInline: "0.375rem",
							borderRadius: "9999px",
							color: "var(--ui-brand-fg)",
							backgroundColor: "var(--ui-brand-bg-tint-hover)",
						}),
					]}
				>
					{mark}
				</abbr>
			))}
		</span>
	);
}

/**
 * The menu band: four boards of items and prices, then the key to the dietary marks and a
 * word about allergens.
 *
 * @returns The render function producing the band.
 */
export function Menu() {
	return () => (
		<LandingSection id="menu" mix={[renderNearView(1129, 2020)]}>
			<LandingHeader
				eyebrow="Menu and prices"
				description={
					<>
						Everything is baked here, on Alder Street, the night before or that morning.{" "}
						<strong>Prices include tax.</strong>
					</>
				}
			>
				What's on the counter
			</LandingHeader>
			<PriceList columnWidth="22rem">
				{BOARDS.map((board) => (
					<PriceList.Group key={board.title} title={board.title} description={board.when}>
						{board.items.map((item) => (
							<PriceList.Item key={item.name} name={item.name} price={item.price}>
								{item.line}
								{item.diet ? <DietMarks diet={item.diet} /> : null}
							</PriceList.Item>
						))}
					</PriceList.Group>
				))}
			</PriceList>
			<p
				mix={[
					raw({
						margin: "2.5rem 0 0",
						fontSize: "0.9375rem",
						color: "var(--ui-neutral-fg-muted)",
						maxInlineSize: "44rem",
					}),
				]}
			>
				V is vegan, GF is gluten-free. Everything else shares one kitchen with wheat, eggs, milk and
				nuts, so ask us at the counter and we'll tell you exactly what's in it.
			</p>
		</LandingSection>
	);
}
