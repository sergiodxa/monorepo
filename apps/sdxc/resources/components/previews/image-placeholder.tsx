/**
 * Live preview island for `ImagePlaceholder`. The fallback shows through whenever the
 * image is absent, which the platform handles for an image that was never given a `src`;
 * an image that *fails* is the case CSS cannot see, so `imageFallback()` flags it — the
 * second member below points at a URL that does not resolve, and its initials take over
 * once the load fails. The third shows the presence badge, and the group collapses the
 * rest behind a count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Header, ImagePlaceholder, Item } from "@sdxc/ui";
import { imageFallback } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/**
 * A flat portrait drawn inline, so the two avatars that load need nothing from the
 * network and the preview reads the same offline.
 *
 * @param background - The plate colour behind the figure.
 * @param figure - The figure's own colour.
 * @returns A `data:` URL an `<img>` can load directly.
 */
function portrait(background: string, figure: string): string {
	let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${background}"/><circle cx="32" cy="24" r="12" fill="${figure}"/><path d="M8 64c4-14 12-20 24-20s20 6 24 20z" fill="${figure}"/></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The roster the panel lists, with one avatar deliberately pointing nowhere. */
const MEMBERS = [
	{
		id: "ana",
		name: "Ana Beltrán",
		role: "Design",
		initials: "AB",
		src: portrait("#c7d2fe", "#4f46e5"),
		online: false,
	},
	{
		id: "luis",
		name: "Luis Medina",
		role: "Platform",
		initials: "LM",
		// Nothing serves this, which is the failure imageFallback() exists for: the
		// element is present and has a src, so no CSS selector can tell it broke.
		src: "/images/team/missing-avatar.jpg",
		online: false,
	},
	{
		id: "priya",
		name: "Priya Raman",
		role: "Support",
		initials: "PR",
		src: portrait("#bbf7d0", "#15803d"),
		online: true,
	},
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const IMAGE_PLACEHOLDER_CODE = `<Header>Project members</Header>

{MEMBERS.map((member) => (
	<Item key={member.id}>
		<Item.Media>
			<ImagePlaceholder>
				<ImagePlaceholder.Image
					src={member.src}
					alt={member.name}
					mix={[imageFallback()]}
				/>
				<ImagePlaceholder.Fallback>{member.initials}</ImagePlaceholder.Fallback>
				{member.online ? <ImagePlaceholder.Badge /> : null}
			</ImagePlaceholder>
		</Item.Media>
		<Item.Content>
			<Item.Title>{member.name}</Item.Title>
			<Item.Description>{member.role}</Item.Description>
		</Item.Content>
	</Item>
))}

<Header>Everyone on the project</Header>
<ImagePlaceholder.Group>
	{MEMBERS.map((member) => (
		<ImagePlaceholder key={member.id} size="sm">
			<ImagePlaceholder.Image src={member.src} alt={member.name} mix={[imageFallback()]} />
			<ImagePlaceholder.Fallback>{member.initials}</ImagePlaceholder.Fallback>
		</ImagePlaceholder>
	))}
	<ImagePlaceholder.GroupCount>+7</ImagePlaceholder.GroupCount>
</ImagePlaceholder.Group>`;

/** A member roster, hydrated so a failed avatar falls back to its initials. */
export const ImagePlaceholderPreview = clientEntry(
	import.meta.url,
	function ImagePlaceholderPreview() {
		return () => (
			<div mix={[vstack({ gap: 4, align: "stretch" }), is("24rem")]}>
				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Header>Project members</Header>
					{MEMBERS.map((member) => (
						<Item key={member.id}>
							<Item.Media>
								<ImagePlaceholder>
									<ImagePlaceholder.Image
										src={member.src}
										alt={member.name}
										mix={[imageFallback()]}
									/>
									<ImagePlaceholder.Fallback>{member.initials}</ImagePlaceholder.Fallback>
									{member.online ? <ImagePlaceholder.Badge /> : null}
								</ImagePlaceholder>
							</Item.Media>
							<Item.Content>
								<Item.Title>{member.name}</Item.Title>
								<Item.Description>{member.role}</Item.Description>
							</Item.Content>
						</Item>
					))}
				</div>

				<div mix={[vstack({ gap: 2, align: "start" })]}>
					<Header>Everyone on the project</Header>
					<ImagePlaceholder.Group>
						{MEMBERS.map((member) => (
							<ImagePlaceholder key={member.id} size="sm">
								<ImagePlaceholder.Image
									src={member.src}
									alt={member.name}
									mix={[imageFallback()]}
								/>
								<ImagePlaceholder.Fallback>{member.initials}</ImagePlaceholder.Fallback>
							</ImagePlaceholder>
						))}
						<ImagePlaceholder.GroupCount>+7</ImagePlaceholder.GroupCount>
					</ImagePlaceholder.Group>
				</div>

				<span mix={[text("xs"), weight("normal"), fg("neutral")]}>
					Luis&rsquo; avatar points at a file nothing serves, so his initials take over once the
					load fails — the case only a script can notice.
				</span>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: IMAGE_PLACEHOLDER_CODE, render: () => <ImagePlaceholderPreview /> };
