/**
 * Live preview for `Equalizer`: the playing mark at three sizes in the brand color, bouncing
 * as music plays, and one inside a `[data-audio-paused]` box, held still the way a paused
 * player leaves every mark on the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Equalizer } from "@sdxc/ui/audio";

/** The source the page shows. */
const CODE = `<Equalizer label="Now playing" />

<div data-audio-paused>
	<Equalizer label="Paused" />
</div>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					display: "flex",
					alignItems: "flex-end",
					gap: "2rem",
					color: "var(--ui-brand-fg)",
				}),
			]}
		>
			<Equalizer label="Now playing" mix={[raw({ fontSize: "1rem" })]} />
			<Equalizer label="Now playing" mix={[raw({ fontSize: "1.5rem" })]} />
			<Equalizer label="Now playing" mix={[raw({ fontSize: "2.5rem" })]} />
			<span
				data-audio-paused=""
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						gap: "0.5rem",
						color: "var(--ui-neutral-fg-muted)",
						fontSize: "0.875rem",
					}),
				]}
			>
				<Equalizer label="Paused" mix={[raw({ fontSize: "2.5rem" })]} />
				Paused
			</span>
		</div>
	),
};
