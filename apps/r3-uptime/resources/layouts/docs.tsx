/**
 * Shared chrome for the `/docs` site: a sidebar grouping every doc by section (no
 * client-side search — a plain, always-visible link list is enough for this app's
 * doc count) plus the article content column. Both the docs index and individual
 * doc pages compose their content into this layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import type { DocSection } from "~/app/services/docs";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace DocsLayout {
	export interface Props {
		sections: DocSection[];
		children: RemixNode;
	}
}

export default function DocsLayout(handle: Handle<DocsLayout.Props>) {
	return () => {
		let { sections, children } = handle.props;

		return (
			<div mix={[s.docsLayout]}>
				<div mix={[s.docsTopbar]}>
					<button
						type="button"
						commandfor="docs-sidebar"
						command="toggle-popover"
						aria-label="Toggle navigation"
						mix={[s.sidebarToggle]}
					>
						<svg viewBox="0 0 20 20" width={18} height={18} fill="none" aria-hidden="true">
							<path
								d="M3 5h14M3 10h14M3 15h14"
								stroke="currentColor"
								strokeWidth={1.5}
								strokeLinecap="round"
							/>
						</svg>
					</button>
				</div>

				<div mix={[s.docsBody]}>
					<aside id="docs-sidebar" popover="auto" mix={[s.docsSidebar]}>
						<a href={routes.docs.index.href()} mix={[s.marketingBrand]}>
							Documentation
						</a>

						{sections.map((section) => (
							<div key={section.title}>
								<p mix={[s.docsSidebarHeading]}>{section.title}</p>
								{section.docs.map((doc) => (
									<a key={doc.path} href={doc.path} mix={[s.marketingFooterLink]}>
										{doc.frontmatter.title}
									</a>
								))}
							</div>
						))}
					</aside>

					<div mix={[s.docsContent]}>{children}</div>
				</div>
			</div>
		);
	};
}
