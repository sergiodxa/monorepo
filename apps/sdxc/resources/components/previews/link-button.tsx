/**
 * Live preview island for `LinkButton`. Buttons that navigate turn up in pairs, so the
 * preview is the two rows an app actually renders them in: an empty state's primary and
 * secondary calls to action, then a toolbar mixing a download, a size step up, and an
 * anchor turned off through `aria-disabled` rather than losing its `href`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DownloadIcon, PlusIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { LinkButton } from "@sdxc/ui";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 5, align: "center" })]}>
	<p mix={[m(0), text("sm"), weight("medium")]}>No projects yet</p>

	<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
		<LinkButton href="/projects/new">
			<PlusIcon />
			Create project
		</LinkButton>
		<LinkButton href="/api/ui" color="neutral" variant="outline">
			Read the docs
		</LinkButton>
		<LinkButton href="/projects" color="neutral" variant="ghost">
			Cancel
		</LinkButton>
	</div>

	<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
		<LinkButton href="/export/projects.csv" download size="sm" color="neutral" variant="outline">
			<DownloadIcon />
			Export CSV
		</LinkButton>
		<LinkButton href="/billing/upgrade" size="lg" color="success">
			Upgrade plan
		</LinkButton>
		<LinkButton href="/settings/transfer" variant="outline" aria-disabled="true">
			Transfer ownership
		</LinkButton>
	</div>
</div>`;

/** Two rows of navigating buttons, hydrated so the page loads this example's chunk alone. */
export const LinkButtonPreview = clientEntry(
	"/resources/components/previews/link-button.tsx#LinkButtonPreview",
	function LinkButtonPreview() {
		return () => (
			<div mix={[vstack({ gap: 5, align: "center" })]}>
				<p mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>No projects yet</p>

				<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
					<LinkButton href="/projects/new">
						<PlusIcon />
						Create project
					</LinkButton>
					<LinkButton href="/api/ui" color="neutral" variant="outline">
						Read the docs
					</LinkButton>
					<LinkButton href="/projects" color="neutral" variant="ghost">
						Cancel
					</LinkButton>
				</div>

				<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
					<LinkButton
						href="/export/projects.csv"
						download
						size="sm"
						color="neutral"
						variant="outline"
					>
						<DownloadIcon />
						Export CSV
					</LinkButton>
					<LinkButton href="/billing/upgrade" size="lg" color="success">
						Upgrade plan
					</LinkButton>
					<LinkButton href="/settings/transfer" variant="outline" aria-disabled="true">
						Transfer ownership
					</LinkButton>
				</div>
			</div>
		);
	},
);

export default { code: CODE, render: () => <LinkButtonPreview /> };
