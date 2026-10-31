/**
 * The row a documentation page carries beside its date: copy this page as markdown, and
 * open it somewhere else. Both exist because a reader's next move is often not reading —
 * it is handing the page to a model — and a rendered page is the wrong thing to hand over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { PageActions as SharedPageActions } from "@sdxc/ui";

import { buildOpenLinks } from "~/app/services/open-links";

namespace PageActions {
	export interface Props {
		/** The page's markdown twin, as a path on this site. */
		markdownHref: string;
		/** The same twin as an absolute URL, which is what an assistant is handed. */
		markdownUrl: string;
		/** Where this page's source is read on GitHub. */
		sourceUrl: string;
	}
}

/**
 * Renders the copy button and the menu beside it. Every menu link opens in a new tab, so
 * the markdown twin loads as a document rather than through the page's client navigation.
 */
export default function PageActions(handle: Handle<PageActions.Props>) {
	return () => {
		let { markdownHref, markdownUrl, sourceUrl } = handle.props;

		return (
			<SharedPageActions
				markdownHref={markdownHref}
				labels={{
					copy: "Copy page",
					copied: "Copied",
					failed: "Could not copy the page",
					more: "Open this page elsewhere",
				}}
				links={buildOpenLinks(markdownHref, markdownUrl, sourceUrl).map((link) => ({
					...link,
					external: true,
				}))}
			/>
		);
	};
}
