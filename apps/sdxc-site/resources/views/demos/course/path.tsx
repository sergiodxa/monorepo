/**
 * What each module leaves you able to make, shown as a student's progress page part way
 * through: the six pieces as silhouettes, the skill each one proves, and how many lessons
 * of each are done, so progress reads as things you can now throw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { FeatureBand, ProductFrame } from "@sdxc/ui/landing";

import { Pot } from "~/resources/views/demos/course/clay";
import { LESSONS, MODULES } from "~/resources/views/demos/course/data";
import { renderNearView } from "~/resources/views/demos/near-view";

/** How many lessons of each module the sample student has watched: two modules in, a third begun. */
const WATCHED = [4, 4, 2, 0, 0, 0] as const;

/**
 * Renders the band: the claim and three facts about progress beside the progress page.
 *
 * @returns The render function producing the band.
 */
export function CoursePath() {
	return () => (
		<FeatureBand
			id="path"
			layout="split"
			lean="media"
			eyebrow="Your progress"
			title="Progress you can hold in your hands"
			description={
				<>
					The course tracks lessons, but it measures you by pieces.{" "}
					<strong>Each module ends with something you made</strong>, photographed and kept in your
					progress page beside the skill it proves.
				</>
			}
			media={<ProgressPage />}
			mix={[renderNearView(485, 1145)]}
		>
			<ul>
				<li>Resumes at the second you stopped, on any device</li>
				<li>A practice log for each lesson: tries, times, notes</li>
				<li>Every module open from day one, in any order</li>
			</ul>
		</FeatureBand>
	);
}

/**
 * The progress page of a student two modules in: one row per module with its piece, the
 * skill, and a bar of lessons watched.
 *
 * @returns The render function producing the framed page.
 */
function ProgressPage() {
	return () => {
		let done = WATCHED.reduce<number>((sum, count) => sum + count, 0);
		return (
			<ProductFrame
				lights
				title="My progress"
				url="centered.example/learn"
				role="img"
				aria-label={`A student's progress page: ${done} of ${LESSONS.length} lessons watched, modules 1 and 2 done, module 3 under way.`}
			>
				<div aria-hidden="true" mix={[raw({ padding: "1rem", display: "grid", gap: "0.25rem" })]}>
					<div
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								alignItems: "baseline",
								paddingBlockEnd: "0.75rem",
							}),
						]}
					>
						<span mix={[raw({ fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" })]}>
							Sam's wheel
						</span>
						<span
							mix={[
								raw({
									fontFamily: "var(--ui-font-mono)",
									fontSize: "0.75rem",
									color: "var(--ui-neutral-fg-muted)",
									fontVariantNumeric: "tabular-nums",
								}),
							]}
						>
							{done} / {LESSONS.length} lessons
						</span>
					</div>
					{MODULES.map((module, index) => {
						let watched = WATCHED[index] ?? 0;
						let total = module.lessons.length;
						let state = progressState(watched, total);
						return (
							<div
								key={module.title}
								data-state={state}
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "2.75rem minmax(0, 1fr) 4.5rem",
										alignItems: "center",
										gap: "0.75rem",
										padding: "0.5rem",
										borderRadius: "var(--ui-landing-card-radius-inner)",
										fontSize: "0.8125rem",
										lineHeight: "1.125rem",
									}),
									when(
										"&[data-state='doing']",
										raw({ backgroundColor: "var(--ui-brand-bg-tint)" }),
									),
									when("&[data-state='ahead']", raw({ opacity: "0.6" })),
								]}
							>
								<span mix={[raw({ display: "block", blockSize: "2.75rem" })]}>
									<Pot
										id={`path-${index}`}
										shape={module.shape}
										glaze={state === "done" ? "oklch(0.55 0.15 262)" : undefined}
									/>
								</span>
								<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
									<span mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}>
										{index + 1} · {module.piece}
									</span>
									<span mix={[raw({ color: "var(--ui-neutral-fg)", textWrap: "pretty" })]}>
										{module.outcome}
									</span>
								</span>
								<span mix={[raw({ display: "grid", gap: "0.25rem", justifyItems: "end" })]}>
									<span
										mix={[
											raw({
												fontFamily: "var(--ui-font-mono)",
												fontSize: "0.6875rem",
												color: "var(--ui-neutral-fg-muted)",
												fontVariantNumeric: "tabular-nums",
											}),
										]}
									>
										{state === "done" ? "Done" : `${watched} of ${total}`}
									</span>
									<span
										mix={[
											raw({
												inlineSize: "100%",
												blockSize: "0.3125rem",
												borderRadius: "9999px",
												backgroundColor: "var(--ui-neutral-bg-tint-hover)",
												overflow: "clip",
											}),
										]}
									>
										<span
											mix={[
												raw({
													display: "block",
													blockSize: "100%",
													inlineSize: `${(watched / total) * 100}%`,
													backgroundColor: "var(--ui-brand-bg-solid)",
												}),
											]}
										/>
									</span>
								</span>
							</div>
						);
					})}
				</div>
			</ProductFrame>
		);
	};
}

/**
 * Where a student stands in a module: every lesson watched, some, or none yet.
 *
 * @param watched Lessons watched.
 * @param total Lessons in the module.
 * @returns `done`, `doing` or `ahead`.
 */
function progressState(watched: number, total: number): "done" | "doing" | "ahead" {
	if (watched >= total) return "done";
	if (watched > 0) return "doing";
	return "ahead";
}
