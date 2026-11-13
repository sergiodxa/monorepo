/**
 * Centered's first viewport: the claim and the enrol call over the lesson player, set wide
 * as a dark screen on the bright page, so the first thing a visitor sees is a lesson they
 * can play.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { weight } from "@sdxc/u/typography";
import { Link, LinkButton } from "@sdxc/ui";
import { AccentText, CheckList, CheckRow, LandingHero } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import { FREE_LESSONS, LESSONS, MODULES } from "~/resources/views/demos/course/data";
import { LessonPlayer } from "~/resources/views/demos/course/lesson-player";
import { SELF_PACED_PRICE } from "~/resources/views/demos/course/pricing";

/**
 * Renders the hero centered over the player, with the free lessons as the second call
 * and three trust lines under the actions.
 *
 * @returns The render function producing the hero.
 */
export function CourseHero() {
	return () => (
		<LandingHero
			id="preview"
			tone="plain"
			align="center"
			mediaPlacement="below"
			entrance
			eyebrow="Wheel-throwing video course"
			eyebrowVariant="pill"
			eyebrowHref="#curriculum"
			title={
				<>
					From a lump of clay to a <AccentText variant="highlight">lidded jar</AccentText>
				</>
			}
			description={
				<>
					{LESSONS.length} lessons in {MODULES.length} modules, filmed over the wheel and from the
					side, so you see what your hands should do.{" "}
					<strong>Every lesson has chapters and a full transcript</strong>, and every module ends in
					a piece you can hold.
				</>
			}
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
			proof={
				<CheckList orientation="horizontal">
					<CheckRow>Self-paced or with a cohort</CheckRow>
					<CheckRow>30-day refund</CheckRow>
					<CheckRow>Captions in every lesson</CheckRow>
				</CheckList>
			}
			media={<LessonPlayer />}
		/>
	);
}
