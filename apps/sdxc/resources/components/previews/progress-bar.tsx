/**
 * Live preview island for `ProgressBar`. A progress bar reports a task that is moving,
 * which is what separates it from `Meter`, so the preview is an upload queue that
 * actually moves: pressing Upload advances one file to done, leaves the next
 * indeterminate while the server works on it, and re-arms itself once the queue empties.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Button, Header, ProgressBar } from "@sdxc/ui";
import { shimmer } from "@sdxc/ui/animations";
import { clientEntry, on } from "remix/ui";

/** Percentage points one tick adds, so the bar crosses the whole track in a few seconds. */
const STEP = 4;

/** Milliseconds between ticks. */
const TICK_MS = 80;

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `let uploaded = 0;

function startUpload() {
	let timer = setInterval(() => {
		uploaded = Math.min(100, uploaded + STEP);
		void handle.update();
		if (uploaded === 100) clearInterval(timer);
	}, TICK_MS);

	handle.signal.addEventListener("abort", () => clearInterval(timer));
}

<div mix={[vstack({ gap: 5, align: "stretch" })]}>
	<Header mix={[m(0)]}>Uploading 3 files</Header>

	<ProgressBar>
		<div mix={[hstack({ gap: 2, justify: "between" })]}>
			<span mix={[text("sm"), weight("medium")]}>hero@2x.png</span>
			<ProgressBar.ValueLabel>{uploaded}%</ProgressBar.ValueLabel>
		</div>
		<ProgressBar.Indicator value={uploaded} max={100} aria-label="hero@2x.png upload" />
	</ProgressBar>

	<ProgressBar>
		<div mix={[hstack({ gap: 2, justify: "between" })]}>
			<span mix={[text("sm"), weight("medium")]}>walkthrough.mp4</span>
			<ProgressBar.ValueLabel>Transcoding…</ProgressBar.ValueLabel>
		</div>
		<ProgressBar.Indicator aria-label="walkthrough.mp4 transcoding" mix={[shimmer()]} />
	</ProgressBar>

	<ProgressBar>
		<div mix={[hstack({ gap: 2, justify: "between" })]}>
			<span mix={[text("sm"), weight("medium")]}>changelog.md</span>
			<ProgressBar.ValueLabel>Done</ProgressBar.ValueLabel>
		</div>
		<ProgressBar.Indicator value={100} max={100} aria-label="changelog.md upload" />
	</ProgressBar>

	<Button
		type="button"
		variant="outline"
		size="sm"
		mix={[on<HTMLButtonElement, "click">("click", startUpload)]}
	>
		{uploaded === 0 ? "Upload" : uploaded === 100 ? "Upload again" : "Uploading…"}
	</Button>
</div>`;

/** An upload queue whose first bar advances on press, hydrated so the task has somewhere to run. */
export const ProgressBarPreview = clientEntry(
	"/resources/components/previews/progress-bar.tsx#ProgressBarPreview",
	function ProgressBarPreview(handle: Handle) {
		let uploaded = 0;
		let timer: ReturnType<typeof setInterval> | undefined;

		/** Advances the first file to done, restarting from zero once it has already finished. */
		function startUpload() {
			clearInterval(timer);
			if (uploaded === 100) uploaded = 0;

			timer = setInterval(() => {
				uploaded = Math.min(100, uploaded + STEP);
				void handle.update();
				if (uploaded === 100) clearInterval(timer);
			}, TICK_MS);

			void handle.update();
		}

		handle.signal.addEventListener("abort", () => clearInterval(timer));

		return () => (
			<div mix={[vstack({ gap: 5, align: "stretch" }), is("22rem")]}>
				<Header mix={[m(0)]}>Uploading 3 files</Header>

				<ProgressBar>
					<div mix={[hstack({ gap: 2, justify: "between" })]}>
						<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis")]}>hero@2x.png</span>
						<ProgressBar.ValueLabel>{`${uploaded}%`}</ProgressBar.ValueLabel>
					</div>
					<ProgressBar.Indicator value={uploaded} max={100} aria-label="hero@2x.png upload" />
				</ProgressBar>

				<ProgressBar>
					<div mix={[hstack({ gap: 2, justify: "between" })]}>
						<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis")]}>
							walkthrough.mp4
						</span>
						<ProgressBar.ValueLabel>Transcoding…</ProgressBar.ValueLabel>
					</div>
					<ProgressBar.Indicator aria-label="walkthrough.mp4 transcoding" mix={[shimmer()]} />
				</ProgressBar>

				<ProgressBar>
					<div mix={[hstack({ gap: 2, justify: "between" })]}>
						<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis")]}>changelog.md</span>
						<ProgressBar.ValueLabel>Done</ProgressBar.ValueLabel>
					</div>
					<ProgressBar.Indicator value={100} max={100} aria-label="changelog.md upload" />
				</ProgressBar>

				<Button
					type="button"
					variant="outline"
					size="sm"
					mix={[on<HTMLButtonElement, "click">("click", startUpload)]}
				>
					{uploaded === 0 ? "Upload" : uploaded === 100 ? "Upload again" : "Uploading…"}
				</Button>
			</div>
		);
	},
);

export default { code: CODE, render: () => <ProgressBarPreview /> };
