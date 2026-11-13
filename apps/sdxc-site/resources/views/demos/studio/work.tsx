/**
 * Quoin's selected work: a short running head and claim, then three case studies as
 * full-bleed plates, each stating the problem, what the studio built and the figure it moved,
 * so every project is judged by its result rather than its pictures.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { CaseStudy, LandingSection } from "@sdxc/ui/landing";
import { landingLead } from "@sdxc/ui/styles";

import { renderNearView } from "~/resources/views/demos/near-view";
import { chapter, pageGrid, runningHead, span } from "~/resources/views/demos/studio/grid";
import CeramicsScene from "~/resources/views/demos/studio/scene-ceramics";
import HarbourScene from "~/resources/views/demos/studio/scene-harbour";
import LibraryScene from "~/resources/views/demos/studio/scene-library";

/**
 * Renders the section's opening and the three spreads, the second and third laid out only
 * as they near the viewport.
 *
 * @returns The render function producing the work section.
 */
export default function StudioWork() {
	return () => (
		<>
			<LandingSection id="work" spacing="compact">
				<div mix={[pageGrid()]}>
					<p mix={[runningHead()]}>
						<span>01 — Selected work</span>
						<span>2023–2026</span>
					</p>
					<div mix={[span("4 / -1"), raw({ display: "grid", gap: "1.5rem" })]}>
						<h2 mix={[chapter()]}>Judge us by the number under each picture</h2>
						<p mix={[landingLead(), raw({ margin: "0" })]}>
							Every engagement starts by agreeing what we will measure, and ends by measuring it.
							These three are from the last three years.
						</p>
					</div>
				</div>
			</LandingSection>
			<CaseStudy
				spacing="compact"
				index="01 / 03"
				client="Harbour Line"
				meta="River ferries · 2025 · 14 weeks"
				title="A ferry that tells you the tram will wait"
				scene={<HarbourScene />}
				sceneLabel="The departures board on pier 3 at 08:14: the 08:22 to Hoboken Veer reads “Tram 4 waits 3 min”, over a map of the river and its four stops."
				plate="#0d1b2e"
				problem={
					<>
						Riders changing from ferry to tram missed one connection in five, and the board on the
						pier could not say which.
					</>
				}
				built={
					<>
						One timetable service behind the pier boards, the rider app and the tram dispatch, so a
						late ferry <strong>holds its tram</strong> and every screen says so.
					</>
				}
				result={{
					value: "−31%",
					label: "missed connections over the first winter, against the winter before",
				}}
			/>
			<CaseStudy
				spacing="compact"
				index="02 / 03"
				client="Mercer Public Library"
				meta="Seven branches · 2024 · 22 weeks"
				title="A catalogue that answers in the library’s own words"
				scene={<LibraryScene />}
				sceneLabel="The catalogue answering “books about tidal rivers” with three titles and their shelves, beside the Mercer Sign letterforms and the floor 2 sign they match."
				plate="#cfdccd"
				mix={[renderNearView(1240, 1500)]}
				problem={
					<>
						A search box that only matched exact titles, and shelf marks that meant nothing to
						anyone standing between the shelves.
					</>
				}
				built={
					<>
						A plain-language search over the catalogue, and <strong>one typeface</strong> drawn for
						the screens and the signs, so a result reads like the floor it sends you to.
					</>
				}
				result={{
					value: "48s → 19s",
					label: "median time from search to the right shelf, timed at three branches",
				}}
			/>
			<CaseStudy
				spacing="compact"
				index="03 / 03"
				client="Oda Ceramics"
				meta="Studio pottery · 2023 · 9 weeks"
				title="A checkout with three fields and a bowl"
				scene={<CeramicsScene />}
				sceneLabel="A one-page checkout for the large Tide bowl at €48 with three fields and Bancontact chosen, beside the ash, tide and iron glaze swatches."
				plate="#b65f43"
				mix={[renderNearView(1240, 1500)]}
				problem={
					<>
						Eleven fields over four pages, and no Bancontact, for buyers who were mostly Belgian and
						mostly on their phones.
					</>
				}
				built={
					<>
						A one-page checkout that asks only what the courier needs, with the{" "}
						<strong>payment methods buyers already use</strong> first.
					</>
				}
				result={{
					value: "2.1% → 3.4%",
					label: "checkout conversion, ninety days before and after",
				}}
			/>
		</>
	);
}
