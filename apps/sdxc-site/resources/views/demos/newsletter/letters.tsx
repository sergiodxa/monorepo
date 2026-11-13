/**
 * The replies band: what readers and listeners wrote back, each naming the letter or
 * episode it is about, with one complaint kept in, printed down the column like a letters
 * page so the praise reads as mail rather than as marketing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { m, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { renderNearView } from "~/resources/views/demos/near-view";

/** One reply: what they wrote, who they are, and how they take Undercurrent. */
interface Reply {
	quote: string;
	name: string;
	context: string;
}

/** The replies, in the order the column prints them; the third is the fair complaint. */
const REPLIES: readonly Reply[] = [
	{
		quote:
			"I build this stuff for a living and I still learn something every other Thursday. I forward the letter to my mother, who now asks me about pressure zones at dinner.",
		name: "Hannah Okoye",
		context: "Civil engineer, reader since No. 1",
	},
	{
		quote:
			"After the letter on night flow I read our own meter at 3 a.m. It was moving. The plumber found a leak under the bath the next day.",
		name: "Jonas Weber",
		context: "Reader since No. 12",
	},
	{
		quote:
			"The episodes run long when there is a guest. I skip to the chapter I want, which I suppose is what the chapters are for.",
		name: "Marek Novak",
		context: "Listener since episode 40",
	},
	{
		quote:
			"I listen on the night bus home from the hospital. The sorting-office episode was the first time I heard my own shift described by someone who got it right.",
		name: "Priya Raman",
		context: "Night nurse, listener",
	},
];

/**
 * Renders each reply as a `<figure>` with its quote and a signed caption, separated by
 * hairlines, at the same measure and leading as the letter.
 *
 * @returns The render function producing the band.
 */
export default function NewsletterLetters() {
	return () => (
		<LandingSection id="replies" ruled mix={[renderNearView(864, 1000)]}>
			<LandingHeader
				eyebrow="Replies"
				description={
					<>
						Quoted with permission from replies to the letter.{" "}
						<strong>We print the complaints too</strong>, when they are fair.
					</>
				}
			>
				What readers write back
			</LandingHeader>
			<ul mix={[m(0), p(0), raw({ listStyle: "none", marginBlockStart: "2.5rem" })]}>
				{REPLIES.map((reply) => (
					<li
						key={reply.name}
						mix={[
							raw({
								paddingBlock: "1.5rem",
								borderBlockStart: "1px solid var(--ui-landing-hairline)",
							}),
						]}
					>
						<figure mix={[m(0)]}>
							<blockquote
								mix={[
									m(0),
									fg("neutral.emphasis"),
									raw({ fontSize: "1.125rem", lineHeight: "1.7", textWrap: "pretty" }),
								]}
							>
								<p mix={[m(0)]}>“{reply.quote}”</p>
							</blockquote>
							<figcaption
								mix={[text("sm"), fg("neutral.muted"), raw({ marginBlockStart: "0.75rem" })]}
							>
								<span mix={[weight("semibold"), fg("neutral")]}>{reply.name}</span>, {reply.context}
							</figcaption>
						</figure>
					</li>
				))}
			</ul>
		</LandingSection>
	);
}
