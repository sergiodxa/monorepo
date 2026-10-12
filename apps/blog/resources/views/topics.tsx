/**
 * View for the `/topics` index: every topic as a card with its title linking to its page and
 * its description as one line under it. Each topic's page offers its feeds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { gap, grid } from "@sdxc/u/layout";
import { m, maxIs, mbs, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Heading, Link } from "@sdxc/ui";

import type { TopicViewModel } from "~/app/http/view-models/topic";

import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/** Type contracts for the topic index. */
export namespace TopicsView {
	/** Everything the topic index renders. */
	export interface Model {
		topics: Array<TopicViewModel.IndexItem>;
	}
}

/**
 * Creates the topic index renderer.
 *
 * @returns A view function that renders from the topic index model.
 */
export function TopicsView() {
	return ({ model, assets }: { model: TopicsView.Model; assets: DocumentAssets }) => (
		<BlogLayout
			assets={assets}
			title="Topics"
			description="Saved searches over everything I publish, each with its own feeds."
			activePath={routes.topics.href()}
		>
			<main mix={[grid(), gap(4)]}>
				<Heading level={1} mix={[text("3xl")]}>
					Topics
				</Heading>
				<p mix={[m(0), maxIs("52ch"), text("lg"), fg("neutral")]}>
					Saved searches over everything I publish, each with its own RSS, Atom, and JSON Feed.
				</p>
				{model.topics.length === 0 ? (
					<p mix={[m(0), text("base"), fg("neutral")]}>No topics yet.</p>
				) : (
					<ul mix={[m(0), p(0), listStyle("none"), grid(), gap(3), mbs(2)]}>
						{model.topics.map((topic) => (
							<li
								key={topic.href}
								mix={[
									grid(),
									gap(1),
									p(4),
									rounded("lg"),
									bg("neutral.tint"),
									border({ width: 1, color: "neutral" }),
								]}
							>
								<p mix={[m(0), text("lg"), fg("neutral.emphasis")]}>
									<Link href={topic.href}>{topic.title}</Link>
								</p>
								{topic.summary ? (
									<p mix={[m(0), text("base"), fg("neutral")]}>{topic.summary}</p>
								) : null}
							</li>
						))}
					</ul>
				)}
			</main>
		</BlogLayout>
	);
}
