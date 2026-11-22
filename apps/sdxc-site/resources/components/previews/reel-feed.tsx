/**
 * Live preview for `ReelFeed`: four reels in a phone-sized box, one per screen on vertical
 * scroll snap; with script, the reel in view plays, the next one loads ahead, and the arrow
 * keys and the wheel step one reel at a time. Each reel plays a transparent clip over a gradient.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { ReelFeed } from "@sdxc/ui/video";

import routes from "~/routes/web";

/** The source the page shows, matching the markup below apart from the drawn backdrops. */
const CODE = `<ReelFeed label="Reels" followAddress prefetchTarget="main">
	{reels.map((reel, index) => (
		<ReelFeed.Item
			href={\`/reels/\${reel.id}\`}
			label={\`Reel by \${reel.author}\`}
			offset={index - current}
			loopAt={reel.seconds}
			sources={[{ src: reel.webm, type: "video/webm" }]}
			labels={{ pause: "Pause" }}
		>
			<p>{reel.caption}</p>
		</ReelFeed.Item>
	))}
</ReelFeed>`;

/** The reels: who made each, its caption and the hue of its backdrop. */
const REELS = [
	{ author: "mara.quint", caption: "Throwing the two halves of a moon jar.", hue: 40 },
	{ author: "teo.lind", caption: "Ninety minutes of harbour fog in twenty seconds.", hue: 225 },
	{ author: "ines.bakes", caption: "Scoring, one cut each, no second chances.", hue: 65 },
	{ author: "ola.surfs", caption: "Seven degrees and you chose this.", hue: 195 },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					"--ui-reel-feed-height": "30rem",
					"--ui-reel-feed-radius": "0.75rem",
					inlineSize: "100%",
					maxInlineSize: "17rem",
					marginInline: "auto",
				}),
			]}
		>
			<ReelFeed label="Reels">
				{REELS.map((reel, index) => (
					<ReelFeed.Item
						href={`#reel-${index + 1}`}
						label={`Reel by ${reel.author}`}
						offset={index}
						loopAt={20}
						sources={[
							{
								src: routes.showcase.media.href({ file: "video/lesson.webm" }),
								type: "video/webm",
							},
							{ src: routes.showcase.media.href({ file: "video/lesson.mp4" }), type: "video/mp4" },
						]}
						backdrop={
							<span
								mix={[
									raw({
										display: "block",
										blockSize: "100%",
										background: `linear-gradient(160deg, oklch(0.8 0.08 ${reel.hue}), oklch(0.4 0.1 ${reel.hue + 30}))`,
									}),
								]}
							/>
						}
						labels={{ pause: "Pause" }}
					>
						<p
							mix={[
								raw({
									position: "absolute",
									insetInline: "0",
									insetBlockEnd: "0",
									margin: "0",
									padding: "3rem 1rem 1rem",
									background: "linear-gradient(transparent, rgb(0 0 0 / 0.55))",
									color: "oklch(0.99 0 0)",
									fontSize: "0.875rem",
									lineHeight: "1.4",
								}),
							]}
						>
							<strong>{reel.author}</strong>
							<br />
							{reel.caption}
						</p>
					</ReelFeed.Item>
				))}
			</ReelFeed>
		</div>
	),
};
