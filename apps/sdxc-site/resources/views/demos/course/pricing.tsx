/**
 * Centered's prices: self-paced, the cohort with live critique, and team seats for a studio
 * or a community workshop. The figures live here once, and the hero and closing quote them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge, LinkButton } from "@sdxc/ui";
import { CheckRow, PricingBand } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import { LESSONS } from "~/resources/views/demos/course/data";
import { renderNearView } from "~/resources/views/demos/near-view";

/** Self-paced access, once, in US dollars. */
export const SELF_PACED_PRICE = 180;

/** The eight-week cohort, in US dollars. */
export const COHORT_PRICE = 420;

/** One team seat, in US dollars, from {@link TEAM_MINIMUM} seats. */
export const SEAT_PRICE = 140;

/** The fewest seats a team buys. */
export const TEAM_MINIMUM = 5;

/** Students in one cohort, so each gets a weekly critique. */
export const COHORT_SEATS = 16;

/** The next cohort's first session. */
export const COHORT_START = "February 2, 2027";

/**
 * Renders the three plans, the cohort featured, each action leading to the enrol band.
 *
 * @returns The render function producing the band.
 */
export function CoursePricing() {
	return () => (
		<PricingBand
			id="pricing"
			tone="tinted"
			mix={[renderNearView(685, 1675)]}
			eyebrow="Pricing"
			title="Learn alone, with a cohort, or as a studio"
			columns={3}
			description={
				<>
					Every plan has every lesson for good, and <strong>a full refund for 30 days</strong>.
					Clay, a wheel and a kiln are yours to find; the FAQ says how.
				</>
			}
		>
			<PricingBand.Plan
				name="Self-paced"
				price={`$${SELF_PACED_PRICE}`}
				period="once"
				description="The whole course, at your speed, for as long as it exists."
				features={
					<>
						<CheckRow>All {LESSONS.length} lessons, with chapters and transcripts</CheckRow>
						<CheckRow>Progress and practice log on every device</CheckRow>
						<CheckRow>Student forum, answered weekly</CheckRow>
						<CheckRow>Certificate on review of your pieces</CheckRow>
					</>
				}
				action={
					<LinkButton href="#enroll" color="neutral" variant="surface" mix={[landingCtaChrome()]}>
						Start self-paced
					</LinkButton>
				}
			/>
			<PricingBand.Plan
				name="Cohort"
				price={`$${COHORT_PRICE}`}
				period="8 weeks"
				featured
				badge={<Badge color="brand">Starts {COHORT_START.replace(", 2027", "")}</Badge>}
				description={`Everything self-paced has, with ${COHORT_SEATS} students and Ines on Thursdays.`}
				features={
					<>
						<CheckRow>A live critique of your pieces every week</CheckRow>
						<CheckRow>All six modules in eight weeks, in step</CheckRow>
						<CheckRow>Recordings if you miss a Thursday</CheckRow>
						<CheckRow>Certificate reviewed by Ines herself</CheckRow>
					</>
				}
				action={
					<LinkButton href="#enroll" color="brand" mix={[landingCtaChrome()]}>
						Join the cohort
					</LinkButton>
				}
			/>
			<PricingBand.Plan
				name="Team seats"
				price={`$${SEAT_PRICE}`}
				period={`a seat, from ${TEAM_MINIMUM}`}
				description="For studios, schools and community workshops that teach together."
				features={
					<>
						<CheckRow>Self-paced access for every seat</CheckRow>
						<CheckRow>Seats you can reassign between terms</CheckRow>
						<CheckRow>A progress view for whoever runs the class</CheckRow>
						<CheckRow>One invoice, paid by card or transfer</CheckRow>
					</>
				}
				action={
					<LinkButton href="#enroll" color="neutral" variant="surface" mix={[landingCtaChrome()]}>
						Buy {TEAM_MINIMUM} seats or more
					</LinkButton>
				}
			/>
		</PricingBand>
	);
}
