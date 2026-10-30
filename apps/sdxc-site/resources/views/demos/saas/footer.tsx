/**
 * Keel's footer: the logo and its one-line pitch, four columns of links, and a legal row
 * that carries the status line beside the copyright. Every link lands on a section of
 * this page, so the demo has no destination that answers 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ActivityIcon, BookOpenIcon, RssIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, text } from "@sdxc/u/typography";
import { SiteFooter } from "@sdxc/ui/patterns";

import { KeelLogo } from "~/resources/views/demos/saas/marks";

/** Each column's heading and its links, every one an anchor on this page. */
const COLUMNS: SiteFooter.Column[] = [
	{
		title: "Product",
		links: [
			{ label: "Metering", href: "#product" },
			{ label: "Pricing engine", href: "#workflow" },
			{ label: "Invoicing", href: "#workflow" },
			{ label: "Customer portal", href: "#platform" },
		],
	},
	{
		title: "Developers",
		links: [
			{ label: "Quickstart", href: "#product" },
			{ label: "API reference", href: "#product" },
			{ label: "Webhooks", href: "#platform" },
			{ label: "Changelog", href: "#changelog" },
		],
	},
	{
		title: "Company",
		links: [
			{ label: "Customers", href: "#customers" },
			{ label: "Pricing", href: "#pricing" },
			{ label: "Security", href: "#security" },
			{ label: "Contact sales", href: "#start" },
		],
	},
	{
		title: "Legal",
		links: [
			{ label: "Terms", href: "#top" },
			{ label: "Privacy", href: "#top" },
			{ label: "DPA", href: "#security" },
			{ label: "Subprocessors", href: "#security" },
		],
	},
];

/**
 * Renders the footer. The status line is set in mono, like the product identifiers
 * elsewhere on the page, with an inline dot in the success colour, so it holds inside the
 * legal row's block links.
 *
 * @returns The render function producing the footer.
 */
export function SaasFooter() {
	return () => (
		<SiteFooter
			brand={
				<a href="#top" aria-label="Keel home" mix={[fg("neutral.emphasis")]}>
					<KeelLogo />
				</a>
			}
			tagline="Usage-based billing for API companies, from the first metered event to the paid invoice."
			columns={COLUMNS}
			social={
				<>
					<a href="#changelog" aria-label="Changelog feed">
						<RssIcon aria-hidden="true" />
					</a>
					<a href="#product" aria-label="Documentation">
						<BookOpenIcon aria-hidden="true" />
					</a>
					<a href="#top" aria-label="System status">
						<ActivityIcon aria-hidden="true" />
					</a>
				</>
			}
			legal={
				<>
					<p>© 2026 Keel Billing, Inc. A demo product.</p>
					<a href="#top" mix={[font("mono"), text("xs")]}>
						<span
							aria-hidden="true"
							mix={[
								raw({
									display: "inline-block",
									inlineSize: "0.5rem",
									blockSize: "0.5rem",
									marginInlineEnd: "0.5rem",
									verticalAlign: "0.0625rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-success-bg-solid)",
								}),
							]}
						/>
						All systems normal
					</a>
				</>
			}
		/>
	);
}
