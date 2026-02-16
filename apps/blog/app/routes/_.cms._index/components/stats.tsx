import { Heading, Link } from "@pkg/ui";
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
			<Heading className="text-zinc-900 dark:text-zinc-50 text-base leading-6 font-semibold">
				{t("title")}
			</Heading>

			<dl className="grid grid-cols-1 gap-5 sm:grid-cols-4">
				{stats.map((item) => (
					<div
						key={item.name}
						className="dark:bg-zinc-600 relative overflow-hidden rounded-lg bg-white px-4 pt-5 pb-12 shadow sm:px-6 sm:pt-6"
					>
						<dt>
							<p className="text-zinc-500 dark:text-zinc-300 truncate text-sm font-medium">
								{item.name}
							</p>
						</dt>
						<dd className="flex items-baseline pb-6 sm:pb-7">
							<p className="text-zinc-900 dark:text-zinc-50 text-2xl font-semibold">{item.stat}</p>
							<div className="bg-zinc-50 dark:bg-zinc-700 absolute inset-x-0 bottom-0 px-4 py-4 sm:px-6">
								<Link href={item.path} prefetch="intent">
									{t("viewAll")}
								</Link>
							</div>
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}
