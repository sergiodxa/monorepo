/**
 * Live example for a floating `SiteHeader`: a rounded bar held off the page edges, the
 * width of the content measure, with plain links only, so it switches to the inline
 * navigation from the `lg` container.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { SiteHeader } from "@sdxc/ui/patterns";

import { BeaconLogo } from "~/resources/components/previews/site-header";

/** The source the page shows, matching the markup below. */
const CODE = `<SiteHeader
	variant="floating"
	collapseAt="lg"
	brand={<a href="/" aria-label="Beacon home"><BeaconLogo /></a>}
	items={[
		{ label: "Features", href: "/features" },
		{ label: "Pricing", href: "/pricing", current: true },
		{ label: "Changelog", href: "/changelog" },
	]}
	actions={[{ label: "Log in", href: "/login" }]}
	cta={{ label: "Start free", href: "/signup" }}
/>`;

/** What the preview registry reads: the title, the source to show, and the header to draw. */
export default {
	title: "Floating, with plain links",
	code: CODE,
	flush: true,
	viewports: true,
	render: () => (
		<SiteHeader
			variant="floating"
			collapseAt="lg"
			brand={
				<a href="#top" aria-label="Beacon home" mix={[fg("neutral.emphasis")]}>
					<BeaconLogo />
				</a>
			}
			items={[
				{ label: "Features", href: "#features" },
				{ label: "Pricing", href: "#pricing", current: true },
				{ label: "Changelog", href: "#changelog" },
			]}
			actions={[{ label: "Log in", href: "#login" }]}
			cta={{ label: "Start free", href: "#signup" }}
		/>
	),
};
