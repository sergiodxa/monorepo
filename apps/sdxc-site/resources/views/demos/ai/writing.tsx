/**
 * The drafting band: Margin writing the pricing call's notes line by line, each claim
 * followed by the timestamp it rests on, and the two gaps in the call left as gaps. It is
 * the same output the hero and the transcript show, typed out at reading speed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	CheckList,
	CheckRow,
	LandingHeader,
	LandingSection,
	Split,
	TypedTerminal,
} from "@sdxc/ui/landing";

import { MEETING_FILE, MEETING_LENGTH, TRANSCRIPT } from "~/resources/views/demos/ai/meeting";
import { renderNearView } from "~/resources/views/demos/near-view";

/**
 * The run on the call, as Margin's draft log prints it: what it read, then each note it
 * wrote (typed) and the source or gap it found for it (printed). Lines stay short enough
 * to fit a phone's column without scrolling sideways.
 */
const LINES: readonly TypedTerminal.Line[] = [
	{
		kind: "output",
		text: `read ${MEETING_LENGTH} · 3 voices · ${TRANSCRIPT.length} lines`,
		status: "muted",
	},
	{ kind: "input", text: "Decided: 2 months free" },
	{ kind: "output", text: "  ↳ 00:31 Tomás", status: "ok" },
	{ kind: "input", text: "Decided: 14-day refunds" },
	{ kind: "output", text: "  ↳ 02:18 Ana", status: "ok" },
	{ kind: "input", text: "To do: Ana, renewal email" },
	{ kind: "output", text: "  ↳ 03:05 Ana · due Friday", status: "ok" },
	{ kind: "input", text: "To do: Tomás, EU tax" },
	{ kind: "output", text: "  ↳ 03:40 · no date said", status: "fail" },
	{ kind: "input", text: "Open: who writes the copy?" },
	{ kind: "output", text: "  ↳ 01:24 · nobody took it", status: "fail" },
];

/**
 * Renders the copy beside the typing sheet, the sheet first on a phone so the demo leads.
 * Reduced motion shows the finished draft at once.
 *
 * @returns The render function producing the band.
 */
export default function MarginWriting() {
	return () => (
		<LandingSection id="drafting" tone="tinted" mix={[renderNearView(416, 762)]}>
			<Split lean="media">
				<Split.Copy>
					<LandingHeader
						eyebrow="Drafting"
						description={
							<>
								This is the run on the call above, at reading speed. Each note is written with the
								line it rests on, and <strong>a gap in the call stays a gap</strong>: no owner
								invented, no date guessed.
							</>
						}
					>
						Watch it write the notes
					</LandingHeader>
					<CheckList>
						<CheckRow>Nothing is written without a timestamp</CheckRow>
						<CheckRow>Missing owners and dates are flagged, not filled</CheckRow>
						<CheckRow>You edit the draft before anyone else sees it</CheckRow>
					</CheckList>
				</Split.Copy>
				<Split.Media>
					<TypedTerminal
						variant="code"
						aria-label="Margin drafting notes from the pricing call, each with its source"
						pauseLabel="Pause the drafting"
						title={`${MEETING_FILE} → notes`}
						lines={LINES}
					/>
				</Split.Media>
			</Split>
		</LandingSection>
	);
}
