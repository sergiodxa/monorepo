/**
 * The certificate band: what it takes to earn one, steps a student can plan around, beside
 * the certificate itself with the address anyone can check it at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { FeatureBand } from "@sdxc/ui/landing";

import { CenteredLogo } from "~/resources/views/demos/course/chrome";
import { Pot } from "~/resources/views/demos/course/clay";
import { LESSONS, MODULES } from "~/resources/views/demos/course/data";
import { renderNearView } from "~/resources/views/demos/near-view";

/**
 * Renders the band: three requirements beside the certificate.
 *
 * @returns The render function producing the band.
 */
export function CourseCertificate() {
	return () => (
		<FeatureBand
			id="certificate"
			layout="split"
			lean="media"
			mediaSide="start"
			eyebrow="Certificate"
			title="Earned with pieces, not with clicks"
			description={
				<>
					Watching every lesson is not enough. <strong>You send three finished pieces</strong>, and
					a potter checks them against what the modules teach.
				</>
			}
			media={<Certificate />}
			mix={[renderNearView(465, 880)]}
		>
			<ul>
				<li>Photograph a cylinder, a bowl and a lidded jar from two sides</li>
				<li>Reviewed within ten days, with notes on each piece</li>
				<li>A public address that shows the pieces it was earned with</li>
			</ul>
		</FeatureBand>
	);
}

/**
 * The certificate as a student receives it: the wordmark, their name, the course, the
 * three pieces drawn small, the reviewer and the address it verifies at.
 *
 * @returns The render function producing the certificate.
 */
function Certificate() {
	return () => (
		<div
			role="img"
			aria-label={`A Centered certificate awarded to Sam Okoro for completing ${MODULES.length} modules and ${LESSONS.length} lessons, verifiable at centered.example/c/7Q4K2M`}
			mix={[
				raw({
					position: "relative",
					display: "grid",
					gap: "1.25rem",
					padding: "clamp(1.25rem, 4vw, 2.25rem)",
					borderRadius: "var(--ui-landing-card-radius-outer)",
					backgroundColor: "var(--ui-surface-raised)",
					boxShadow: "var(--ui-shadow-stage)",
					backgroundImage:
						"radial-gradient(circle at 100% 0, var(--ui-brand-bg-tint) 0 9rem, transparent 9rem)",
					textAlign: "start",
				}),
			]}
		>
			<div aria-hidden="true" mix={[raw({ display: "grid", gap: "1.25rem" })]}>
				<div
					mix={[
						raw({
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							gap: "1rem",
						}),
					]}
				>
					<CenteredLogo />
					<span
						mix={[
							raw({
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.75rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						No. 7Q4-K2M
					</span>
				</div>
				<div mix={[raw({ display: "grid", gap: "0.25rem" })]}>
					<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
						This certifies that
					</span>
					<span
						mix={[
							raw({
								fontFamily: "var(--ui-font-display)",
								fontWeight: "700",
								fontSize: "clamp(1.75rem, 4vw, 2.25rem)",
								letterSpacing: "-0.03em",
								lineHeight: "1.1",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						Sam Okoro
					</span>
					<span mix={[raw({ color: "var(--ui-neutral-fg)", textWrap: "pretty" })]}>
						threw the pieces of all {MODULES.length} modules of Wheel-throwing, from a lump of clay
						to a lidded jar.
					</span>
				</div>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
							gap: "0.75rem",
						}),
					]}
				>
					{(["cylinder", "bowl", "jar"] as const).map((shape) => (
						<span
							key={shape}
							mix={[
								raw({
									display: "grid",
									placeItems: "center",
									aspectRatio: "1",
									borderRadius: "var(--ui-landing-card-radius-inner)",
									backgroundColor: "var(--ui-neutral-bg-tint)",
									padding: "0.75rem",
								}),
							]}
						>
							<Pot id={`certificate-${shape}`} shape={shape} glaze="oklch(0.55 0.15 262)" />
						</span>
					))}
				</div>
				<div
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							justifyContent: "space-between",
							gap: "0.5rem 1rem",
							paddingBlockStart: "1rem",
							borderBlockStart: "1px solid var(--ui-landing-hairline)",
							fontSize: "0.8125rem",
							color: "var(--ui-neutral-fg)",
						}),
					]}
				>
					<span>Reviewed by Ines Duarte · March 14, 2027</span>
					<span mix={[raw({ fontFamily: "var(--ui-font-mono)", color: "var(--ui-brand-fg)" })]}>
						centered.example/c/7Q4K2M
					</span>
				</div>
			</div>
		</div>
	);
}
