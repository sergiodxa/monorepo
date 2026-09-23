/**
 * The row a documentation page carries above its body: copy this page as markdown, and
 * open it somewhere else. Both exist because a reader's next move is often not reading —
 * it is handing the page to a model — and a rendered page is the wrong thing to hand over.
 *
 * The menu is a native popover opened by an invoker command, so it works, and is reachable
 * from the keyboard, before any script has loaded; every entry is an ordinary link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ChevronDownIcon } from "@sdxc/icons";
import { hstack } from "@sdxc/u/layout";
import { Button, Menu } from "@sdxc/ui";

import { buildOpenLinks } from "~/app/services/open-links";
import { CopyMarkdown } from "~/resources/components/copy-markdown";

/** The button and the surface it opens agree on this id; one page carries one menu. */
const MENU_ID = "page-open-menu";

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

/** Renders the copy button and the `Open` menu beside it. */
export default function PageActions(handle: Handle<PageActions.Props>) {
	return () => {
		let { markdownHref, markdownUrl, sourceUrl } = handle.props;
		let links = buildOpenLinks(markdownHref, markdownUrl, sourceUrl);

		return (
			<div mix={[hstack({ gap: 2, align: "center" })]}>
				<CopyMarkdown href={markdownHref} />

				<Button
					type="button"
					color="neutral"
					variant="outline"
					size="sm"
					commandfor={MENU_ID}
					command="toggle-popover"
				>
					Open
					<ChevronDownIcon size={16} aria-hidden="true" />
				</Button>

				<Menu id={MENU_ID} aria-label="Open this page elsewhere">
					{links.map((link) => (
						<Menu.Item
							key={link.label}
							href={link.href}
							{...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
						>
							{link.label}
						</Menu.Item>
					))}
				</Menu>
			</div>
		);
	};
}
