/**
 * Plumb's sticky bar: the logo, the page's sections as in-page links, the repository's
 * star count and the primary action. Below the `lg` container the links move into the
 * header's phone sheet, which closes itself when a link scrolls the page to its section.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { StarIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { DialogDismiss } from "@sdxc/ui";
import { SiteHeader } from "@sdxc/ui/landing";

import { REPO } from "~/resources/views/demos/library/data";
import { PlumbLogo } from "~/resources/views/demos/library/logo";

/** The in-page destinations, in reading order. */
const ITEMS: SiteHeader.Link[] = [
	{ label: "Docs", href: "#docs" },
	{ label: "Benchmarks", href: "#benchmarks" },
	{ label: "Changelog", href: "#changelog" },
	{ label: "Sponsor", href: "#sponsors" },
];

/**
 * Renders the bar. The star count is a quiet action beside the primary one, set in
 * tabular mono, so it reads as a figure rather than a second button to press.
 *
 * @returns The render function producing the header.
 */
export function LibraryHeader() {
	return () => (
		<SiteHeader
			id="plumb-header"
			collapseAt="lg"
			brand={
				<a href="#top" aria-label="plumb home" mix={[fg("neutral.emphasis")]}>
					<PlumbLogo />
				</a>
			}
			items={ITEMS}
			actions={[
				{
					label: (
						<span
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.375rem",
									fontVariantNumeric: "tabular-nums",
								}),
							]}
						>
							<StarIcon aria-hidden="true" mix={[raw({ inlineSize: "1em", blockSize: "1em" })]} />
							{REPO.stars}
							<span mix={[visuallyHidden()]}>stars on GitHub</span>
						</span>
					),
					href: "#community",
				},
			]}
			cta={{ label: "Get started", href: "#docs" }}
			sheet={<DialogDismiss />}
		/>
	);
}
