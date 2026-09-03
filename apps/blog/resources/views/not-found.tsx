/**
 * View for the 404 not-found page. Renders the title, description, and emoji
 * supplied by the route model as a centered empty-state panel inside the shared
 * BlogLayout. Exists to give missing routes a friendly, on-brand fallback screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs, pbs } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Empty } from "@sdxc/ui";

import { BlogLayout } from "~/resources/layouts/blog";

/**
 * Type contracts used by the not-found page renderer.
 */
export namespace NotFoundView {
	/**
	 * Content used to render the not-found page.
	 */
	export interface Model {
		title: string;
		description: string;
		emoji: string;
	}
}

/**
 * Creates the not-found page renderer. Type sizes are pushed above the panel's
 * compact defaults because a 404 owns the whole page, and `Empty.Title`
 * renders an `<h1>` while the layout leaves headings unscoped.
 *
 * @returns A view function that renders the page from a `model` payload.
 */
export function NotFoundView() {
	return ({ model }: { model: NotFoundView.Model }) => (
		<BlogLayout title={model.title} description={model.description}>
			<main mix={[pbs(12)]}>
				<Empty color="brand">
					<Empty.Icon mix={[text("4xl")]}>{model.emoji}</Empty.Icon>
					<Empty.Title mix={[text("5xl")]}>{model.title}</Empty.Title>
					<Empty.Description mix={[maxIs("56ch"), text("2xl")]}>
						{model.description}
					</Empty.Description>
				</Empty>
			</main>
		</BlogLayout>
	);
}
