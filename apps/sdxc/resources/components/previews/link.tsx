/**
 * Live preview island for `Link`. An inline anchor only reads correctly inside running
 * text, so the preview is a short run of prose: navigational links in a sentence, an
 * external one carrying its own `rel`, a destructive one in the danger role, and one
 * turned off through `aria-disabled` while staying in the flow of the sentence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m, maxIs } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Link } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<div mix={[vstack({ gap: 3, align: "stretch" })]}>
	<p mix={[m(0), text("sm"), fg("neutral")]}>
		Every package is published to npm and documented here — start with the{" "}
		<Link href="/api/ui">component catalogue</Link>, or read the{" "}
		<Link href="/docs">guides</Link> if you are wiring one up for the first time.
	</p>

	<p mix={[m(0), text("sm"), fg("neutral")]}>
		The source lives on{" "}
		<Link href="https://github.com/sergiodxa" target="_blank" rel="noreferrer">
			GitHub
		</Link>
		, and release notes land in the changelog.
	</p>

	<p mix={[m(0), text("sm"), fg("neutral")]}>
		Removing a workspace takes its members and history with it:{" "}
		<Link href="/settings/danger" color="danger">
			delete this workspace
		</Link>
		.
	</p>

	<p mix={[m(0), text("sm"), fg("neutral")]}>
		<Link href="/settings/transfer" aria-disabled="true">
			Transferring ownership
		</Link>{" "}
		needs a second owner on the account.
	</p>
</div>`;

/** A paragraph run of inline links, hydrated so the page loads this example's chunk alone. */
export const LinkPreview = clientEntry(import.meta.url, function LinkPreview() {
	return () => (
		<div mix={[vstack({ gap: 3, align: "stretch" }), maxIs("34rem")]}>
			<p mix={[m(0), text("sm"), fg("neutral")]}>
				Every package is published to npm and documented here — start with the{" "}
				<Link href="/api/ui">component catalogue</Link>, or read the{" "}
				<Link href="/docs">guides</Link> if you are wiring one up for the first time.
			</p>

			<p mix={[m(0), text("sm"), fg("neutral")]}>
				The source lives on{" "}
				<Link href="https://github.com/sergiodxa" target="_blank" rel="noreferrer">
					GitHub
				</Link>
				, and release notes land in the changelog.
			</p>

			<p mix={[m(0), text("sm"), fg("neutral")]}>
				Removing a workspace takes its members and history with it:{" "}
				<Link href="/settings/danger" color="danger">
					delete this workspace
				</Link>
				.
			</p>

			<p mix={[m(0), text("sm"), fg("neutral")]}>
				<Link href="/settings/transfer" aria-disabled="true">
					Transferring ownership
				</Link>{" "}
				needs a second owner on the account.
			</p>
		</div>
	);
});

export default { code: CODE, render: () => <LinkPreview /> };
