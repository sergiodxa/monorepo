/**
 * Undercurrent's opening, set like the top of a letter: the issue line, the promise, the
 * sign-up form that works without script, and the cadence written out, with a way down to
 * the latest letter for a reader who wants a sample first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Link } from "@sdxc/ui";
import { LandingHero } from "@sdxc/ui/landing";

import SubscribeForm from "~/resources/views/demos/newsletter/subscribe-form";

/**
 * Renders the hero start-aligned in the page's one column. The form sits where a hero's
 * buttons would, and the cadence is the note under it, so the reader knows what arrives
 * and when before they type an address.
 *
 * @returns The render function producing the hero band.
 */
export default function NewsletterHero() {
	return () => (
		<LandingHero
			id="top"
			tone="plain"
			entrance
			eyebrowVariant="mono"
			eyebrow="A letter and a podcast, every other week"
			title="Letters from under the street"
			description={
				<>
					Undercurrent is about the infrastructure nobody notices until it stops: water mains, the
					grid, traffic signals, the post. A letter arrives every other Thursday, and on Sunday the
					episode follows, <strong>the letter read aloud with the people in it</strong>.
				</>
			}
			actions={
				<div id="subscribe" mix={[raw({ inlineSize: "100%" })]}>
					<SubscribeForm label="Subscribe free" confirmation="subscribed" />
				</div>
			}
			note={
				<>
					Thursdays at 7 a.m., about a ten-minute read. Episodes run 15 to 30 minutes in any podcast
					app. One click to leave.
				</>
			}
			proof={
				<p
					mix={[
						m(0),
						text("sm"),
						fg("neutral"),
						raw({
							paddingBlockStart: "1rem",
							borderBlockStart: "1px solid var(--ui-landing-hairline)",
						}),
					]}
				>
					Not sure yet?{" "}
					<Link href="#latest" mix={[weight("medium")]}>
						Read this fortnight’s letter
					</Link>{" "}
					or{" "}
					<Link href="#listen" mix={[weight("medium")]}>
						play the episode
					</Link>{" "}
					below. No address needed.
				</p>
			}
		/>
	);
}
