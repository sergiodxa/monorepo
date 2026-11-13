/**
 * The docs entry: six starting points into Plumb's documentation, each a card with the
 * page's path, what it answers and how long it takes, so a reader leaves the landing on
 * the page that fits where they are.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArrowRightIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Feature, LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { renderNearView } from "~/resources/views/demos/near-view";

/** The docs' starting points: path, title, what the page answers and its length. */
const DOCS = [
	{
		path: "/docs/quickstart",
		title: "Quickstart",
		body: "Install, write a schema, parse a request body and read the issues.",
		time: "5 min",
	},
	{
		path: "/docs/schemas",
		title: "Schema reference",
		body: "Every type and modifier, with the check each one compiles to.",
		time: "Reference",
	},
	{
		path: "/docs/errors",
		title: "Issues and messages",
		body: "Paths, codes and translating messages for a form beside each field.",
		time: "8 min",
	},
	{
		path: "/docs/precompile",
		title: "Workers and strict CSP",
		body: "Run plumb build at build time and ship schemas with no eval.",
		time: "6 min",
	},
	{
		path: "/docs/recipes",
		title: "Recipes",
		body: "Env vars, query strings, form data, dates and discriminated unions.",
		time: "12 recipes",
	},
	{
		path: "/docs/migrate-v4",
		title: "Migrating to v4",
		body: "The two renamed methods and the codemod that rewrites them.",
		time: "4 min",
	},
] as const;

/**
 * Renders the band as three cards across, the path set as the card's mono eyebrow.
 *
 * @returns The render function producing the band.
 */
export function DocsChapter() {
	return () => (
		<LandingSection id="docs" ruled mix={[renderNearView(730, 1781)]}>
			<LandingHeader
				eyebrow="docs/"
				layout="split"
				description={
					<>
						Every page opens with the code, then explains it. The quickstart gets a request body
						validated <strong>in five minutes</strong>.
					</>
				}
			>
				Start where you are
			</LandingHeader>
			<Feature.Grid columns={3}>
				{DOCS.map((doc) => (
					<Feature key={doc.path} href="#docs">
						<Feature.Title>
							<span
								mix={[
									raw({
										display: "block",
										marginBlockEnd: "0.5rem",
										fontSize: "0.75rem",
										fontWeight: "500",
										color: "var(--ui-brand-fg)",
									}),
								]}
							>
								{doc.path}
							</span>
							{doc.title}
						</Feature.Title>
						<Feature.Description>{doc.body}</Feature.Description>
						<Feature.Action>
							<Feature.Link href="#docs">
								{`Read · ${doc.time}`}
								<ArrowRightIcon aria-hidden="true" data-slot="icon" />
							</Feature.Link>
						</Feature.Action>
					</Feature>
				))}
			</Feature.Grid>
		</LandingSection>
	);
}
