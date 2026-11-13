/**
 * The last sheet: the sign-off set as large as the name at the top, the one ticket button
 * under it with the seats the current release has left, so the page ends where it began.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LinkButton } from "@sdxc/ui";
import { LandingSection } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";
import { css } from "remix/component";

import { TIERS } from "~/resources/views/demos/conference/data";
import { BLEND, BLUE, DISPLAY, MONO, PINK } from "~/resources/views/demos/conference/ink";

/**
 * Renders the closing band.
 *
 * @returns The render function producing the band.
 */
export default function ConferenceClosing() {
	return () => {
		let current = TIERS.find((tier) => tier.state === "on-sale");
		return (
			<LandingSection spacing="cta" mix={css({ overflow: "clip" })}>
				<div mix={css({ display: "grid", gap: "2rem", justifyItems: "start" })}>
					<h2
						mix={css({
							margin: "0",
							display: "grid",
							fontFamily: DISPLAY,
							fontWeight: "900",
							fontSynthesis: "none",
							fontSize: "clamp(4rem, 17cqi, 14rem)",
							lineHeight: "0.82",
							textTransform: "uppercase",
						})}
					>
						<span mix={css({ color: BLUE })}>See you in</span>
						<span mix={css({ color: PINK, marginBlockStart: "-0.12em", mixBlendMode: BLEND })}>
							Rotterdam
						</span>
					</h2>
					<div
						mix={css({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							gap: "1rem 1.5rem",
						})}
					>
						<LinkButton href="#tickets" color="brand" mix={[landingCtaChrome()]}>
							Get a ticket, €{current?.price}
						</LinkButton>
						<p
							mix={css({
								margin: "0",
								fontFamily: MONO,
								fontSize: "0.875rem",
								fontWeight: "700",
								textTransform: "uppercase",
								letterSpacing: "0.08em",
							})}
						>
							{current?.left} {current?.name.toLowerCase()} seats left · Thu 15 April 2027
						</p>
					</div>
				</div>
			</LandingSection>
		);
	};
}
