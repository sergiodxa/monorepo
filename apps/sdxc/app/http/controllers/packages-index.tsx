/**
 * `GET /docs/packages` — every published package, under the same taxonomy the landing
 * page groups them by. Sixty names are unscannable as an alphabet, so the page is
 * grouped for a reader browsing and filterable for one who already knows what they
 * are after.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { SearchIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { listStyle } from "@sdxc/u/general";
import { gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, m, p } from "@sdxc/u/size";
import { font, text, tracking, weight } from "@sdxc/u/typography";
import { Button, Keyboard } from "@sdxc/ui";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { sponsorsTag } from "~/app/http/middleware/sponsors";
import { buildNavTree } from "~/app/services/navigation";
import { listPackageGroups } from "~/app/services/packages";
import { SEARCH_DIALOG_ID } from "~/resources/components/search-palette";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const DESCRIPTION =
	"Every published package, grouped by the problem it solves and filterable by name or description.";

export default createAction(routes.docs.packages.index, async (ctx) => {
	let tree = await buildNavTree();
	let groups = listPackageGroups();

	let response = await ctx.render(
		<DocumentLayout
			title="Packages — sdxc"
			description={DESCRIPTION}
			canonical={ctx.url.href}
			sponsors={ctx.sponsors}
		>
			<DocsLayout
				tree={tree}
				activePath={routes.docs.packages.index.href()}
				breadcrumbs={[
					{ label: "Documentation", href: routes.docs.index.href() },
					{ label: "Packages" },
				]}
			>
				<header mix={[vstack({ gap: 3 })]}>
					<h1 mix={[m(0), text("4xl"), weight("bold"), tracking("tight")]}>Packages</h1>
					<p mix={[m(0), text("lg"), fg("neutral")]}>{DESCRIPTION}</p>
				</header>

				{/*
				 * The header's palette already searches every package alongside every guide,
				 * and it holds the ⌘K binding, so this page opens that one rather than standing
				 * a second palette up over a subset of the same index.
				 */}
				<div mix={[m("2rem", 0, 0, 0)]}>
					<Button
						type="button"
						color="neutral"
						variant="outline"
						commandfor={SEARCH_DIALOG_ID}
						command="show-modal"
					>
						<SearchIcon size={16} aria-hidden="true" />
						Search the packages
						<Keyboard mix={[fg("inherit")]}>⌘K</Keyboard>
					</Button>
				</div>

				<div mix={[vstack({ gap: 10 }), m("3rem", 0, 0, 0)]}>
					{groups.map((group) => (
						<section key={group.title} mix={[vstack({ gap: 4 })]}>
							<h2 mix={[m(0), text("sm"), weight("semibold"), tracking("wide"), fg("neutral")]}>
								{group.title}
							</h2>

							<ul
								mix={[
									grid(),
									gap(3),
									m(0),
									p(0),
									is("100%"),
									listStyle("none"),
									gridTemplate({ columns: "1fr" }),
									media(
										"(min-width: 40rem)",
										gridTemplate({ columns: repeat("auto-fill", "minmax(18rem, 1fr)") }),
									),
								]}
							>
								{group.packages.map((entry) => (
									<li key={entry.name} mix={[vstack({ gap: 1 })]}>
										<a
											href={routes.docs.packages.show.href({ name: entry.directory })}
											mix={[font("mono"), text("sm"), weight("medium"), fg("brand")]}
										>
											{entry.name}
										</a>
										<p mix={[m(0), text("sm"), fg("neutral")]}>{entry.description}</p>
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response, sponsorsTag(ctx.sponsors));
});
