/**
 * Live preview for `DocsFooter`: the compact close of a docs page, a byline over one row of
 * legal and site links, as `DocsLayout` draws it beside the pinned sidebar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, m } from "@sdxc/u/size";
import { DocsFooter } from "@sdxc/ui/docs";

/** The source the page shows, matching the markup below. */
const CODE = `<DocsLayout
	footer={
		<DocsFooter
			legal="© 2026 Acme. MIT licensed."
			links={[
				{ label: "Privacy", href: "/privacy" },
				{ label: "Terms", href: "/terms" },
				{ label: "Status", href: "/status" },
				{ label: "GitHub", href: "https://github.com/acme" },
			]}
			linksLabel="Site"
		>
			<p>Written by the Acme team.</p>
		</DocsFooter>
	}
	…
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<DocsFooter
				legal="© 2026 Acme. MIT licensed."
				links={[
					{ label: "Privacy", href: "#privacy" },
					{ label: "Terms", href: "#terms" },
					{ label: "Status", href: "#status" },
					{ label: "GitHub", href: "#github" },
				]}
				linksLabel="Site"
			>
				<p mix={[m(0)]}>Written by the Acme team.</p>
			</DocsFooter>
		</div>
	),
};
