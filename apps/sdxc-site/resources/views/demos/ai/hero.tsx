/**
 * Margin's opening: the promise beside the notes it wrote from a real call, each line
 * ending in a timestamp that links to the transcript below. The proof line under the
 * actions states the three facts a buyer of an AI note-taker asks first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Link, LinkButton } from "@sdxc/ui";
import { CheckList, CheckRow, LandingHero } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import { FREE_HOURS } from "~/resources/views/demos/ai/estimate";
import NotesSheet from "~/resources/views/demos/ai/notes-sheet";
import { HAND } from "~/resources/views/demos/ai/type";

/**
 * Renders the hero with the sheet beside the copy from the `lg` container and under it
 * on a phone, on plain paper so the ruled sheet is the one notebook in view.
 *
 * @returns The render function producing the hero band.
 */
export default function MarginHero() {
	return () => (
		<LandingHero
			id="top"
			tone="plain"
			mediaPlacement="end"
			entrance
			eyebrowVariant="mono"
			eyebrow="Meeting notes, with sources"
			title={<>Notes that show where every line came from</>}
			description={
				<>
					Margin turns a recorded call into a summary, decisions and to-dos, and{" "}
					<strong>every one ends in the timestamp of the sentence it came from</strong>. Click it to
					read the line yourself.
				</>
			}
			actions={
				<>
					<LinkButton href="/examples/margin/sign-up" color="brand" mix={[landingCtaChrome()]}>
						Try it on a recording
					</LinkButton>
					<Link href="#sources" color="neutral" mix={[raw({ fontWeight: "500" })]}>
						Read the transcript
					</Link>
				</>
			}
			note={`${FREE_HOURS} recorded hours free every month. No card.`}
			proof={
				<CheckList orientation="horizontal">
					<CheckRow>Audio deleted in 24 hours</CheckRow>
					<CheckRow>Never trains on your calls</CheckRow>
					<CheckRow>Gaps flagged, not guessed</CheckRow>
				</CheckList>
			}
			media={
				<div mix={[raw({ position: "relative", paddingBlockStart: "0.75rem" })]}>
					<NotesSheet />
					<p
						aria-hidden="true"
						mix={[
							raw({
								margin: "0.75rem 0 0",
								fontFamily: HAND,
								fontSize: "1.0625rem",
								color: "var(--ui-brand-fg)",
								textAlign: "end",
								rotate: "-1.5deg",
							}),
						]}
					>
						every time links to its line ↓
					</p>
				</div>
			}
		/>
	);
}
