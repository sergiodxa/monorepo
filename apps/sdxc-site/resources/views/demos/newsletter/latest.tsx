/**
 * The latest letter as a reader gets it in their inbox: the issue line, the salutation,
 * the body at a long leading with its one figure, and the sign-off. It is the page's sample
 * issue, so a visitor judges the writing itself before giving an address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { text, weight } from "@sdxc/u/typography";
import { Heading, Link } from "@sdxc/ui";
import { LandingSection } from "@sdxc/ui/landing";
import { eyebrow } from "@sdxc/ui/styles";

import { renderNearView } from "~/resources/views/demos/near-view";
import PressureFigure from "~/resources/views/demos/newsletter/pressure-figure";

/**
 * Renders the letter in an `<article>` under a ruled issue line. Paragraphs take the body
 * size up a step and a 1.75 leading, the setting a reader keeps for ten minutes.
 *
 * @returns The render function producing the band.
 */
export default function NewsletterLatest() {
	return () => (
		<LandingSection id="latest" ruled mix={[renderNearView(1671, 2107)]}>
			<article
				aria-labelledby="latest-title"
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						gap: "1.25em",
						fontSize: "1.125rem",
						lineHeight: "1.75",
						textWrap: "pretty",
					}),
				]}
			>
				<p mix={[eyebrow(), raw({ margin: "0" })]}>The latest letter</p>
				<Heading
					id="latest-title"
					mix={[
						raw({
							margin: "0",
							fontSize: "clamp(1.75rem, 1.2rem + 2vw, 2.5rem)",
							lineHeight: "1.15",
							fontWeight: "500",
							letterSpacing: "-0.015em",
							textWrap: "balance",
						}),
					]}
				>
					The pressure at the top of the hill
				</Heading>
				<p
					mix={[
						text("sm"),
						fg("neutral.muted"),
						raw({
							margin: "0 0 1.25em",
							paddingBlockEnd: "1rem",
							borderBlockEnd: "1px solid var(--ui-landing-hairline)",
							fontVariantNumeric: "tabular-nums",
						}),
					]}
				>
					No. 63 · <time dateTime="2026-11-05">Thursday 5 November 2026</time> · 9 minute read
				</p>
				<p>Dear reader,</p>
				<p>
					Maja lives on the ninth floor of a building on Linden Hill, and every morning at seven her
					shower turns to a thread. She wrote to ask whether her landlord was cutting corners. I
					asked the people who run the water, and the answer was more interesting than a landlord.
				</p>
				<p>
					Pressure at a tap is height you borrow. The tower at the top of the hill holds its water
					forty metres above the street, and every metre of that column pushes down the main and up
					your pipes. A tap on the ground floor gets nearly all of it. A tap twenty-seven metres up
					gets <strong>what is left over: thirteen metres</strong>, about a third of what the ground
					floor feels.
				</p>
				<PressureFigure />
				<p>
					Thirteen metres is enough for a decent shower at three in the morning. The trouble is the
					morning itself. When the whole hill turns its taps on together, water moves fast through
					the mains, and fast water loses height to friction on the way. By seven the line Maja
					borrows from has sagged, and she is left with six.
				</p>
				<p>
					The tower was built in 1931 for a hill of two-storey houses. Nobody drawing it imagined a
					ninth floor. Her building has a pump in the basement that is meant to make up the
					difference, and that, it turns out, is where the landlord comes in: it has been switched
					off since the spring to save electricity.
				</p>
				<p>
					I climbed the tower on Tuesday with Rafi Mendes, who checks it every week. You can hear
					that conversation on Sunday, along with the 3 a.m. test that tells the city how much of
					its water leaks away while everyone sleeps.
				</p>
				<p>Until the nineteenth,</p>
				<p mix={[raw({ margin: "-1em 0 0" })]}>Tove</p>
				<p mix={[text("base"), fg("neutral"), raw({ margin: "1em 0 0" })]}>
					<span mix={[weight("semibold")]}>P.S.</span> Maja’s pump is back on. She sent a photo of
					the pressure gauge, which is the nicest thing anyone has ever sent me.{" "}
					<Link href="#listen" mix={[weight("medium")]}>
						Hear this letter read aloud
					</Link>
					.
				</p>
			</article>
		</LandingSection>
	);
}
