import { Heading } from "@pkg/ui";
import { useTranslation } from "react-i18next";

interface LastDaySearchProps {
	result: Record<"articles" | "tutorials", string[]>;
}

export function LastDaySearch({ result }: LastDaySearchProps) {
	let { t } = useTranslation("translation", {
		keyPrefix: "cms._index.lastDaySearch",
	});

	return (
		<div className="flex flex-col gap-5">
			<Heading className="text-zinc-900 dark:text-zinc-50 text-base leading-6 font-semibold">
				{t("title")}
			</Heading>

			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<div className="dark:bg-zinc-600 flex flex-col gap-1 rounded-lg bg-white px-4 py-5 shadow sm:p-6">
					<Heading className="text-zinc-900 dark:text-zinc-50 text-base leading-6 font-semibold">
						Articles
					</Heading>

					<ul className="list-inside list-disc">
						{result.articles.map((searchTerm) => (
							<li key={searchTerm} className="grow">
								{searchTerm}
							</li>
						))}
					</ul>
				</div>

				<div className="dark:bg-zinc-600 flex flex-col gap-1 rounded-lg bg-white px-4 py-5 shadow sm:p-6">
					<Heading className="text-zinc-900 dark:text-zinc-50 text-base leading-6 font-semibold">
						Tutorials
					</Heading>

					<ul className="list-inside list-disc">
						{result.tutorials.map((searchTerm) => (
							<li key={searchTerm} className="grow">
								{searchTerm}
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
