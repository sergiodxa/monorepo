/**
 * Live preview for `StoryViewer`: two people's stories inside a phone-sized box rather than
 * the whole window. The bars fill and move on, a tap on either side steps, a hold pauses and
 * a sideways swipe moves to the next person; the close link would leave the viewer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { StoryViewer } from "@sdxc/ui/video";

/** The source the page shows, matching the markup below apart from the drawn pictures. */
const CODE = `<StoryViewer label="Stories" closeHref="/" labels={{ close: "Close", pause: "Pause" }}>
	{people.map((person, index) => (
		<StoryViewer.Group
			label={\`\${person.name}'s story\`}
			durations={person.segments.map(() => 5)}
			current={0}
			active={index === 0}
			previousHref={person.previousHref}
			nextHref={person.segments[1]?.href ?? person.nextHref}
			labels={{ previous: "Previous", next: "Next" }}
			header={<p>{person.handle}</p>}
		>
			{person.segments.map((segment, position) => (
				<StoryViewer.Segment href={segment.href} current={position === 0}>
					<img src={segment.photo} alt={segment.alt} />
				</StoryViewer.Segment>
			))}
		</StoryViewer.Group>
	))}
</StoryViewer>`;

/** Two people, each with a few segments drawn as gradients of their hues. */
const PEOPLE = [
	{ handle: "mara.quint", hues: [40, 25, 55] },
	{ handle: "teo.lind", hues: [220, 200] },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					"--ui-story-viewer-position": "absolute",
					"--ui-story-viewer-height": "30rem",
					"--ui-story-viewer-z": "1",
					position: "relative",
					inlineSize: "100%",
					maxInlineSize: "17rem",
					blockSize: "30rem",
					marginInline: "auto",
					overflow: "hidden",
					borderRadius: "0.75rem",
				}),
			]}
		>
			<StoryViewer
				label="Stories"
				closeHref="#story-viewer"
				labels={{ close: "Close", pause: "Pause" }}
			>
				{PEOPLE.map((person, index) => {
					let hrefs = person.hues.map((_, position) => `#${person.handle}-${position + 1}`);
					return (
						<StoryViewer.Group
							label={`${person.handle}'s story`}
							durations={person.hues.map(() => 5)}
							current={0}
							active={index === 0}
							previousHref={index === 0 ? "#story-viewer" : `#${PEOPLE[0]!.handle}-3`}
							nextHref={hrefs[1] ?? "#story-viewer"}
							labels={{ previous: "Previous", next: "Next" }}
							header={
								<p mix={[raw({ margin: "0", fontSize: "0.875rem", fontWeight: "650" })]}>
									{person.handle}
								</p>
							}
						>
							{person.hues.map((hue, position) => (
								<StoryViewer.Segment href={hrefs[position]!} current={position === 0}>
									<span
										mix={[
											raw({
												display: "block",
												background: `linear-gradient(170deg, oklch(0.82 0.09 ${hue}), oklch(0.42 0.12 ${hue + 20}))`,
											}),
										]}
									/>
								</StoryViewer.Segment>
							))}
						</StoryViewer.Group>
					);
				})}
			</StoryViewer>
		</div>
	),
};
