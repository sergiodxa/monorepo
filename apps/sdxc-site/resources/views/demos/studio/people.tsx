/**
 * Quoin's people: everyone a client works with, each as a typographic portrait plate with
 * their initials, role and the year they joined, so the page shows the team a project gets
 * rather than a leadership row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { LandingSection } from "@sdxc/ui/landing";
import { landingLead } from "@sdxc/ui/styles";

import { renderNearView } from "~/resources/views/demos/near-view";
import {
	BAND,
	caption,
	chapter,
	pageGrid,
	runningHead,
	span,
} from "~/resources/views/demos/studio/grid";
import { DIDONE } from "~/resources/views/demos/studio/type";

/** The studio, founders first, then by the year each joined; the hatch angle tells plates apart. */
const PEOPLE = [
	{ name: "Lieve Martens", initials: "LM", role: "Founder · Design", since: 2014, angle: 45 },
	{ name: "Tomás Okonkwo", initials: "TO", role: "Founder · Engineering", since: 2014, angle: 135 },
	{ name: "Hanna Vos", initials: "HV", role: "Research", since: 2016, angle: 90 },
	{ name: "Rémi Delacroix", initials: "RD", role: "Type & identity", since: 2018, angle: 0 },
	{ name: "Saskia Brandt", initials: "SB", role: "Engineering", since: 2019, angle: 60 },
	{ name: "Yusuf Aydın", initials: "YA", role: "Engineering", since: 2021, angle: 120 },
	{ name: "Mei Lin", initials: "ML", role: "Interaction design", since: 2022, angle: 30 },
	{ name: "Joost Peeters", initials: "JP", role: "Engineering", since: 2024, angle: 150 },
];

/**
 * Renders the claim over a grid of portraits: two a row on a phone, four from the `lg`
 * container, each a quarter of the page grid.
 *
 * @returns The render function producing the people band.
 */
export default function StudioPeople() {
	return () => (
		<LandingSection id="people" mix={[renderNearView(1260, 1729)]}>
			<div mix={[pageGrid(), raw({ rowGap: "3rem" })]}>
				<p mix={[runningHead()]}>
					<span>04 — People</span>
					<span>Eight of eleven</span>
				</p>
				<h2 mix={[span("1 / 8"), chapter()]}>The people you meet are the people who build it</h2>
				<p mix={[span("8 / -1"), landingLead(), raw({ margin: "0", alignSelf: "end" })]}>
					No account managers. Each project gets two designers and two engineers from this page,
					from the first interview to the 90-day measurement.
				</p>
				<ul mix={[portraits()]}>
					{PEOPLE.map((person) => (
						<li
							key={person.name}
							mix={[raw({ display: "grid", gap: "0.75rem", alignContent: "start" })]}
						>
							<span aria-hidden="true" mix={[plate(person.angle)]}>
								{person.initials}
							</span>
							<span
								mix={[
									raw({
										fontFamily: DIDONE,
										fontSize: "1.375rem",
										lineHeight: "1.2",
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								{person.name}
							</span>
							<span mix={[caption()]}>
								{person.role} · since {person.since}
							</span>
						</li>
					))}
				</ul>
			</div>
		</LandingSection>
	);
}

/** The portrait grid: two a row on a phone, four from `lg`. */
function portraits() {
	return [
		raw({
			gridColumn: "1 / -1",
			margin: "0",
			padding: "0",
			listStyle: "none",
			display: "grid",
			gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
			gap: "2.5rem 1rem",
		}),
		at("lg", BAND, raw({ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", columnGap: "2rem" })),
	];
}

/**
 * A portrait plate: a 4:5 tinted field ruled with fine hatching at the person's angle, their
 * initials set large in the Didone at its foot.
 *
 * @param angle The hatching's angle in degrees.
 */
function plate(angle: number) {
	return raw({
		aspectRatio: "4 / 5",
		display: "flex",
		alignItems: "flex-end",
		padding: "1rem",
		fontFamily: DIDONE,
		fontSize: "clamp(3rem, 8cqi, 5.5rem)",
		lineHeight: "0.85",
		letterSpacing: "-0.04em",
		color: "var(--ui-neutral-fg-emphasis)",
		backgroundColor: "var(--ui-neutral-bg-tint)",
		backgroundImage: `repeating-linear-gradient(${angle}deg, var(--ui-landing-hairline) 0 1px, transparent 1px 9px)`,
	});
}
