/**
 * Keel's sticky bar: the logo, the page's chapters as in-page links, sign-in and the
 * primary action. Below the `xl` container the links move into the header's phone sheet,
 * which closes itself when a link scrolls the page to its chapter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { SiteHeader } from "@sdxc/ui/patterns";

import { DrawerDismiss } from "~/resources/components/drawer-dismiss";
import { KeelLogo } from "~/resources/views/demos/saas/marks";

/** The in-page destinations, in reading order; each lands on a chapter of this page. */
const ITEMS: SiteHeader.Link[] = [
	{ label: "Product", href: "#product" },
	{ label: "Workflow", href: "#workflow" },
	{ label: "Platform", href: "#platform" },
	{ label: "Changelog", href: "#changelog" },
	{ label: "Pricing", href: "#pricing" },
];

/**
 * Renders the bar. Five links and both actions fit beside the logo from the `xl`
 * container; below it the sheet carries them, so no label ever wraps in the bar.
 *
 * @returns The render function producing the header.
 */
export function SaasHeader() {
	return () => (
		<SiteHeader
			collapseAt="xl"
			brand={
				<a href="#top" aria-label="Keel home" mix={[fg("neutral.emphasis")]}>
					<KeelLogo />
				</a>
			}
			items={ITEMS}
			actions={[{ label: "Sign in", href: "#pricing" }]}
			cta={{ label: "Start free", href: "#start" }}
			sheet={<DrawerDismiss />}
		/>
	);
}
