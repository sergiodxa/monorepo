/**
 * Live example for a `PageHeader` with a repository's eight tabs: on a wide pane every tab sits
 * in the row, and under 40rem of header width the row keeps the first two and the current one,
 * folding the rest, counts included, into a "More" menu.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge, Button } from "@sdxc/ui";
import { PageHeader } from "@sdxc/ui/app/page-header";

/** The source the page shows, matching the markup below. */
const CODE = `<PageHeader
	title="acme / delta"
	status={<Badge variant="secondary">Public</Badge>}
	primaryAction={<Button variant="outline">Watch</Button>}
	tabsLabel="Repository"
	tabs={[
		{ href: "/acme/delta", label: "Code" },
		{ href: "/acme/delta/issues", label: "Issues", count: 26 },
		{ href: "/acme/delta/pulls", label: "Pull requests", count: 71, current: true },
		{ href: "/acme/delta/discussions", label: "Discussions", count: 4 },
		{ href: "/acme/delta/actions", label: "Actions" },
		{ href: "/acme/delta/projects", label: "Projects", count: 2 },
		{ href: "/acme/delta/security", label: "Security" },
		{ href: "/acme/delta/settings", label: "Settings" },
	]}
	tabsNarrow={2}
	tabsMore="More"
/>`;

/** A tab's address in the preview, which returns the reader to this page. */
function tab(path: string): string {
	return `/examples/acme/delta${path}`;
}

/** What the preview registry reads: the title, the source to show, and the header to draw. */
export default {
	title: "Many tabs, folded on a narrow pane",
	code: CODE,
	viewports: true,
	render: () => (
		<PageHeader
			title="acme / delta"
			status={<Badge variant="secondary">Public</Badge>}
			primaryAction={<Button variant="outline">Watch</Button>}
			tabsLabel="Repository"
			tabs={[
				{ href: tab(""), label: "Code" },
				{ href: tab("/issues"), label: "Issues", count: 26 },
				{ href: tab("/pulls"), label: "Pull requests", count: 71, current: true },
				{ href: tab("/discussions"), label: "Discussions", count: 4 },
				{ href: tab("/actions"), label: "Actions" },
				{ href: tab("/projects"), label: "Projects", count: 2 },
				{ href: tab("/security"), label: "Security" },
				{ href: tab("/settings"), label: "Settings" },
			]}
			tabsNarrow={2}
			tabsMore="More"
		/>
	),
};
