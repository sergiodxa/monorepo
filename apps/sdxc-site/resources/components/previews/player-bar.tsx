/**
 * Live preview for `PlayerBar`: the desktop bar with a track part way through, shuffle on,
 * the seek bar and the volume, over `PlayerBar.Mini`, the phone's form with its hairline of
 * progress. The parts draw; a player island drives them on a real page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	ListMusicIcon,
	PauseIcon,
	RepeatIcon,
	ShuffleIcon,
	SkipBackIcon,
	SkipForwardIcon,
	Volume2Icon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { PlayerBar } from "@sdxc/ui/audio";

/** The source the page shows. */
const CODE = `<PlayerBar
	label="Player"
	track={<PlayerBar.Track art={cover} title="Last Train Bloom" subtitle="Neon Orchard" />}
	controls={
		<>
			<div>
				<PlayerBar.Button label="Disable shuffle" pressed><ShuffleIcon /></PlayerBar.Button>
				<PlayerBar.Button label="Previous"><SkipBackIcon /></PlayerBar.Button>
				<PlayerBar.Button label="Pause" primary><PauseIcon /></PlayerBar.Button>
				<PlayerBar.Button label="Next"><SkipForwardIcon /></PlayerBar.Button>
				<PlayerBar.Button label="Enable repeat"><RepeatIcon /></PlayerBar.Button>
			</div>
			<PlayerBar.Seek aria-label="Seek" current={97} duration={242} />
		</>
	}
	extras={<PlayerBar.Range aria-label="Volume" value={70} />}
/>`;

/** A gradient standing in for the cover. */
function Cover() {
	return () => (
		<span
			mix={[
				raw({ background: "linear-gradient(150deg, oklch(0.32 0.12 320), oklch(0.75 0.16 40))" }),
			]}
		/>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ display: "grid", gap: "1.5rem", inlineSize: "100%" })]}>
			<PlayerBar
				label="Player"
				mix={[
					raw({
						borderRadius: "var(--ui-radius-lg, 0.75rem)",
						border: "1px solid var(--ui-neutral-border)",
					}),
				]}
				track={<PlayerBar.Track art={<Cover />} title="Last Train Bloom" subtitle="Neon Orchard" />}
				controls={
					<>
						<div mix={[raw({ display: "flex", alignItems: "center", gap: "0.5rem" })]}>
							<PlayerBar.Button label="Disable shuffle" pressed>
								<ShuffleIcon size={18} />
							</PlayerBar.Button>
							<PlayerBar.Button label="Previous">
								<SkipBackIcon size={20} fill="currentColor" />
							</PlayerBar.Button>
							<PlayerBar.Button label="Pause" primary>
								<PauseIcon size={20} fill="currentColor" />
							</PlayerBar.Button>
							<PlayerBar.Button label="Next">
								<SkipForwardIcon size={20} fill="currentColor" />
							</PlayerBar.Button>
							<PlayerBar.Button label="Enable repeat" pressed={false}>
								<RepeatIcon size={18} />
							</PlayerBar.Button>
						</div>
						<PlayerBar.Seek aria-label="Seek" current={97} duration={242} />
					</>
				}
				extras={
					<>
						<PlayerBar.Button label="Queue">
							<ListMusicIcon size={18} />
						</PlayerBar.Button>
						<PlayerBar.Button label="Mute">
							<Volume2Icon size={18} />
						</PlayerBar.Button>
						<PlayerBar.Range
							aria-label="Volume"
							value={70}
							mix={[raw({ inlineSize: "6rem", flex: "none" })]}
						/>
					</>
				}
			/>
			<PlayerBar.Mini
				mix={[raw({ inlineSize: "min(100%, 22rem)" })]}
				art={<Cover />}
				title="Last Train Bloom"
				subtitle="Neon Orchard"
				progress={0.4}
				expand={
					<button type="button" data-slot="player-bar-mini-expand" aria-label="Open now playing" />
				}
				actions={
					<PlayerBar.Button label="Pause">
						<PauseIcon size={22} fill="currentColor" />
					</PlayerBar.Button>
				}
			/>
		</div>
	),
};
