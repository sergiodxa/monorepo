/**
 * Dashboard stats component. It takes per-type counts (articles, likes, tutorials,
 * glossary) and renders a grid of cards for the non-zero totals, each with a
 * localized label, the count, and a "view all" link to that section. Exists to give
 * admins an at-a-glance summary of content volume.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Card, Heading, Link } from "@pkg/ui";
import { useTranslation } from "react-i18next";

interface Stats {
	articles?: number;
	glossary?: number;
	likes?: number;
	tutorials?: number;
}

export function Stats(props: { stats: Stats }) {
	let { t } = useTranslation("translation", { keyPrefix: "cms._index.stats" });

	let stats: { name: string; path: string; stat: number }[] = [];

	if (props.stats.articles) {
		stats.push({
			name: t("total.articles"),
			path: "articles",
			stat: props.stats.articles,
		});
	}

	if (props.stats.likes) {
		stats.push({
			name: t("total.likes"),
			path: "likes",
			stat: props.stats.likes,
		});
	}

	if (props.stats.tutorials) {
		stats.push({
			name: t("total.tutorials"),
			path: "tutorials",
			stat: props.stats.tutorials,
		});
	}

	if (props.stats.glossary) {
		stats.push({
			name: t("total.glossary"),
			path: "glossary",
			stat: props.stats.glossary,
		});
	}

	return (
		<div className="flex flex-col gap-5">
			<Heading className="text-base leading-6 font-semibold">{t("title")}</Heading>

			<dl className="grid grid-cols-1 gap-5 sm:grid-cols-4">
				{stats.map((item) => (
					<Card key={item.name} className="p-4">
						<dt className="text-sm text-neutral-500 dark:text-neutral-400">{item.name}</dt>
						<dd className="mt-1 text-3xl font-semibold tracking-tight">{item.stat}</dd>
						<Link href={item.path} prefetch="intent" className="mt-2 inline-block text-sm">
							{t("viewAll")}
						</Link>
					</Card>
				))}
			</dl>
		</div>
	);
}
