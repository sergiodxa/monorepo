/**
 * The learning-path band: the four steps a learner takes through a level, as the guided tour
 * every app landing shares, each step beside the real screen it produces. The autoplay
 * island rides in the header and advances the rail while it is on screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import type { ScreenName } from "~/resources/views/wakaba/parts";

import { PathAutoplay } from "~/resources/components/path-autoplay";
import { GuidedTour } from "~/resources/views/app-pages/guided-tour";
import { copyOf, Phone } from "~/resources/views/wakaba/parts";

/** The steps in order, each with the radio value it switches on and its real screen. */
const STEPS = [
	{ value: "meet", screen: "new-word" },
	{ value: "practise", screen: "correct-answer" },
	{ value: "exam", screen: "level-exam" },
	{ value: "review", screen: "oni-review" },
] as const satisfies ReadonlyArray<{ value: string; screen: ScreenName }>;

/**
 * The band: the header, then the tour, a rail beside the screen on a wide band and step
 * cards in a swipeable row on a narrow one.
 *
 * @returns The render function producing the band.
 */
export function PathBand(handle: Handle) {
	return () => {
		let t = copyOf(handle).path;
		return (
			<LandingSection
				id="path"
				mix={[raw({ contentVisibility: "auto", containIntrinsicSize: "auto 900px" })]}
			>
				<LandingHeader
					eyebrow={t.eyebrow}
					description={
						<>
							{t.description}
							<PathAutoplay />
						</>
					}
				>
					{t.title}
				</LandingHeader>
				<GuidedTour
					name="wakaba-path"
					label={t.stageLabel}
					steps={STEPS.map((step, index) => ({
						value: step.value,
						title: t.steps[index]?.title ?? "",
						body: t.steps[index]?.body ?? "",
						screen: <Phone screen={step.screen} />,
					}))}
				/>
			</LandingSection>
		);
	};
}
