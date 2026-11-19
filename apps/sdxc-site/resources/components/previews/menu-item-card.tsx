/**
 * Live preview for `MenuItemCard`: two dishes on a menu, one popular, each a card whose picture
 * carries a round + and which opens the dish's options dialog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Badge } from "@sdxc/ui";
import { MenuItemCard } from "@sdxc/ui/commerce/menu-item-card";

/** The source the page shows. */
const CODE = `<MenuItemCard
	dialog="item-al-pastor"
	name="Al pastor trio"
	description="Spit-roasted pork, charred pineapple, cilantro and onion."
	price="From $11.50"
	badges={<Badge color="success" variant="secondary">Vegetarian</Badge>}
	media={<img src={dish.picture} alt="" />}
	mediaBackground="oklch(0.9 0.07 75)"
/>`;

/** A plate drawn in two circles, standing in for the dish's picture. */
function Plate() {
	return () => (
		<svg
			viewBox="0 0 40 40"
			aria-hidden="true"
			mix={[raw({ display: "block", inlineSize: "100%" })]}
		>
			<circle cx="20" cy="20" r="17" fill="oklch(0.95 0.02 90)" />
			<circle cx="20" cy="20" r="11" fill="oklch(0.72 0.15 45)" />
		</svg>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(min(20rem, 100%), 1fr))",
					gap: "0.875rem",
					inlineSize: "100%",
				}),
			]}
		>
			<MenuItemCard
				dialog="preview-item-missing"
				name="Al pastor trio"
				description="Spit-roasted pork, charred pineapple, cilantro and onion."
				price="From $11.50"
				badges={
					<span
						mix={[raw({ fontSize: "0.75rem", fontWeight: "700", color: "var(--ui-brand-fg)" })]}
					>
						Popular
					</span>
				}
				media={<Plate />}
				mediaBackground="oklch(0.9 0.07 75)"
			/>
			<MenuItemCard
				dialog="preview-item-missing"
				name="Hongos trio"
				description="Garlic oyster mushrooms, epazote, black beans and cotija."
				price="$10.50"
				badges={
					<Badge color="success" variant="secondary">
						Vegetarian
					</Badge>
				}
				media={<Plate />}
				mediaBackground="oklch(0.93 0.05 140)"
			/>
		</div>
	),
};
