/**
 * Live preview for `DocsPageHeader`: a reference page opening with its trail, a title a
 * reader types, the lead, a plan notice and the meta row holding the date and page actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { DocsPageHeader, PageActions } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<DocsPageHeader
	crumbsLabel="Breadcrumb"
	crumbs={[{ label: "Docs", href: "/docs" }, { label: "Packages" }, { label: "@sdxc/result" }]}
	title="@sdxc/result"
	mono
	description="Return failures as values, so every caller sees the error it has to handle."
	notice={<PlanNotice>Available on every plan</PlanNotice>}
	updated={{ label: "Last updated", date: "2026-10-12", text: "Oct 12, 2026" }}
	actions={<PageActions markdownHref="/docs/result.md" labels={labels} links={links} />}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<DocsPageHeader
			crumbsLabel="Breadcrumb"
			crumbs={[{ label: "Docs", href: "#docs" }, { label: "Packages" }, { label: "@sdxc/result" }]}
			title="@sdxc/result"
			mono
			description="Return failures as values, so every caller sees the error it has to handle."
			notice={<p mix={[m(0), text("sm"), fg("neutral.muted")]}>Works in Workers, Bun and Node.</p>}
			updated={{ label: "Last updated", date: "2026-10-12", text: "Oct 12, 2026" }}
			actions={
				<PageActions
					menuId="preview-header-actions"
					markdownHref="#result.md"
					labels={{
						copy: "Copy page",
						copied: "Copied",
						failed: "Could not copy the page",
						more: "More ways to use this page",
					}}
					links={[{ label: "View as Markdown", href: "#result.md" }]}
				/>
			}
		/>
	),
};
