/**
 * Live preview for `ContributorWall`: thirty-five people who committed to an open-source
 * project as a mosaic of initial tiles, closing on a tile that links to everyone else, so
 * the wall fills rows of six, nine or twelve as its container widens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { ContributorWall } from "@sdxc/ui/landing";

/** The people the wall shows; with the closing tile they make 36, which every step divides. */
const NAMES = [
	"Ana Souza",
	"Bo Lindqvist",
	"Chidi Okafor",
	"Dana Weiss",
	"Elif Kaya",
	"Femi Adeyemi",
	"Greta Holm",
	"Hiro Tanaka",
	"Ines Duarte",
	"Jonas Berg",
	"Kai Moana",
	"Lena Fischer",
	"Mateo Ruiz",
	"Nadia Haddad",
	"Oskar Nyberg",
	"Priya Raman",
	"Quinn Avery",
	"Rosa Medina",
	"Sami Laine",
	"Tomás Ibarra",
	"Uma Patel",
	"Viktor Hale",
	"Wen Li",
	"Ximena Cruz",
	"Yusuf Demir",
	"Zoe Martin",
	"Aiko Mori",
	"Bruno Costa",
	"Clara Novak",
	"Diego Paz",
	"Esther Cohen",
	"Felix Wong",
	"Gaia Russo",
	"Hugo Blanc",
	"Ivy Chen",
] as const;

/** The source the page shows, matching the markup below. */
const CODE = `<ContributorWall aria-label="Contributors">
	{people.map((person) => (
		<ContributorWall.Person href={person.url} name={person.name} />
	))}
	<ContributorWall.More href={contributorsUrl} count="+179" aria-label="All 214 contributors" />
</ContributorWall>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<ContributorWall aria-label="Contributors">
				{NAMES.map((name) => (
					<ContributorWall.Person key={name} href="#contributors" name={name} />
				))}
				<ContributorWall.More href="#contributors" count="+179" aria-label="All 214 contributors" />
			</ContributorWall>
		</div>
	),
};
