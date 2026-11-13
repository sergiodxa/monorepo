/**
 * The code of conduct, printed solid in blue across the page so nobody scrolls past it: what
 * the conference expects, then exactly how to reach the team, by phone, by email or in person,
 * at any hour of the day.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LandingSection } from "@sdxc/ui/landing";
import { css } from "remix/component";

import { BLUE, DISPLAY, MONO, PINK } from "~/resources/views/demos/conference/ink";
import { renderNearView } from "~/resources/views/demos/near-view";

/** What the code asks of everyone in the building, speakers and sponsors included. */
const RULES = [
	"Harassment of any kind gets you removed, with no refund.",
	"Ask before you photograph someone; a red lanyard means no photos.",
	"Talks and slides follow the same code as the hallway.",
	"Sponsors staff their stands; nobody gets scanned without asking.",
];

/** How to reach the conduct team, label then the means. */
const CONTACTS = [
	["Call or text", "+31 10 555 0127", "tel:+31105550127"],
	["Email", "conduct@overprint.example", "mailto:conduct@overprint.example"],
	["In person", "Anyone in a pink lanyard", "#venue"],
] as const;

/**
 * Renders the band: blue stock with paper-coloured type, the rules on one side and the
 * contacts on the other, with a link to the full text.
 *
 * @returns The render function producing the band.
 */
export default function ConferenceConduct() {
	return () => (
		<LandingSection
			id="conduct"
			mix={[
				renderNearView(640, 1250),
				css({
					backgroundColor: BLUE,
					color: "var(--ui-bg)",
					"& a": { color: "inherit", textUnderlineOffset: "0.15em" },
					"& a:focus-visible": { outline: `3px solid ${PINK}`, outlineOffset: "3px" },
				}),
			]}
		>
			<div
				mix={css({
					display: "grid",
					gap: "2.5rem",
					"@container (min-width: 64rem)": {
						gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
						gap: "4rem",
					},
				})}
			>
				<div mix={css({ display: "grid", gap: "1.5rem", alignContent: "start" })}>
					<p
						mix={css({
							margin: "0",
							fontFamily: MONO,
							fontSize: "0.8125rem",
							fontWeight: "700",
							textTransform: "uppercase",
							letterSpacing: "0.12em",
						})}
					>
						Code of conduct
					</p>
					<h2
						mix={css({
							margin: "0",
							fontFamily: DISPLAY,
							fontWeight: "900",
							fontSynthesis: "none",
							fontSize: "var(--ui-landing-chapter-size)",
							lineHeight: "0.88",
							textTransform: "uppercase",
							textWrap: "balance",
						})}
					>
						Be kind, or be{" "}
						<span
							mix={css({
								paddingInline: "0.08em",
								backgroundColor: PINK,
								color: "oklch(0.18 0.05 264)",
								boxDecorationBreak: "clone",
							})}
						>
							outside
						</span>
					</h2>
					<ol
						mix={css({
							margin: "0",
							paddingInlineStart: "1.5rem",
							listStyleType: "decimal",
							display: "grid",
							gap: "0.625rem",
							fontSize: "1.0625rem",
						})}
					>
						{RULES.map((rule) => (
							<li key={rule}>{rule}</li>
						))}
					</ol>
					<p mix={css({ margin: "0" })}>
						<a href="/examples/overprint/code-of-conduct">
							Read the full code and how we handle reports
						</a>
					</p>
				</div>
				<div mix={css({ display: "grid", alignContent: "start" })}>
					<h3
						mix={css({
							margin: "0",
							paddingBlockEnd: "0.75rem",
							borderBlockEnd: "3px solid currentColor",
							fontFamily: DISPLAY,
							fontWeight: "900",
							fontSynthesis: "none",
							fontSize: "2rem",
							lineHeight: "1",
							textTransform: "uppercase",
						})}
					>
						Tell us, any hour
					</h3>
					<dl mix={css({ margin: "0" })}>
						{CONTACTS.map(([label, value, href]) => (
							<div
								key={label}
								mix={css({
									display: "grid",
									gap: "0.25rem",
									paddingBlock: "1rem",
									borderBlockEnd: "1px solid currentColor",
								})}
							>
								<dt
									mix={css({
										fontFamily: MONO,
										fontSize: "0.75rem",
										fontWeight: "700",
										textTransform: "uppercase",
										letterSpacing: "0.1em",
									})}
								>
									{label}
								</dt>
								<dd mix={css({ margin: "0", fontSize: "1.25rem", fontWeight: "700" })}>
									<a href={href}>{value}</a>
								</dd>
							</div>
						))}
					</dl>
					<p mix={css({ margin: "1rem 0 0", fontSize: "0.9375rem" })}>
						Two trained people answer from the evening before to the morning after. Reports stay
						between you and them.
					</p>
				</div>
			</div>
		</LandingSection>
	);
}
