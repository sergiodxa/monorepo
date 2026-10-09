/**
 * Live preview island for `HoverCard`. The reveal is CSS on the shared root's `:hover` and
 * `:focus-within`, so the card opens for a pointer and for a Tab with no script at all —
 * the `Follow` button inside is reachable because the card stays open while focus is in it.
 *
 * The panel is absolutely positioned against the root, so it needs room in the flow to
 * open into: the frame below reserves the block space the card takes, which is what keeps
 * it from being cut off by whatever scrolls around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CalendarIcon, MapPinIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { opacity, visibility } from "@sdxc/u/effects";
import { hstack, vstack } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Avatar, Button, HoverCard, Link, Text } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const HOVER_CARD_CODE = `<Text>
	Merged by{" "}
	<HoverCard>
		<HoverCard.Trigger>
			<Link href="/users/sergiodxa">@sergiodxa</Link>
		</HoverCard.Trigger>
		{/* bottom-start keeps the panel inside the column it opens in, rather than
		    centering it under the mention and hanging off the edge. */}
		<HoverCard.Content
			placement="bottom-start"
			aria-label="About @sergiodxa"
			// Every recipe compiles into its own cascade sublayer, and a sublayer's position
			// is fixed the first time it appears on the page. The panel's own hidden state
			// registers after the root's reveal rules, which a later layer wins against, so
			// the reveal is restated here where it lands last.
			mix={[
				when(':is([data-slot="hover-card"]:hover, [data-slot="hover-card"]:focus-within) &', [
					opacity(100),
					visibility(),
				]),
			]}
		>
			<Avatar size="lg">
				<Avatar.Fallback>SX</Avatar.Fallback>
			</Avatar>
			<span>Sergio Xalambrí</span>
			<Text>Writes small packages built on web standards.</Text>
			<span>
				<MapPinIcon aria-hidden="true" /> Lima, Peru
			</span>
			<span>
				<CalendarIcon aria-hidden="true" /> Joined March 2011
			</span>
			<Button size="sm">Follow</Button>
		</HoverCard.Content>
	</HoverCard>{" "}
	two hours ago.
</Text>`;

/** A profile card on a mention, hydrated with the room the panel opens into reserved. */
export const HoverCardPreview = clientEntry(import.meta.url, function HoverCardPreview() {
	return () => (
		<div mix={[is("26rem"), bs("19rem")]}>
			<Text>
				Merged by{" "}
				<HoverCard>
					<HoverCard.Trigger>
						<Link href="/users/sergiodxa">@sergiodxa</Link>
					</HoverCard.Trigger>
					{/* bottom-start keeps the panel inside the column it opens in, rather than
						    centering it under the mention and hanging off the edge. */}
					<HoverCard.Content
						placement="bottom-start"
						aria-label="About @sergiodxa"
						// Every recipe compiles into its own cascade sublayer, and a sublayer's
						// position is fixed the first time it appears on the page. The panel's own
						// hidden state registers after the root's reveal rules, which a later layer
						// wins against, so the reveal is restated here where it lands last.
						mix={[
							when(':is([data-slot="hover-card"]:hover, [data-slot="hover-card"]:focus-within) &', [
								opacity(100),
								visibility(),
							]),
						]}
					>
						<div mix={[vstack({ gap: 2, align: "stretch" })]}>
							<div mix={[hstack({ gap: 3, align: "center" })]}>
								<Avatar size="lg">
									<Avatar.Fallback>SX</Avatar.Fallback>
								</Avatar>
								<div mix={[vstack({ gap: 0, align: "start" })]}>
									<span mix={[text("sm"), weight("semibold")]}>Sergio Xalambrí</span>
									<span mix={[text("xs"), fg("neutral")]}>@sergiodxa</span>
								</div>
							</div>

							<Text>Writes small packages built on web standards.</Text>

							<div mix={[hstack({ gap: 4, align: "center" })]}>
								<span mix={[hstack({ gap: 1, align: "center" }), text("xs"), fg("neutral")]}>
									<MapPinIcon aria-hidden="true" />
									Lima, Peru
								</span>
								<span mix={[hstack({ gap: 1, align: "center" }), text("xs"), fg("neutral")]}>
									<CalendarIcon aria-hidden="true" />
									Joined March 2011
								</span>
							</div>

							<Button size="sm">Follow</Button>
						</div>
					</HoverCard.Content>
				</HoverCard>{" "}
				two hours ago.
			</Text>
		</div>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: HOVER_CARD_CODE, render: () => <HoverCardPreview /> };
