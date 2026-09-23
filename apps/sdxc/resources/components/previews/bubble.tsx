/**
 * Live preview island for `Bubble`. The frame carries the tone, the edge it hugs and the
 * clipped corner that marks a run of turns from one side, so a thread needs both sides and
 * a grouped run to read as one. Each reaction is a toggle, so it carries the
 * `pressToggle()` wiring a reader would write, which is what moves `aria-pressed` on press.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { gap, vstack } from "@sdxc/u/layout";
import { bs, is, maxIs, minBs, pi } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Bubble, ToggleButton } from "@sdxc/ui";
import { pressToggle } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 3, align: "stretch" }), is("100%"), maxIs("30rem")]}>
	<Bubble align="start" variant="muted">
		<Bubble.Content>
			Morning! Invoice 4821 came through twice this month — once on the 2nd and once on
			the 14th. Can you take a look?
		</Bubble.Content>
	</Bubble>

	<Bubble.Group>
		<Bubble align="end">
			<Bubble.Content>Found it: the retry fired after the first charge settled.</Bubble.Content>
		</Bubble>
		<Bubble align="end">
			<Bubble.Content>
				The duplicate is refunded, back on the card in three to five business days.
			</Bubble.Content>
		</Bubble>
	</Bubble.Group>

	<Bubble align="start" variant="muted">
		<Bubble.Content>Perfect, thank you.</Bubble.Content>
		<Bubble.Reactions aria-label="Reactions to this message">
			<ToggleButton
				size="sm"
				variant="outline"
				aria-pressed="true"
				aria-label="Thumbs up, 3 people"
				mix={[pressToggle()]}
			>
				👍 3
			</ToggleButton>
			<ToggleButton
				size="sm"
				variant="outline"
				aria-pressed="false"
				aria-label="Party, 1 person"
				mix={[pressToggle()]}
			>
				🎉 1
			</ToggleButton>
		</Bubble.Reactions>
	</Bubble>

	<Bubble align="start" variant="ghost">
		<Bubble.Content mix={[text("xs"), fg("neutral.muted")]}>
			Conversation closed by Ana Souza · 09:41
		</Bubble.Content>
	</Bubble>
</div>`;

/** A support thread across both sides, hydrated so each reaction actually toggles. */
export const BubblePreview = clientEntry(
	"/resources/components/previews/bubble.tsx#BubblePreview",
	function BubblePreview() {
		return () => (
			<div mix={[vstack({ gap: 3, align: "stretch" }), is("100%"), maxIs("30rem")]}>
				<Bubble align="start" variant="muted">
					<Bubble.Content>
						Morning! Invoice 4821 came through twice this month — once on the 2nd and once on the
						14th. Can you take a look?
					</Bubble.Content>
				</Bubble>

				<Bubble.Group>
					<Bubble align="end">
						<Bubble.Content>
							Found it: the retry fired after the first charge settled.
						</Bubble.Content>
					</Bubble>
					<Bubble align="end">
						<Bubble.Content>
							The duplicate is refunded, back on the card in three to five business days.
						</Bubble.Content>
					</Bubble>
				</Bubble.Group>

				<Bubble align="start" variant="muted">
					<Bubble.Content>Perfect, thank you.</Bubble.Content>
					<Bubble.Reactions aria-label="Reactions to this message">
						<ToggleButton
							size="sm"
							variant="outline"
							aria-pressed="true"
							aria-label="Thumbs up, 3 people"
							mix={[
								pressToggle(),
								// A reaction is a count, not a command: a pill sized to its own glyph.
								minBs("1.5rem"),
								bs("1.5rem"),
								pi(2),
								gap(1),
								rounded("full"),
								text("xs"),
							]}
						>
							👍 3
						</ToggleButton>
						<ToggleButton
							size="sm"
							variant="outline"
							aria-pressed="false"
							aria-label="Party, 1 person"
							mix={[
								pressToggle(),
								// A reaction is a count, not a command: a pill sized to its own glyph.
								minBs("1.5rem"),
								bs("1.5rem"),
								pi(2),
								gap(1),
								rounded("full"),
								text("xs"),
							]}
						>
							🎉 1
						</ToggleButton>
					</Bubble.Reactions>
				</Bubble>

				<Bubble align="start" variant="ghost">
					<Bubble.Content mix={[text("xs"), fg("neutral.muted")]}>
						Conversation closed by Ana Souza · 09:41
					</Bubble.Content>
				</Bubble>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <BubblePreview /> };
