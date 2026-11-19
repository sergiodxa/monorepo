/**
 * Live preview for `SectionBar`: a menu's categories as a sticky row of chips over a short
 * scrolling box of sections, so scrolling the box shows the current chip following along.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { SECTION_BAR_BLOCK_SIZE, SectionBar } from "@sdxc/ui/app/section-bar";

/** The source the page shows, matching the markup below. */
const CODE = `<SectionBar
	id="menu-bar"
	label="Menu categories"
	top="4rem"
	items={sections.map((section) => ({ id: section.id, label: section.name, count: section.items.length }))}
/>
{sections.map((section) => (
	<section id={section.id} style={\`scroll-margin-top: calc(4rem + \${SECTION_BAR_BLOCK_SIZE})\`}>
		<h2>{section.name}</h2>
	</section>
))}`;

/** The menu's categories and how many dishes each holds. */
const SECTIONS = [
	{
		id: "preview-popular",
		label: "Popular",
		count: 4,
		dishes: ["Lantern bowl", "Spicy tantan", "Karaage", "Gyoza"],
	},
	{
		id: "preview-ramen",
		label: "Ramen",
		count: 3,
		dishes: ["Lantern bowl", "Spicy tantan", "Garden shio"],
	},
	{ id: "preview-small", label: "Small plates", count: 3, dishes: ["Gyoza", "Karaage", "Edamame"] },
	{
		id: "preview-sweets",
		label: "Sweets",
		count: 2,
		dishes: ["Black sesame soft serve", "Yuzu sorbet"],
	},
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: "32rem",
					blockSize: "18rem",
					overflowY: "auto",
					borderRadius: "0.75rem",
					boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
				}),
			]}
		>
			<SectionBar
				id="preview-menu-bar"
				label="Menu categories"
				items={SECTIONS.map(({ count, id, label }) => ({ id, label, count }))}
			/>
			{SECTIONS.map((section) => (
				<section
					id={section.id}
					mix={[
						raw({
							padding: "1rem",
							scrollMarginBlockStart: SECTION_BAR_BLOCK_SIZE,
						}),
					]}
				>
					<h3 mix={[raw({ margin: "0 0 0.5rem", fontSize: "1rem" })]}>{section.label}</h3>
					<ul
						mix={[
							raw({ display: "grid", gap: "0.5rem", margin: "0", padding: "0", listStyle: "none" }),
						]}
					>
						{section.dishes.map((dish) => (
							<li
								mix={[
									raw({
										padding: "0.75rem",
										borderRadius: "0.5rem",
										backgroundColor: "var(--ui-neutral-bg-subtle)",
									}),
								]}
							>
								{dish}
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	),
};
