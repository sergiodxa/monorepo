/**
 * Live preview for `StoryRing`: a tray of three people, two with a story not yet watched in
 * the bright ring and one already seen in the quiet one, each a drawn avatar of two hues.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { StoryRing } from "@sdxc/ui/video";

/** The source the page shows, matching the markup below apart from the drawn avatars. */
const CODE = `<ul>
	{people.map((person) => (
		<li>
			<a href={person.story}>
				<StoryRing seen={person.seen} size={4}>
					<img src={person.avatar} alt="" />
				</StoryRing>
				{person.handle}
			</a>
		</li>
	))}
</ul>`;

/** The people in the tray: a handle, two hues and whether their story was watched. */
const PEOPLE = [
	{ handle: "mara.quint", hues: [40, 18], seen: false },
	{ handle: "teo.lind", hues: [225, 190], seen: false },
	{ handle: "kai.on.rock", hues: [250, 150], seen: true },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<ul
			mix={[raw({ display: "flex", gap: "1.25rem", margin: "0", padding: "0", listStyle: "none" })]}
		>
			{PEOPLE.map((person) => (
				<li>
					<a
						href={`#${person.handle}`}
						mix={[
							raw({
								display: "grid",
								justifyItems: "center",
								gap: "0.375rem",
								color: "inherit",
								textDecoration: "none",
								fontSize: "0.75rem",
							}),
						]}
					>
						<StoryRing seen={person.seen} size={4}>
							<span
								mix={[
									raw({
										background: `radial-gradient(circle at 30% 25%, oklch(0.86 0.1 ${person.hues[0]}), oklch(0.58 0.14 ${person.hues[1]}))`,
									}),
								]}
							/>
						</StoryRing>
						{person.handle}
					</a>
				</li>
			))}
		</ul>
	),
};
