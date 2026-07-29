/**
 * View for the "Related tutorials" section shown at the bottom of a post page.
 * Defines the `PostRelatedView.Item`/`Model` shapes and returns a renderer that
 * builds a responsive grid of related-tutorial cards, collapsing to an empty
 * fragment when there are no related items to display.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Heading, Link } from "@pkg/r3-ui";
import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { gap, grid, gridTemplate, repeat } from "@pkg/u/layout";
import { m, mbs, p } from "@pkg/u/size";
import { text, weight } from "@pkg/u/typography";

/**
 * Groups the data shapes used to render related post cards.
 */
export namespace PostRelatedView {
	/**
	 * Represents one related tutorial entry shown in the section.
	 */
	export interface Item {
		href: string;
		label: string;
		reason: string;
	}

	/**
	 * Supplies the list of related entries rendered by the view.
	 */
	export interface Model {
		items: Array<Item>;
	}
}

/**
 * Builds a renderer for the related tutorials section.
 *
 * It returns an empty fragment when there are no related items.
 */
export function PostRelatedView() {
	return ({ model }: { model: PostRelatedView.Model }) => {
		if (model.items.length === 0) return <></>;

		return (
			<section mix={[grid(), gap(4)]}>
				<Heading level={2} mix={[m(0), text("2xl")]}>
					Related tutorials
				</Heading>
				<div
					mix={[
						grid(),
						gap(4),
						gridTemplate({ columns: repeat("auto-fit", "minmax(14rem, 1fr)") }),
					]}
				>
					{model.items.map((item) => (
						<article
							key={item.href}
							mix={[
								border({ width: 1, color: "neutral" }),
								rounded("lg"),
								p(4),
								bg("neutral.tint"),
							]}
						>
							<Link href={item.href} mix={[text("lg"), weight("bold")]}>
								{item.label}
							</Link>
							<p mix={[m(0), mbs(3), fg("neutral")]}>{item.reason}</p>
						</article>
					))}
				</div>
			</section>
		);
	};
}
