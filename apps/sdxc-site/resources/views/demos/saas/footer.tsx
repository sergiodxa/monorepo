/**
 * Keel's footer: the logo with a one-line pitch and a status line, four columns of
 * links, and the legal row. Every link lands on a section of this page, so the demo
 * has no destination that answers 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { container, hstack, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, is, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { leading, text, weight } from "@sdxc/u/typography";
import { marketingContainer } from "@sdxc/ui/styles";

import { KeelLogo } from "~/resources/views/demos/saas/marks";

/** The named container the footer's columns read. */
const FOOTER = "keel-footer";

/** Each column's heading and its links, as label and in-page anchor. */
const COLUMNS = [
	[
		"Product",
		[
			["Metering", "#product"],
			["Pricing engine", "#workflow"],
			["Invoicing", "#workflow"],
			["Customer portal", "#platform"],
			["Changelog", "#top"],
		],
	],
	[
		"Developers",
		[
			["Quickstart", "#product"],
			["API reference", "#product"],
			["Webhooks", "#platform"],
			["Status", "#top"],
		],
	],
	[
		"Company",
		[
			["Customers", "#customers"],
			["Pricing", "#pricing"],
			["Security", "#security"],
			["Contact sales", "#start"],
		],
	],
	[
		"Legal",
		[
			["Terms", "#top"],
			["Privacy", "#top"],
			["DPA", "#security"],
			["Subprocessors", "#security"],
		],
	],
] as const;

/**
 * Renders the footer. The columns sit two by two on a phone, four abreast from `md`,
 * and beside the logo from `lg`.
 *
 * @returns The render function producing the footer.
 */
export function SaasFooter() {
	return () => (
		<footer
			mix={[
				container(FOOTER),
				raw({ borderBlockStart: "1px solid var(--ui-marketing-hairline)" }),
				p(16, 0, 10, 0),
			]}
		>
			<div mix={[marketingContainer(), vstack({ gap: 12, align: "stretch" })]}>
				<div
					mix={[
						raw({ display: "grid", gap: "3rem", gridTemplateColumns: "minmax(0, 1fr)" }),
						at("lg", FOOTER, raw({ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)" })),
					]}
				>
					<div mix={[vstack({ gap: 4, align: "start" })]}>
						<a href="#top" aria-label="Keel home" mix={[fg("neutral.emphasis")]}>
							<KeelLogo />
						</a>
						<p
							mix={[
								text("sm"),
								leading("relaxed"),
								fg("neutral"),
								raw({ maxInlineSize: "20rem", margin: 0 }),
							]}
						>
							Usage-based billing for API companies, from the first metered event to the paid
							invoice.
						</p>
						<a
							href="#top"
							mix={[
								hstack({ gap: 2, align: "center" }),
								text("sm"),
								fg("neutral"),
								hover(fg("neutral.emphasis")),
							]}
						>
							<span
								aria-hidden="true"
								mix={[
									is("0.5rem"),
									bs("0.5rem"),
									raw({ borderRadius: "9999px", backgroundColor: "var(--ui-success-bg-solid)" }),
								]}
							/>
							All systems normal
						</a>
					</div>
					<div
						mix={[
							raw({
								display: "grid",
								gap: "2.5rem 2rem",
								gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
							}),
							at("md", FOOTER, raw({ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" })),
						]}
					>
						{COLUMNS.map(([heading, links]) => (
							<nav key={heading} aria-label={heading} mix={[vstack({ gap: 4, align: "start" })]}>
								<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
									{heading}
								</span>
								<ul
									mix={[
										vstack({ gap: 3, align: "start" }),
										raw({ listStyle: "none", margin: 0, padding: 0 }),
									]}
								>
									{links.map(([label, href]) => (
										<li key={label}>
											<a
												href={href}
												mix={[text("sm"), fg("neutral"), hover(fg("neutral.emphasis"))]}
											>
												{label}
											</a>
										</li>
									))}
								</ul>
							</nav>
						))}
					</div>
				</div>
				<div
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							gap: "0.75rem 1.5rem",
							justifyContent: "space-between",
							paddingBlockStart: "2rem",
							borderBlockStart: "1px solid var(--ui-marketing-hairline)",
						}),
						text("xs"),
						fg("neutral.muted"),
					]}
				>
					<span>© 2026 Keel Billing, Inc. A demo product.</span>
					<span>SOC 2 Type II · ISO 27001 · GDPR</span>
				</div>
			</div>
		</footer>
	);
}
