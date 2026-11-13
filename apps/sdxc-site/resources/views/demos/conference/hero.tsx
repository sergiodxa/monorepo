/**
 * The poster's top sheet: the name set as large as the column allows, "Over" in pink and
 * "print" in blue printed across it, then the date, the city and the time left until the
 * doors open, ruled off like the bottom of a gig poster, and the one action that matters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { LinkButton } from "@sdxc/ui";
import { Countdown, LandingSection } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";
import { css } from "remix/component";

import { DOORS_OPEN, TIERS } from "~/resources/views/demos/conference/data";
import { BLEND, BLUE, DISPLAY, MONO, PINK } from "~/resources/views/demos/conference/ink";

/**
 * Renders the hero. The countdown is computed from the request's clock and ticks from the
 * reader's once its island loads, so a cached copy of the page still counts true.
 *
 * @returns The render function producing the hero.
 */
export default function ConferenceHero() {
	return () => {
		let regular = TIERS.find((tier) => tier.state === "on-sale");
		return (
			<LandingSection spacing="compact" mix={css({ overflow: "clip" })}>
				<div mix={css({ display: "grid", gap: "clamp(1.5rem, 4cqi, 2.5rem)" })}>
					<p
						mix={css({
							margin: "0",
							display: "flex",
							flexWrap: "wrap",
							justifyContent: "space-between",
							gap: "0.5rem 1.5rem",
							fontFamily: MONO,
							fontSize: "0.8125rem",
							fontWeight: "600",
							textTransform: "uppercase",
							letterSpacing: "0.1em",
						})}
					>
						<span>A one-day conference on the web platform</span>
						<span mix={css({ color: "var(--ui-brand-fg)" })}>Fourth edition</span>
					</p>
					<PosterTitle />
					<Facts />
					<div
						mix={css({
							display: "grid",
							gap: "1.5rem",
							alignItems: "end",
							"@container (min-width: 56rem)": { gridTemplateColumns: "minmax(0, 1fr) auto" },
						})}
					>
						<p
							mix={css({
								margin: "0",
								maxInlineSize: "38rem",
								fontSize: "var(--ui-landing-hero-lead-size)",
								lineHeight: "var(--ui-landing-hero-lead-leading)",
								textWrap: "pretty",
							})}
						>
							Twelve talks on what browsers ship this year, in two rooms, for 780 people who build
							for the web. <strong>Regular tickets are on sale, {regular?.left} left.</strong>
						</p>
						<div
							mix={css({
								display: "flex",
								flexWrap: "wrap",
								gap: "0.75rem",
								"@container (max-width: 30rem)": { "& > a": { flex: "1 1 100%" } },
							})}
						>
							<LinkButton href="#tickets" color="brand" mix={[landingCtaChrome()]}>
								Get a ticket, €{regular?.price}
							</LinkButton>
							<LinkButton href="#schedule" variant="surface" mix={[landingCtaChrome()]}>
								See the schedule
							</LinkButton>
						</div>
					</div>
				</div>
			</LandingSection>
		);
	};
}

/**
 * The name in two inks: "Over" in pink, "print" in blue set across its lower edge, where the
 * two inks combine into a third. The words carry no space between them, so the heading reads
 * as one word.
 */
function PosterTitle() {
	return () => (
		<h1
			mix={css({
				margin: "0",
				display: "grid",
				fontFamily: DISPLAY,
				fontWeight: "900",
				fontSynthesis: "none",
				fontSize: "clamp(5.5rem, 33cqi, 25rem)",
				lineHeight: "0.8",
				letterSpacing: "-0.01em",
				textTransform: "uppercase",
				textWrap: "nowrap",
			})}
		>
			<span mix={css({ color: PINK })}>Over</span>
			<span
				mix={css({
					color: BLUE,
					justifySelf: "end",
					marginBlockStart: "-0.16em",
					mixBlendMode: BLEND,
				})}
			>
				print
			</span>
			<span
				mix={css({
					position: "absolute",
					inlineSize: "1px",
					blockSize: "1px",
					overflow: "hidden",
					clipPath: "inset(50%)",
					whiteSpace: "nowrap",
				})}
			>
				{" "}
				2027
			</span>
		</h1>
	);
}

/**
 * The facts a poster's foot carries: the day, the place and the time left, three cells ruled
 * in ink, side by side once the column has room for them.
 */
function Facts() {
	return () => (
		<dl
			mix={css({
				margin: "0",
				display: "grid",
				borderBlock: `3px solid ${BLUE}`,
				"@container (min-width: 48rem)": { gridTemplateColumns: "1fr 1fr 1.25fr" },
				"& > div": {
					display: "grid",
					alignContent: "start",
					gap: "0.375rem",
					paddingBlock: "1rem",
					"@container (min-width: 48rem)": { paddingInline: "1.25rem" },
				},
				"& > div + div": {
					borderBlockStart: `1px solid ${BLUE}`,
					"@container (min-width: 48rem)": {
						borderBlockStart: "0",
						borderInlineStart: `1px solid ${BLUE}`,
					},
				},
				"& > div:first-child": { "@container (min-width: 48rem)": { paddingInlineStart: "0" } },
				"& dt": {
					fontFamily: MONO,
					fontSize: "0.75rem",
					fontWeight: "600",
					textTransform: "uppercase",
					letterSpacing: "0.1em",
				},
				"& dd": { margin: "0" },
			})}
		>
			<div>
				<dt>When</dt>
				<dd>
					<FactValue>
						<time dateTime="2027-04-15">Thu 15 April 2027</time>
					</FactValue>
				</dd>
				<dd>Doors 08:30, party from 17:30</dd>
			</div>
			<div>
				<dt>Where</dt>
				<dd>
					<FactValue>
						<a href="#venue" mix={css({ color: "inherit", textUnderlineOffset: "0.12em" })}>
							Rotterdam, NL
						</a>
					</FactValue>
				</dd>
				<dd>De Gieterij, an old foundry on the river</dd>
			</div>
			<div>
				<dt>Doors open in</dt>
				<dd
					mix={css({
						"--ui-countdown-gap": "clamp(0.875rem, 2.5cqi, 1.5rem)",
						"--ui-countdown-align": "start",
						"--ui-countdown-value-font": DISPLAY,
						"--ui-countdown-value-size": "clamp(2.25rem, 5cqi, 3.25rem)",
						"--ui-countdown-value-weight": "900",
						"--ui-countdown-value-color": PINK,
						"--ui-countdown-label-font": MONO,
						"--ui-countdown-label-size": "0.75rem",
						fontSynthesis: "none",
						textTransform: "uppercase",
						letterSpacing: "0.04em",
						"& [data-slot='countdown-done']": {
							fontFamily: DISPLAY,
							fontSize: "2.25rem",
							color: PINK,
						},
					})}
				>
					<Countdown
						to={DOORS_OPEN}
						done="Doors are open"
						aria-label="Time left until the doors open"
						live
					/>
				</dd>
			</div>
		</dl>
	);
}

/** One fact's headline value, in the display face at a size the three cells share. */
function FactValue(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<span
			mix={css({
				display: "block",
				fontFamily: DISPLAY,
				fontWeight: "900",
				fontSynthesis: "none",
				fontSize: "clamp(2.25rem, 5cqi, 3.25rem)",
				lineHeight: "1",
				textTransform: "uppercase",
			})}
		>
			{handle.props.children}
		</span>
	);
}
