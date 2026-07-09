/**
 * Docs index view (`/docs`). Renders one card per section, listing every doc it
 * contains, so visitors can jump straight to any topic without a search widget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { DocSection } from "~/app/services/docs";

import * as s from "~/resources/styles";

namespace DocsIndexView {
	export interface Props {
		sections: DocSection[];
	}
}

export default function DocsIndexView(handle: Handle<DocsIndexView.Props>) {
	return () => {
		let { sections } = handle.props;

		return (
			<>
				<h1>Documentation</h1>
				<p mix={[s.docsIntro]}>
					Guides for getting started, understanding each monitor type, the REST API, and team
					settings.
				</p>

				<div mix={[s.marketingGrid]}>
					{sections.map((section) => (
						<div key={section.title} mix={[s.marketingCard]}>
							<h3 mix={[s.marketingCardTitle]}>{section.title}</h3>
							{section.docs.map((doc) => (
								<a key={doc.path} href={doc.path} mix={[s.marketingFooterLink]}>
									{doc.frontmatter.title}
								</a>
							))}
						</div>
					))}
				</div>
			</>
		);
	};
}
