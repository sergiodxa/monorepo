/**
 * Live preview island for `Avatar`. The component draws the circular host, its two
 * absolutely positioned layers and the overlap a group reads as; both layers fill the
 * host, so the initials come first and the portrait paints over them. Noticing that a
 * portrait failed and hiding it again is the consumer's to apply, so every image here
 * carries the same `imageFallback()` wiring and `data-image-error` rule a reader would
 * write. The last reviewer's portrait points at nothing, which is what makes it visible.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { hidden, hstack, vstack } from "@sdxc/u/layout";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Avatar } from "@sdxc/ui";
import { imageFallback } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** Portraits drawn as data URIs, so a reviewer row fetches nothing to render. */
const PORTRAITS = {
	ana: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%236366f1'/%3E%3Ccircle cx='4' cy='3' r='1.5' fill='%23fff'/%3E%3Cpath d='M1 8a3 3 0 0 1 6 0z' fill='%23fff'/%3E%3C/svg%3E",
	bruno:
		"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%2316a34a'/%3E%3Ccircle cx='4' cy='3' r='1.5' fill='%23fff'/%3E%3Cpath d='M1 8a3 3 0 0 1 6 0z' fill='%23fff'/%3E%3C/svg%3E",
	chen: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%23db2777'/%3E%3Ccircle cx='4' cy='3' r='1.5' fill='%23fff'/%3E%3Cpath d='M1 8a3 3 0 0 1 6 0z' fill='%23fff'/%3E%3C/svg%3E",
};

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 5, align: "start" })]}>
	<div mix={[hstack({ gap: 3, align: "center" })]}>
		<Avatar size="lg">
			<Avatar.Fallback>AS</Avatar.Fallback>
			<Avatar.Image
				src={PORTRAITS.ana}
				alt="Ana Souza"
				mix={[imageFallback(), when("&[data-image-error]", hidden())]}
			/>
			<Avatar.Badge />
		</Avatar>
		<div mix={[vstack({ gap: 0, align: "start" })]}>
			<span mix={[text("sm"), weight("medium")]}>Ana Souza</span>
			<span mix={[text("xs"), fg("neutral")]}>Reviewing · online</span>
		</div>
	</div>

	<div mix={[vstack({ gap: 2, align: "start" })]}>
		<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Reviewers</span>
		<Avatar.Group aria-label="Four reviewers, three more not shown">
			<Avatar>
				<Avatar.Fallback>BL</Avatar.Fallback>
				<Avatar.Image
					src={PORTRAITS.bruno}
					alt="Bruno Lima"
					mix={[imageFallback(), when("&[data-image-error]", hidden())]}
				/>
			</Avatar>
			<Avatar>
				<Avatar.Fallback>CW</Avatar.Fallback>
				<Avatar.Image
					src={PORTRAITS.chen}
					alt="Chen Wei"
					mix={[imageFallback(), when("&[data-image-error]", hidden())]}
				/>
			</Avatar>
			<Avatar>
				<Avatar.Fallback>DK</Avatar.Fallback>
			</Avatar>
			<Avatar>
				<Avatar.Fallback>EM</Avatar.Fallback>
				<Avatar.Image
					src="/portraits/erin-moss.jpg"
					alt="Erin Moss"
					mix={[imageFallback(), when("&[data-image-error]", hidden())]}
				/>
			</Avatar>
			<Avatar.Group.Count>+3</Avatar.Group.Count>
		</Avatar.Group>
	</div>
</div>`;

/** A reviewer row whose last portrait is missing, hydrated so the initials take its place. */
export const AvatarPreview = clientEntry(
	"/resources/components/previews/avatar.tsx#AvatarPreview",
	function AvatarPreview() {
		return () => (
			<div mix={[vstack({ gap: 5, align: "start" })]}>
				<div mix={[hstack({ gap: 3, align: "center" })]}>
					<Avatar size="lg">
						<Avatar.Fallback>AS</Avatar.Fallback>
						<Avatar.Image
							src={PORTRAITS.ana}
							alt="Ana Souza"
							mix={[imageFallback(), when("&[data-image-error]", hidden())]}
						/>
						<Avatar.Badge />
					</Avatar>
					<div mix={[vstack({ gap: 0, align: "start" })]}>
						<span mix={[text("sm"), weight("medium")]}>Ana Souza</span>
						<span mix={[text("xs"), fg("neutral")]}>Reviewing · online</span>
					</div>
				</div>

				<div mix={[vstack({ gap: 2, align: "start" })]}>
					<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Reviewers</span>
					<Avatar.Group aria-label="Four reviewers, three more not shown">
						<Avatar>
							<Avatar.Fallback>BL</Avatar.Fallback>
							<Avatar.Image
								src={PORTRAITS.bruno}
								alt="Bruno Lima"
								mix={[imageFallback(), when("&[data-image-error]", hidden())]}
							/>
						</Avatar>
						<Avatar>
							<Avatar.Fallback>CW</Avatar.Fallback>
							<Avatar.Image
								src={PORTRAITS.chen}
								alt="Chen Wei"
								mix={[imageFallback(), when("&[data-image-error]", hidden())]}
							/>
						</Avatar>
						<Avatar>
							<Avatar.Fallback>DK</Avatar.Fallback>
						</Avatar>
						<Avatar>
							<Avatar.Fallback>EM</Avatar.Fallback>
							<Avatar.Image
								src="/portraits/erin-moss.jpg"
								alt="Erin Moss"
								mix={[imageFallback(), when("&[data-image-error]", hidden())]}
							/>
						</Avatar>
						<Avatar.Group.Count>+3</Avatar.Group.Count>
					</Avatar.Group>
				</div>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <AvatarPreview /> };
