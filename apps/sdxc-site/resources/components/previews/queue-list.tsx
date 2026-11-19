/**
 * Live preview for `QueueList`: a queue panel's "Now playing" section with the playing track
 * marked, over "Next up" with three tracks, each row a button that jumps to it. The covers
 * are drawn gradients.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { QueueList } from "@sdxc/ui/audio";

/** The source the page shows. */
const CODE = `<QueueList.Section title="Now playing">
	<QueueList.Item current title="Last Train Bloom" subtitle="Neon Orchard" duration={242} />
</QueueList.Section>
<QueueList.Section title="Next up" empty="Nothing else queued">
	<QueueList.Item
		title="Zest"
		subtitle="Neon Orchard"
		duration={175}
		action={<button type="button" aria-label="Play Zest" />}
	/>
</QueueList.Section>`;

/** A gradient standing in for a cover. */
function Art(handle: Handle<{ hue: number }>) {
	return () => (
		<span
			mix={[
				raw({
					background: `linear-gradient(150deg, oklch(0.35 0.1 ${handle.props.hue}), oklch(0.7 0.15 ${handle.props.hue + 40}))`,
				}),
			]}
		/>
	);
}

/** The queued tracks. */
const NEXT = [
	{ title: "Zest", subtitle: "Neon Orchard", duration: 175, hue: 330 },
	{
		title: "Sugar & Static",
		subtitle: "Neon Orchard, Velvet Cartography",
		duration: 207,
		hue: 300,
	},
	{ title: "Grove at 2AM", subtitle: "Neon Orchard", duration: 229, hue: 20 },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ display: "grid", gap: "1.25rem", inlineSize: "min(100%, 22rem)" })]}>
			<QueueList.Section title="Now playing">
				{[
					<QueueList.Item
						current
						title="Last Train Bloom"
						subtitle="Neon Orchard"
						duration={242}
						art={<Art hue={330} />}
					/>,
				]}
			</QueueList.Section>
			<QueueList.Section title="Next up" empty="Nothing else queued">
				{NEXT.map((track) => (
					<QueueList.Item
						title={track.title}
						subtitle={track.subtitle}
						duration={track.duration}
						art={<Art hue={track.hue} />}
						action={<button type="button" aria-label={`Play ${track.title}`} />}
					/>
				))}
			</QueueList.Section>
		</div>
	),
};
