/**
 * The ticket releases as three printed stubs side by side: the sold-out early bird stamped
 * across, the release on sale printed in pink with the seats it has left, and the late release
 * waiting for its date. Only the release on sale has a button that does anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Button } from "@sdxc/ui";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";
import { css } from "remix/component";

import type { Tier } from "~/resources/views/demos/conference/data";

import { TIERS } from "~/resources/views/demos/conference/data";
import { BLEND, BLUE, DISPLAY, MONO, PINK } from "~/resources/views/demos/conference/ink";
import { renderNearView } from "~/resources/views/demos/near-view";

/** What each release's flag reads, by state. */
const FLAGS: Record<Tier["state"], string> = {
	"sold-out": "Gone",
	"on-sale": "On sale now",
	upcoming: "Next release",
};

/**
 * Renders the band.
 *
 * @returns The render function producing the band.
 */
export default function ConferenceTickets() {
	return () => (
		<LandingSection id="tickets" mix={[renderNearView(980, 1900)]}>
			<LandingHeader
				eyebrow={`Tickets · ${TIERS.reduce((sum, tier) => sum + tier.seats, 0)} seats in three releases`}
				layout="split"
				description={
					<>
						Every ticket gets the same day: both rooms, lunch, the party and the videos. The price
						only goes up as releases sell out, so{" "}
						<strong>the cheapest seat is the one on sale now</strong>.
					</>
				}
				parts={{ title: [css({ textTransform: "uppercase" })] }}
			>
				One day, one price at a time
			</LandingHeader>
			<ol
				aria-label="Ticket releases"
				mix={css({
					listStyle: "none",
					margin: "0",
					padding: "0",
					display: "grid",
					gap: "1.5rem",
					"@container (min-width: 64rem)": {
						gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
						alignItems: "stretch",
					},
				})}
			>
				{TIERS.map((tier) => (
					<TicketStub key={tier.id} tier={tier} />
				))}
			</ol>
			<p
				mix={css({
					margin: "2rem 0 0",
					paddingBlockStart: "1rem",
					borderBlockStart: `1px solid ${BLUE}`,
					maxInlineSize: "48rem",
					textWrap: "pretty",
				})}
			>
				<strong>40 free seats</strong> go to students and to people under-represented in tech.{" "}
				<a
					href="/examples/overprint/scholarships"
					mix={css({ color: "inherit", textUnderlineOffset: "0.15em" })}
				>
					Apply by 1 February
				</a>
				; we answer everyone by 15 February.
			</p>
		</LandingSection>
	);
}

/**
 * One release as a stub: the flag, the name and price over a perforation, then what it
 * includes, its seats, and its action. The state is on `data-state` for styling and tests.
 */
function TicketStub(handle: Handle<{ tier: Tier }>) {
	return () => {
		let { tier } = handle.props;
		let current = tier.state === "on-sale";
		let soldOut = tier.state === "sold-out";
		let ink = current ? PINK : BLUE;
		return (
			<li
				data-state={tier.state}
				aria-current={current ? "true" : undefined}
				mix={css({
					position: "relative",
					display: "grid",
					gridTemplateRows: "auto auto 1fr auto",
					border: `${current ? "4px" : "2px"} solid ${ink}`,
					backgroundColor: "var(--ui-bg)",
					"@container (min-width: 64rem)": { marginBlockStart: current ? "-1rem" : "0" },
				})}
			>
				<p
					mix={css({
						margin: "0",
						paddingBlock: "0.5rem",
						paddingInline: "1.25rem",
						backgroundColor: ink,
						color: current ? "oklch(0.18 0.05 264)" : "var(--ui-bg)",
						fontFamily: MONO,
						fontSize: "0.8125rem",
						fontWeight: "700",
						textTransform: "uppercase",
						letterSpacing: "0.1em",
					})}
				>
					{FLAGS[tier.state]}
				</p>
				<div
					mix={css({
						display: "grid",
						gap: "0.25rem",
						padding: "1.25rem",
						paddingBlockEnd: "1.5rem",
					})}
				>
					<h3
						mix={css({
							margin: "0",
							fontFamily: DISPLAY,
							fontWeight: "900",
							fontSynthesis: "none",
							fontSize: "2rem",
							lineHeight: "1",
							textTransform: "uppercase",
						})}
					>
						{tier.name}
					</h3>
					<p
						mix={css({
							margin: "0",
							fontFamily: DISPLAY,
							fontWeight: "900",
							fontSynthesis: "none",
							fontSize: "clamp(4rem, 3rem + 4cqi, 5.5rem)",
							lineHeight: "0.95",
							color: current ? PINK : "inherit",
							textDecoration: soldOut ? `line-through 0.08em ${PINK}` : "none",
						})}
					>
						<span mix={css({ fontSize: "0.5em", verticalAlign: "0.7em" })}>€</span>
						{tier.price}
						{soldOut ? (
							<span mix={css({ position: "absolute", clipPath: "inset(50%)" })}> (sold out)</span>
						) : null}
					</p>
					<p mix={css({ margin: "0", fontSize: "0.9375rem" })}>{tier.window}</p>
				</div>
				<div
					mix={css({
						display: "grid",
						alignContent: "start",
						gap: "1rem",
						padding: "1.25rem",
						borderBlockStart: `3px dashed ${ink}`,
					})}
				>
					<ul
						mix={css({
							margin: "0",
							paddingInlineStart: "1.1rem",
							display: "grid",
							gap: "0.25rem",
						})}
					>
						{tier.includes.map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
					<SeatMeter tier={tier} ink={ink} />
				</div>
				<div mix={css({ padding: "1.25rem", paddingBlockStart: "0" })}>
					<TierAction tier={tier} />
				</div>
				{soldOut ? <SoldOutStamp /> : null}
			</li>
		);
	};
}

/** Seats sold of the release's total, as a figure and a bar of ink. */
function SeatMeter(handle: Handle<{ tier: Tier; ink: string }>) {
	return () => {
		let { tier, ink } = handle.props;
		let sold = tier.seats - tier.left;
		return (
			<div mix={css({ display: "grid", gap: "0.375rem" })}>
				<p
					mix={css({
						margin: "0",
						display: "flex",
						justifyContent: "space-between",
						gap: "1rem",
						fontFamily: MONO,
						fontSize: "0.8125rem",
						fontVariantNumeric: "tabular-nums",
					})}
				>
					<span>
						{sold} of {tier.seats} sold
					</span>
					<strong>{tier.state === "upcoming" ? `${tier.seats} seats` : `${tier.left} left`}</strong>
				</p>
				<div
					aria-hidden="true"
					mix={css({ blockSize: "0.75rem", boxShadow: `inset 0 0 0 2px ${ink}` })}
				>
					<div
						mix={css({
							blockSize: "100%",
							inlineSize: `${(sold / tier.seats) * 100}%`,
							backgroundColor: ink,
						})}
					/>
				</div>
			</div>
		);
	};
}

/**
 * The release's action: a checkout form for the one on sale, and a disabled button saying why
 * for the others, so a reader sees at a glance which button works.
 */
function TierAction(handle: Handle<{ tier: Tier }>) {
	return () => {
		let { tier } = handle.props;
		if (tier.state === "on-sale") {
			return (
				<form method="post" action="/examples/overprint/checkout" mix={css({ display: "grid" })}>
					<input type="hidden" name="release" value={tier.id} />
					<Button type="submit" color="brand" mix={[landingCtaChrome()]}>
						Buy a {tier.name.toLowerCase()} ticket
					</Button>
				</form>
			);
		}
		return (
			<Button
				type="button"
				variant="surface"
				disabled
				mix={[landingCtaChrome(), css({ inlineSize: "100%" })]}
			>
				{tier.state === "sold-out" ? "Sold out" : "On sale 1 March"}
			</Button>
		);
	};
}

/** The rubber stamp across a sold-out stub, printed in pink over everything under it. */
function SoldOutStamp() {
	return () => (
		<span
			aria-hidden="true"
			mix={css({
				position: "absolute",
				insetBlockStart: "5.5rem",
				insetInlineEnd: "0.75rem",
				paddingBlock: "0.25rem",
				paddingInline: "0.75rem",
				border: `4px solid ${PINK}`,
				color: PINK,
				fontFamily: DISPLAY,
				fontWeight: "900",
				fontSynthesis: "none",
				fontSize: "2.5rem",
				lineHeight: "1",
				textTransform: "uppercase",
				transform: "rotate(-12deg)",
				mixBlendMode: BLEND,
				pointerEvents: "none",
			})}
		>
			Sold out
		</span>
	);
}
