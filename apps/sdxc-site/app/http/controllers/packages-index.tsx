/**
 * `GET /api` — every published package, under the same taxonomy the landing page
 * groups them by. Sixty names are unscannable as an alphabet, so the page is
 * grouped for a reader browsing and filterable for one who already knows what they
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { SearchIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { font, text, textTransform, tracking } from "@sdxc/u/typography";
import { Button, Keyboard } from "@sdxc/ui";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { buildPackagesNav } from "~/app/services/navigation";
import { listPackageGroups } from "~/app/services/packages";
import PageTitle from "~/resources/components/page-title";
import RuledGrid, { RuledCell } from "~/resources/components/ruled-grid";
import { SEARCH_DIALOG_ID } from "~/resources/components/search-trigger";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const DESCRIPTION =
	"Every published package, grouped by the problem it solves and filterable by name or description.";

export default createAction(routes.api.index, async (ctx) => {
	let tree = await buildPackagesNav();
	let groups = listPackageGroups();

	let response = ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="API — sdxc"
			description={DESCRIPTION}
			canonical={ctx.url.href}
		>
			<DocsLayout tree={tree} activePath={routes.api.index.href()} breadcrumbs={[]}>
				<PageTitle eyebrow="API" title="Every package">
					{DESCRIPTION}
				</PageTitle>

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

				<div mix={[vstack({ gap: 10, align: "stretch" }), m("3rem", 0, 0, 0)]}>
					{groups.map((group) => (
						<section key={group.title} mix={[vstack({ gap: 4, align: "stretch" })]}>
							<h2
								mix={[
									m(0),
									font("mono"),
									text("xs"),
									textTransform("uppercase"),
									tracking("widest"),
									fg("neutral"),
								]}
							>
								{group.title}
							</h2>

							<RuledGrid min="16rem">
								{group.packages.map((entry) => (
									<RuledCell
										key={entry.name}
										href={routes.api.show.href({ name: entry.directory })}
										name={entry.name}
										description={entry.description}
									/>
								))}
							</RuledGrid>
						</section>
					))}
				</div>
			</DocsLayout>
		</DocumentLayout>,
	);

	return await withBundleCache(ctx.request, response);
});
