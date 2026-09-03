/**
 * View for the CMS dashboard. Renders a grid of stat cards summarizing counts of
 * articles, likes, tutorials, and glossary terms, each linking to its management
 * section, inside the CMSLayout shell. Exists as the landing page of the admin
 * area with at-a-glance content totals.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { gap, grid, gridTemplate, repeat } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Heading, Link } from "@sdxc/ui";

import { CMSLayout } from "~/resources/layouts/cms";
import routes from "~/routes/web";

/**
 * Groups dashboard view data contracts.
 */
export namespace CMSDashboardView {
	/**
	 * Aggregate counts displayed in the dashboard stat cards.
	 */
	export interface Stats {
		articles: number;
		likes: number;
		tutorials: number;
		glossary: number;
	}

	/**
	 * Model consumed by the dashboard view renderer.
	 */
	export interface Props {
		stats: Stats;
	}
}

namespace StatCard {
	export interface Props {
		label: string;
		value: number;
		href: string;
	}
}

/**
 * Builds one stat card so every dashboard metric shares a single markup and
 * styling shape.
 *
 * @param handle Runtime handle carrying the card's caption, total, and link target.
 * @returns A renderer producing the card's markup.
 */
function StatCard(handle: Handle<StatCard.Props>) {
	return () => {
		let { label, value, href } = handle.props;

		return (
			<article
				mix={[
					grid(),
					gap(1),
					p(3),
					rounded("lg"),
					border({ width: 1, color: "neutral" }),
					bg("neutral.tint"),
				]}
			>
				<p mix={[m(0), text("sm"), fg("neutral")]}>{label}</p>
				<p mix={[m(0), text("3xl"), weight("bold"), fg("neutral.emphasis")]}>{value}</p>
				<Link href={href} color="brand" mix={[text("sm")]}>
					View all
				</Link>
			</article>
		);
	};
}

/**
 * Builds the CMS dashboard renderer with stat summary cards. The section
 * heading stays visually hidden, carrying the outline assistive technology
 * reads.
 */
export function CMSDashboardView() {
	return ({ model }: { model: CMSDashboardView.Props }) => {
		let { stats } = model;

		return (
			<CMSLayout title="Dashboard" activePath={routes.cms.dashboard.href()}>
				<main mix={[grid(), gap(4)]}>
					<Heading level={2} mix={[visuallyHidden()]}>
						Post Stats
					</Heading>
					<div
						mix={[
							grid(),
							gap(3),
							gridTemplate({ columns: repeat("auto-fit", "minmax(10rem, 1fr)") }),
						]}
					>
						<StatCard
							label="Total Articles"
							value={stats.articles}
							href={routes.cms.articles.index.href()}
						/>
						<StatCard
							label="Total Likes"
							value={stats.likes}
							href={routes.cms.bookmarks.index.href()}
						/>
						<StatCard
							label="Total Tutorials"
							value={stats.tutorials}
							href={routes.cms.tutorials.index.href()}
						/>
						<StatCard
							label="Total Glossary Terms"
							value={stats.glossary}
							href={routes.cms.glossary.index.href()}
						/>
					</div>
				</main>
			</CMSLayout>
		);
	};
}
