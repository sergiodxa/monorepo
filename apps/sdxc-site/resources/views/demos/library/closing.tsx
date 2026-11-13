/**
 * The closing call: the install line again with the quickstart beside it, on an inset
 * lime-edged panel, so the page ends on the one command a reader came for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LinkButton } from "@sdxc/ui";
import { ClosingCta } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import { InstallLine } from "~/resources/views/demos/library/install-line";

/**
 * Renders the band. Its install line is a second radio group, so it switches apart from
 * the hero's.
 *
 * @returns The render function producing the band.
 */
export function ClosingBand() {
	return () => (
		<ClosingCta
			id="start"
			tone="tinted"
			inset
			title="Validate your first request body"
			description="Install plumb, write the schema you already have in your head, and read the function it compiles to. Five minutes, no account, MIT."
			actions={
				<InstallLine
					name="plumb-install-closing"
					align="center"
					after={
						<LinkButton href="#docs" color="brand" mix={[landingCtaChrome()]}>
							Read the quickstart
						</LinkButton>
					}
				/>
			}
		/>
	);
}
