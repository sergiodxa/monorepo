/**
 * Live example for a `PageHeader` with tabs: each view of a monitor is a link with
 * `aria-current` on the one shown, and the incidents tab carries its count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge, Button } from "@sdxc/ui";
import { PageHeader } from "@sdxc/ui/app/page-header";

/** The source the page shows, matching the markup below. */
const CODE = `<PageHeader
	crumbsLabel="Breadcrumb"
	crumbs={[{ label: "Monitors", href: "/monitors" }, { label: "checkout-api" }]}
	title="checkout-api"
	status={<Badge color="success" variant="secondary">Up</Badge>}
	primaryAction={<Button>Edit monitor</Button>}
	tabsLabel="Monitor views"
	tabs={[
		{ href: "/monitors/42", label: "Overview", current: true },
		{ href: "/monitors/42/incidents", label: "Incidents", count: 3 },
		{ href: "/monitors/42/checks", label: "Check log" },
		{ href: "/monitors/42/settings", label: "Settings" },
	]}
/>`;

/** What the preview registry reads: the title, the source to show, and the header to draw. */
export default {
	title: "With tabs and counts",
	code: CODE,
	render: () => (
		<PageHeader
			crumbsLabel="Breadcrumb"
			crumbs={[{ label: "Monitors", href: "#monitors" }, { label: "checkout-api" }]}
			title="checkout-api"
			status={
				<Badge color="success" variant="secondary">
					Up
				</Badge>
			}
			primaryAction={<Button size="sm">Edit monitor</Button>}
			tabsLabel="Monitor views"
			tabs={[
				{ href: "#overview", label: "Overview", current: true },
				{ href: "#incidents", label: "Incidents", count: 3 },
				{ href: "#checks", label: "Check log" },
				{ href: "#settings", label: "Settings" },
			]}
		/>
	),
};
