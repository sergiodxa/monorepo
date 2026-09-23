/**
 * Live preview island for `Breadcrumbs`. The `<nav>`, the ordered list and the `›` between
 * rows are the component's; the trail itself is a page's routing, and `aria-current="page"`
 * on the last link is what names the reader's position. A deep path with its middle
 * collapsed is how a real trail behaves once it outgrows its bar, so that is the example.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HouseIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { hstack } from "@sdxc/u/layout";
import { text } from "@sdxc/u/typography";
import { Breadcrumbs } from "@sdxc/ui";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Breadcrumbs aria-label="Breadcrumb">
	<Breadcrumbs.List>
		<Breadcrumbs.Item>
			<Breadcrumbs.Link href="/" mix={[hstack({ gap: 1, align: "center" })]}>
				<HouseIcon size={14} aria-hidden="true" />
				Workspace
			</Breadcrumbs.Link>
		</Breadcrumbs.Item>
		<Breadcrumbs.Item>
			<Breadcrumbs.Link href="/projects">Projects</Breadcrumbs.Link>
		</Breadcrumbs.Item>
		<Breadcrumbs.Item>
			<span mix={[text("sm"), fg("neutral.muted")]} aria-label="4 collapsed folders">
				…
			</span>
		</Breadcrumbs.Item>
		<Breadcrumbs.Item>
			<Breadcrumbs.Link href="/projects/acme-web/src/components">components</Breadcrumbs.Link>
		</Breadcrumbs.Item>
		<Breadcrumbs.Item>
			<Breadcrumbs.Link href="/projects/acme-web/src/components/button.tsx" aria-current="page">
				button.tsx
			</Breadcrumbs.Link>
		</Breadcrumbs.Item>
	</Breadcrumbs.List>
</Breadcrumbs>`;

/** A repository path with its middle collapsed, hydrated the way every preview here loads. */
export const BreadcrumbsPreview = clientEntry(
	"/resources/components/previews/breadcrumbs.tsx#BreadcrumbsPreview",
	function BreadcrumbsPreview() {
		return () => (
			<Breadcrumbs aria-label="Breadcrumb">
				<Breadcrumbs.List>
					<Breadcrumbs.Item>
						<Breadcrumbs.Link href="/" mix={[hstack({ gap: 1, align: "center" })]}>
							<HouseIcon size={14} aria-hidden="true" />
							Workspace
						</Breadcrumbs.Link>
					</Breadcrumbs.Item>
					<Breadcrumbs.Item>
						<Breadcrumbs.Link href="/projects">Projects</Breadcrumbs.Link>
					</Breadcrumbs.Item>
					<Breadcrumbs.Item>
						<span mix={[text("sm"), fg("neutral.muted")]} aria-label="4 collapsed folders">
							…
						</span>
					</Breadcrumbs.Item>
					<Breadcrumbs.Item>
						<Breadcrumbs.Link href="/projects/acme-web/src/components">components</Breadcrumbs.Link>
					</Breadcrumbs.Item>
					<Breadcrumbs.Item>
						<Breadcrumbs.Link
							href="/projects/acme-web/src/components/button.tsx"
							aria-current="page"
						>
							button.tsx
						</Breadcrumbs.Link>
					</Breadcrumbs.Item>
				</Breadcrumbs.List>
			</Breadcrumbs>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <BreadcrumbsPreview /> };
