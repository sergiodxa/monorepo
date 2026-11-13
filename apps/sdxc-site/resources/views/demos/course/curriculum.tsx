/**
 * The curriculum, the page's centre: four counted figures in the headline's weight over
 * the six modules, two to a row, each listing its lessons with their running times and
 * marking the ones anyone may watch before enrolling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { Curriculum, LandingHeader, LandingSection, StatStrip } from "@sdxc/ui/landing";

import {
	FREE_LESSONS,
	formatLength,
	LESSONS,
	MODULES,
	moduleMinutes,
	TOTAL_SECONDS,
} from "~/resources/views/demos/course/data";
import { renderNearView } from "~/resources/views/demos/near-view";

/** The modules paired into rows of two, in teaching order. */
const ROWS = [MODULES.slice(0, 2), MODULES.slice(2, 4), MODULES.slice(4, 6)];

/**
 * Renders the band: header and figures, then three curricula of two modules each, so a
 * wide screen reads the course as a grid and a phone as one list.
 *
 * @returns The render function producing the band.
 */
export function CourseCurriculum() {
	return () => (
		<LandingSection id="curriculum" tone="tinted" mix={[renderNearView(1315, 2630)]}>
			<LandingHeader
				eyebrow="Curriculum"
				description={
					<>
						Each module builds on the last, and each ends in a piece you make before moving on.{" "}
						<strong>Lessons marked free play without an account.</strong>
					</>
				}
			>
				Six modules, one skill at a time
			</LandingHeader>
			<div mix={[raw({ display: "grid", gap: "3.5rem" })]}>
				<StatStrip size="display" variant="ruled">
					<StatStrip.Item label="Lessons">
						<Figure>{LESSONS.length}</Figure>
					</StatStrip.Item>
					<StatStrip.Item label="Minutes on the wheel">
						<Figure>{Math.round(TOTAL_SECONDS / 60)}</Figure>
					</StatStrip.Item>
					<StatStrip.Item label="Free previews">
						<Figure>{FREE_LESSONS}</Figure>
					</StatStrip.Item>
					<StatStrip.Item label="Pieces you keep">
						<Figure>{MODULES.length}</Figure>
					</StatStrip.Item>
				</StatStrip>
				{ROWS.map((row, rowIndex) => (
					<Curriculum key={rowIndex}>
						{row.map((module, index) => {
							let number = rowIndex * 2 + index + 1;
							let lessons = LESSONS.filter((lesson) => lesson.module === number);
							let free = lessons.filter((lesson) => lesson.free).length;
							return (
								<Curriculum.Part
									key={module.title}
									title={`Module ${number} · ${module.title}`}
									meta={`${lessons.length} lessons · ${moduleMinutes(module)}${free > 0 ? ` · ${free} free` : ""}`}
								>
									{lessons.map((lesson) => (
										<Curriculum.Lesson
											key={lesson.number}
											number={String(lesson.number).padStart(2, "0")}
											title={lesson.title}
											meta={formatLength(lesson.seconds)}
											badge={lesson.free ? "Free preview" : undefined}
										/>
									))}
								</Curriculum.Part>
							);
						})}
					</Curriculum>
				))}
			</div>
		</LandingSection>
	);
}

/**
 * A counted figure in the headline's weight and tracking, so the strip reads as part of the
 * band's display type.
 *
 * @param handle Runtime handle carrying the figure.
 * @returns The render function producing the figure.
 */
function Figure(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<span
			mix={[
				raw({
					fontWeight: "var(--ui-landing-display-weight)",
					letterSpacing: "var(--ui-landing-display-tracking)",
				}),
			]}
		>
			{handle.props.children}
		</span>
	);
}
