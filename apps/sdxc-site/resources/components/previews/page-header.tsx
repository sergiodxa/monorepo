/**
 * Live preview for `PageHeader`: one monitor's screen opening with its trail, its name and
 * status, a one-line description and the actions with the primary one last. In a narrow frame
 * the trail gives way to a link back to the monitors list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { EllipsisIcon } from "@sdxc/icons";
import { Badge, Button } from "@sdxc/ui";
import { PageHeader } from "@sdxc/ui/app/page-header";

/** The source the page shows, matching the markup below. */
const CODE = `<PageHeader
	crumbsLabel="Breadcrumb"
	crumbs={[{ label: "Monitors", href: "/monitors" }, { label: "checkout-api" }]}
	title="checkout-api"
	status={<Badge color="danger" variant="secondary">Down</Badge>}
	description="HTTPS check of api.acme.dev/health every 30 seconds from 6 regions."
	overflow={<Button variant="ghost" color="neutral" aria-label="More actions">…</Button>}
	actions={<Button variant="outline" color="neutral">Pause</Button>}
	primaryAction={<Button>Edit monitor</Button>}
/>`;

/** What the preview registry reads: the source to show, and the header to draw. */
export default {
	code: CODE,
	render: () => (
		<PageHeader
			crumbsLabel="Breadcrumb"
			crumbs={[{ label: "Monitors", href: "#monitors" }, { label: "checkout-api" }]}
			title="checkout-api"
			status={
				<Badge color="danger" variant="secondary">
					Down
				</Badge>
			}
			description="HTTPS check of api.acme.dev/health every 30 seconds from 6 regions."
			overflow={
				<Button variant="ghost" color="neutral" size="sm" aria-label="More actions">
					<EllipsisIcon size={16} aria-hidden="true" />
				</Button>
			}
			actions={
				<Button variant="outline" color="neutral" size="sm">
					Pause
				</Button>
			}
			primaryAction={<Button size="sm">Edit monitor</Button>}
		/>
	),
};
