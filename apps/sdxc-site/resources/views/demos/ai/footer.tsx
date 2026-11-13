/**
 * Margin's footer: the wordmark and tagline, the page's links in four columns, and a legal
 * line that names the data processing terms, since a buyer looks for them here first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { SiteFooter } from "@sdxc/ui/landing";

import MarginLogo from "~/resources/views/demos/ai/logo";

/** The link columns: four, so a phone sets them two by two and a wide footer in one row. */
const COLUMNS: SiteFooter.Column[] = [
	{
		title: "Product",
		links: [
			{ href: "#sources", label: "How it works" },
			{ href: "#drafting", label: "Drafting" },
			{ href: "#integrations", label: "Integrations" },
		],
	},
	{
		title: "Trust",
		links: [
			{ href: "#privacy", label: "Privacy" },
			{ href: "#limits", label: "Known limits" },
			{ href: "/examples/margin/subprocessors", label: "Subprocessors" },
		],
	},
	{
		title: "Buying",
		links: [
			{ href: "#pricing", label: "Pricing" },
			{ href: "#faq", label: "Questions" },
			{ href: "/examples/margin/sign-up", label: "Start free" },
		],
	},
	{
		title: "Company",
		links: [
			{ href: "/examples/margin/about", label: "About" },
			{ href: "/examples/margin/security", label: "Security" },
			{ href: "/examples/margin/contact", label: "Contact" },
		],
	},
];

/**
 * Renders the footer pushed to the foot of the window on a short page.
 *
 * @returns The render function producing the footer.
 */
export default function MarginFooter() {
	return () => (
		<SiteFooter
			brand={<MarginLogo />}
			tagline="Meeting notes that cite their sources."
			columns={COLUMNS}
			legal={
				<p mix={[raw({ margin: "0" })]}>
					© 2026 Margin. Data processing terms and SOC 2 report on request.
				</p>
			}
			mix={[raw({ marginBlockStart: "auto" })]}
		/>
	);
}
