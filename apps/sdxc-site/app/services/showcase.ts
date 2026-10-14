/**
 * The applications the showcase lists, each with the number of packages it installs
 * read from its own manifest. The order is that number, descending, because the page's
 * argument is depth of use: the app that reaches furthest into the collection is the
 * one worth reading first. Two on the same count are separated by whether a reader can
 * go and use one, which is the stronger of the two things this page can show.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { countApplicationPackages } from "~/app/services/packages";
import { APPLICATIONS } from "~/resources/content/apps";

/** Where an application's source is read. */
const SOURCE_BASE = "https://github.com/sergiodxa/monorepo/tree/main/apps/";

/** One application as the showcase lists it. */
export interface ShowcaseEntry {
	directory: string;
	title: string;
	summary: string;
	study: string;
	/** How many packages from this collection it installs. */
	packageCount: number;
	/** Where it is running, or `null` when its source is all there is to read. */
	href: string | null;
	sourceHref: string;
}

/** The showcase, deepest user of the collection first. */
export function listShowcase(): ShowcaseEntry[] {
	return APPLICATIONS.map((application) => ({
		directory: application.directory,
		title: application.title,
		summary: application.summary,
		study: application.study,
		packageCount: countApplicationPackages(application.directory),
		href: application.href,
		sourceHref: `${SOURCE_BASE}${application.directory}`,
	})).sort(
		(a, b) =>
			b.packageCount - a.packageCount ||
			Number(b.href !== null) - Number(a.href !== null) ||
			a.title.localeCompare(b.title),
	);
}
