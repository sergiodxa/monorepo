/**
 * Live preview island for `Logo`. A workspace switcher is where an app renders these:
 * one organization's mark at the top with its verified badge, then the row of marks a
 * member belongs to, trailed by a count. `imageFallback()` is wired on every image, and
 * one of them points at a URL that will not load, so the initials it falls back to show.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { hidden, hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Logo } from "@sdxc/ui";
import { imageFallback } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 5, align: "start" })]}>
	<div mix={[hstack({ gap: 3, align: "center" })]}>
		<Logo size="lg">
			<Logo.Image
				src="https://avatars.githubusercontent.com/u/1312099"
				alt="Remix"
				mix={[imageFallback(), when("&[data-image-error]", hidden())]}
			/>
			<Logo.Fallback>RX</Logo.Fallback>
			<Logo.Badge aria-label="Verified organization" />
		</Logo>
		<div mix={[vstack({ gap: 0.5, align: "start" })]}>
			<p mix={[m(0), text("sm"), weight("semibold")]}>Remix</p>
			<p mix={[m(0), text("xs"), fg("neutral.muted")]}>12 members · Pro plan</p>
		</div>
	</div>

	<Logo.Group>
		<Logo>
			<Logo.Image
				src="https://avatars.githubusercontent.com/u/1312099"
				alt="Remix"
				mix={[imageFallback(), when("&[data-image-error]", hidden())]}
			/>
			<Logo.Fallback>RX</Logo.Fallback>
		</Logo>
		<Logo>
			<Logo.Image
				src="https://example.com/missing-logo.png"
				alt="Acme Industries"
				mix={[imageFallback(), when("&[data-image-error]", hidden())]}
			/>
			<Logo.Fallback>AC</Logo.Fallback>
		</Logo>
		<Logo>
			<Logo.Fallback>SX</Logo.Fallback>
		</Logo>
		<Logo.Group.Count>+4</Logo.Group.Count>
	</Logo.Group>
</div>`;

/** A workspace switcher, hydrated so a failed image load is flagged and the initials take over. */
export const LogoPreview = clientEntry(
	"/resources/components/previews/logo.tsx#LogoPreview",
	function LogoPreview() {
		return () => (
			<div mix={[vstack({ gap: 5, align: "start" })]}>
				<div mix={[hstack({ gap: 3, align: "center" })]}>
					<Logo size="lg">
						<Logo.Image
							src="https://avatars.githubusercontent.com/u/1312099"
							alt="Remix"
							mix={[imageFallback(), when("&[data-image-error]", hidden())]}
						/>
						<Logo.Fallback>RX</Logo.Fallback>
						<Logo.Badge aria-label="Verified organization" />
					</Logo>
					<div mix={[vstack({ gap: 0.5, align: "start" })]}>
						<p mix={[m(0), text("sm"), weight("semibold"), fg("neutral.emphasis")]}>Remix</p>
						<p mix={[m(0), text("xs"), fg("neutral.muted")]}>12 members · Pro plan</p>
					</div>
				</div>

				<Logo.Group>
					<Logo>
						<Logo.Image
							src="https://avatars.githubusercontent.com/u/1312099"
							alt="Remix"
							mix={[imageFallback(), when("&[data-image-error]", hidden())]}
						/>
						<Logo.Fallback>RX</Logo.Fallback>
					</Logo>
					<Logo>
						<Logo.Image
							src="https://example.com/missing-logo.png"
							alt="Acme Industries"
							mix={[imageFallback(), when("&[data-image-error]", hidden())]}
						/>
						<Logo.Fallback>AC</Logo.Fallback>
					</Logo>
					<Logo>
						<Logo.Fallback>SX</Logo.Fallback>
					</Logo>
					<Logo.Group.Count>+4</Logo.Group.Count>
				</Logo.Group>
			</div>
		);
	},
);

export default { code: CODE, render: () => <LogoPreview /> };
