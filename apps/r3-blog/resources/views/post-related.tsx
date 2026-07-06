/**
 * View for the "Related tutorials" section shown at the bottom of a post page.
 * Defines the `PostRelatedView.Item`/`Model` shapes and returns a renderer that
 * builds a responsive grid of related-tutorial cards, collapsing to an empty
 * fragment when there are no related items to display.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { css } from "remix/ui";

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
			<section mix={[css({ display: "grid", gap: "1rem" })]}>
				<h2 mix={[css({ margin: 0, color: "var(--ui-neutral-fg-emphasis)", fontSize: "1.5rem" })]}>
					Related tutorials
				</h2>
				<div
					mix={[
						css({
							display: "grid",
							gap: "0.9rem",
							gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
						}),
					]}
				>
					{model.items.map((item) => (
						<article
							key={item.href}
							mix={[
								css({
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "0.8rem",
									padding: "0.9rem",
									backgroundColor: "var(--ui-neutral-bg-tint)",
								}),
							]}
						>
							<a
								href={item.href}
								mix={[
									css({
										fontSize: "1.05rem",
										fontWeight: 700,
										color: "var(--ui-accent-fg)",
									}),
								]}
							>
								{item.label}
							</a>
							<p mix={[css({ margin: "0.6rem 0 0", color: "var(--ui-neutral-fg)" })]}>
								{item.reason}
							</p>
						</article>
					))}
				</div>
			</section>
		);
	};
}
