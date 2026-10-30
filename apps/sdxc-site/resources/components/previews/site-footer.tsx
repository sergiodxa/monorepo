/**
 * Live preview for `SiteFooter`: a product footer with a newsletter form in the brand
 * column, five link columns, social icons, the legal row and a brand wordmark that closes
 * the page. The phone layout stacks the brand block and pairs the columns two by two.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MailIcon, MessagesSquareIcon, RssIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { Button, HeadingScope, Input } from "@sdxc/ui";
import { SiteFooter } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<SiteFooter
	brand={<a href="/" aria-label="Keel home"><KeelLogo /></a>}
	tagline="Usage-based billing for API companies, from the first metered event to the paid invoice."
	newsletter={
		<form action="/newsletter" method="post">
			<label>
				<span mix={[visuallyHidden()]}>Email address</span>
				<Input type="email" name="email" placeholder="you@company.com" required />
			</label>
			<Button type="submit" color="neutral">Subscribe</Button>
		</form>
	}
	columns={[
		{ title: "Product", links: [{ label: "Metering", href: "/metering" }, …] },
		{ title: "Developers", links: […] },
		{ title: "Company", links: […] },
		{ title: "Resources", links: […] },
		{ title: "Legal", links: […] },
	]}
	social={
		<>
			<a href="/community" aria-label="Community forum"><MessagesSquareIcon /></a>
			<a href="/feed.xml" aria-label="RSS feed"><RssIcon /></a>
			<a href="mailto:hello@keel.dev" aria-label="Email us"><MailIcon /></a>
		</>
	}
	legal={
		<>
			<p>© 2026 Keel, Inc.</p>
			<a href="/privacy">Privacy</a>
			<a href="/terms">Terms</a>
		</>
	}
	wordmark={<KeelWordmark />}
/>`;

/** The five link columns a product footer carries. */
const COLUMNS: SiteFooter.Column[] = [
	{
		title: "Product",
		links: [
			{ label: "Metering", href: "#metering" },
			{ label: "Pricing engine", href: "#pricing-engine" },
			{ label: "Invoicing", href: "#invoicing" },
			{ label: "Customer portal", href: "#portal" },
			{ label: "Changelog", href: "#changelog" },
		],
	},
	{
		title: "Developers",
		links: [
			{ label: "Quickstart", href: "#quickstart" },
			{ label: "API reference", href: "#api" },
			{ label: "Webhooks", href: "#webhooks" },
			{ label: "Status", href: "#status" },
		],
	},
	{
		title: "Company",
		links: [
			{ label: "About", href: "#about" },
			{ label: "Customers", href: "#customers" },
			{ label: "Careers", href: "#careers" },
			{ label: "Contact sales", href: "#sales" },
		],
	},
	{
		title: "Resources",
		links: [
			{ label: "Blog", href: "#blog" },
			{ label: "Guides", href: "#guides" },
			{ label: "Billing glossary", href: "#glossary" },
		],
	},
	{
		title: "Legal",
		links: [
			{ label: "Terms", href: "#terms" },
			{ label: "Privacy", href: "#privacy" },
			{ label: "DPA", href: "#dpa" },
			{ label: "Subprocessors", href: "#subprocessors" },
		],
	},
];

/** What the preview registry reads: the source to show, and the footer to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<SiteFooter
				brand={
					<a
						href="#top"
						aria-label="Keel home"
						mix={[
							raw({
								display: "inline-flex",
								alignItems: "center",
								gap: "0.5rem",
								fontSize: "1.125rem",
								fontWeight: "600",
								color: "inherit",
								textDecoration: "none",
							}),
						]}
					>
						<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
							<rect width="24" height="24" rx="6" fill="var(--ui-brand-bg-solid)" />
							<path d="M7 6v12M7 12l9-6M7 12l9 6" stroke="white" stroke-width="2.5" fill="none" />
						</svg>
						Keel
					</a>
				}
				tagline="Usage-based billing for API companies, from the first metered event to the paid invoice."
				newsletter={
					<form
						action="#newsletter"
						mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" })]}
					>
						<label mix={[raw({ display: "flex", flex: "1 1 12rem", minInlineSize: "0" })]}>
							<span mix={[visuallyHidden()]}>Email address</span>
							<Input
								type="email"
								name="email"
								placeholder="you@company.com"
								required
								mix={[raw({ flex: "1", minInlineSize: "0" })]}
							/>
						</label>
						<Button type="submit" color="neutral">
							Subscribe
						</Button>
					</form>
				}
				columns={COLUMNS}
				social={
					<>
						<a href="#community" aria-label="Community forum">
							<MessagesSquareIcon />
						</a>
						<a href="#feed" aria-label="RSS feed">
							<RssIcon />
						</a>
						<a href="#contact" aria-label="Email us">
							<MailIcon />
						</a>
					</>
				}
				legal={
					<>
						<p>© 2026 Keel, Inc.</p>
						<a href="#privacy">Privacy</a>
						<a href="#terms">Terms</a>
						<a href="#cookies">Cookies</a>
					</>
				}
				wordmark={
					<svg viewBox="0 0 400 110">
						<text
							x="200"
							y="100"
							text-anchor="middle"
							font-size="140"
							font-weight="700"
							letter-spacing="-8"
							fill="currentColor"
						>
							keel
						</text>
					</svg>
				}
			/>
		</HeadingScope>
	),
};
