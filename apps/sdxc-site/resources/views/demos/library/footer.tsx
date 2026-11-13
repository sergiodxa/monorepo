/**
 * Plumb's footer: the logo and its one-line pitch, three columns of links into the docs
 * and the project, and a legal row naming the licence. Every link lands on a section of
 * this page, so the demo has no destination that answers 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BookOpenIcon, HeartIcon, RssIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { SiteFooter } from "@sdxc/ui/landing";

import { RELEASE } from "~/resources/views/demos/library/data";
import { PlumbLogo } from "~/resources/views/demos/library/logo";

/** Each column's heading and its links, every one an anchor on this page. */
const COLUMNS: SiteFooter.Column[] = [
	{
		title: "Docs",
		links: [
			{ label: "Quickstart", href: "#docs" },
			{ label: "Schema reference", href: "#docs" },
			{ label: "Issues and messages", href: "#docs" },
			{ label: "Workers and CSP", href: "#docs" },
		],
	},
	{
		title: "Project",
		links: [
			{ label: "Changelog", href: "#changelog" },
			{ label: "Benchmarks", href: "#benchmarks" },
			{ label: "Contributors", href: "#community" },
			{ label: "Compiled output", href: "#compile" },
		],
	},
	{
		title: "Community",
		links: [
			{ label: "Sponsor", href: "#sponsors" },
			{ label: "Funding ledger", href: "#sponsors" },
			{ label: "Security policy", href: "#faq" },
			{ label: "FAQ", href: "#faq" },
		],
	},
];

/**
 * Renders the footer.
 *
 * @returns The render function producing the footer.
 */
export function LibraryFooter() {
	return () => (
		<SiteFooter
			brand={
				<a href="#top" aria-label="plumb home" mix={[fg("neutral.emphasis")]}>
					<PlumbLogo />
				</a>
			}
			tagline="TypeScript schemas that compile to the checks you would write by hand."
			columns={COLUMNS}
			social={
				<>
					<a href="#changelog" aria-label="Release feed">
						<RssIcon aria-hidden="true" />
					</a>
					<a href="#docs" aria-label="Documentation">
						<BookOpenIcon aria-hidden="true" />
					</a>
					<a href="#sponsors" aria-label="Sponsor plumb">
						<HeartIcon aria-hidden="true" />
					</a>
				</>
			}
			legal={
				<>
					<span>{`MIT License · © 2026 the plumb contributors`}</span>
					<span>{`v${RELEASE.version}`}</span>
				</>
			}
		/>
	);
}
