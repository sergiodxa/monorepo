/**
 * The page's last word: the refund policy as three plain rules, the questions people ask
 * before buying, and the enrol band every plan's button lands on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { combine, raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { weight } from "@sdxc/u/typography";
import { Accordion, Link, LinkButton } from "@sdxc/ui";
import { ClosingCta, FaqBand, LandingHeader, LandingSection } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import { FREE_LESSONS, MODULES } from "~/resources/views/demos/course/data";
import {
	COHORT_PRICE,
	COHORT_START,
	SEAT_PRICE,
	SELF_PACED_PRICE,
} from "~/resources/views/demos/course/pricing";
import { renderNearView } from "~/resources/views/demos/near-view";

/** The refund rules, one per plan, each with the window it runs. */
const REFUNDS = [
	{
		window: "30 days",
		plan: "Self-paced",
		rule: "Ask within 30 days of buying for a full refund, however many lessons you watched.",
	},
	{
		window: "Until week 3",
		plan: "Cohort",
		rule: "Full refund until the third Thursday. After that, move to the next cohort for free instead.",
	},
	{
		window: "Per seat",
		plan: "Team seats",
		rule: "Seats nobody has opened are refunded at any time; opened seats follow the 30-day rule.",
	},
] as const;

/** The questions, each with an answer of two or three sentences. */
const QUESTIONS = [
	[
		"Do I need my own wheel?",
		"For modules 2 onward, yes, or a studio membership with wheel time. Module 1 needs only clay and a table, so you can start before you commit to one. The first lesson covers what to look for in a used wheel.",
	],
	[
		"What clay should I buy?",
		"A mid-fire stoneware with fine grog, about 10 kg to start. Ines throws a red one in the videos, but any smooth stoneware behaves the same. Module 1 shows how to tell when a bag is too wet or too dry.",
	],
	[
		"What about a kiln?",
		"Most students fire at a local studio or community workshop for a small fee per shelf. The course never assumes you own a kiln, and the glazes it uses are ones studios commonly stock.",
	],
	[
		"How long does it take?",
		"Self-paced students who finish take a median of eleven weeks, practising three evenings a week. The cohort runs eight weeks and asks for about five hours of wheel time each week.",
	],
	[
		"Can I watch before paying?",
		`Yes. ${FREE_LESSONS} lessons are free with no account, one from almost every module, including the one at the top of this page.`,
	],
	[
		"Are the lessons captioned?",
		"Every lesson has captions written by a person, a full transcript you can search, and chapters. The transcript follows the video, so you can find the minute you need.",
	],
] as const;

/** Container the refunds grid queries. */
const REFUND_GRID = "course-refunds";

/**
 * The refund policy: three rules, one per plan, each led by its window.
 *
 * @returns The render function producing the band.
 */
export function CourseRefunds() {
	return () => (
		<LandingSection id="refunds" tone="tinted" spacing="compact" mix={[renderNearView(410, 840)]}>
			<div mix={[container(REFUND_GRID), raw({ display: "grid", gap: "2rem" })]}>
				<LandingHeader
					eyebrow="Refunds"
					description="Written plainly, so you know before you buy. Email us; nobody asks why."
				>
					If it is not for you, you get your money back
				</LandingHeader>
				<ul
					mix={[
						combine([
							raw({
								listStyle: "none",
								margin: "0",
								padding: "0",
								display: "grid",
								gap: "1rem",
								gridTemplateColumns: "minmax(0, 1fr)",
							}),
							at("md", REFUND_GRID, raw({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" })),
						]),
					]}
				>
					{REFUNDS.map((refund) => (
						<li
							key={refund.plan}
							mix={[
								raw({
									display: "grid",
									gap: "0.5rem",
									alignContent: "start",
									padding: "1.25rem",
									borderRadius: "var(--ui-landing-card-radius-outer)",
									boxShadow: "inset 0 0 0 1px var(--ui-landing-hairline)",
								}),
							]}
						>
							<span
								mix={[
									raw({
										fontFamily: "var(--ui-font-display)",
										fontWeight: "700",
										fontSize: "1.5rem",
										letterSpacing: "-0.02em",
										color: "var(--ui-brand-fg)",
									}),
								]}
							>
								{refund.window}
							</span>
							<span mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}>
								{refund.plan}
							</span>
							<span mix={[raw({ color: "var(--ui-neutral-fg)", textWrap: "pretty" })]}>
								{refund.rule}
							</span>
						</li>
					))}
				</ul>
			</div>
		</LandingSection>
	);
}

/**
 * The questions band, two columns wide.
 *
 * @returns The render function producing the band.
 */
export function CourseFaq() {
	return () => (
		<FaqBand
			id="faq"
			columns={2}
			eyebrow="Questions"
			title="Before your first lump of clay"
			mix={[renderNearView(485)]}
		>
			<Accordion>
				{QUESTIONS.map(([question, answer]) => (
					<Accordion.Item key={question} name="course-faq">
						<Accordion.Trigger>
							{question}
							<ChevronDownIcon data-slot="icon" aria-hidden="true" />
						</Accordion.Trigger>
						<Accordion.Content>
							<p>{answer}</p>
						</Accordion.Content>
					</Accordion.Item>
				))}
			</Accordion>
		</FaqBand>
	);
}

/**
 * The enrol band: the same call as the hero, the three prices in one line, and the free
 * lessons as the way to try first.
 *
 * @returns The render function producing the band.
 */
export function CourseClosing() {
	return () => (
		<ClosingCta
			id="enroll"
			tone="inverse"
			inset
			eyebrow="Enroll"
			title={`Six modules from now, a jar with a lid that fits`}
			description={`Self-paced $${SELF_PACED_PRICE}, the ${COHORT_START} cohort $${COHORT_PRICE}, team seats $${SEAT_PRICE} each. Every one comes with ${MODULES.length} pieces to make and 30 days to change your mind.`}
			actions={
				<>
					<LinkButton href="#pricing" color="brand" mix={[landingCtaChrome()]}>
						Enroll from ${SELF_PACED_PRICE}
					</LinkButton>
					<Link href="#curriculum" color="neutral" mix={[weight("medium")]}>
						Watch {FREE_LESSONS} lessons free
					</Link>
				</>
			}
		/>
	);
}
