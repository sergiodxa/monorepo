import { Card, Heading } from "@pkg/ui";
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
			<Heading className="text-base leading-6 font-semibold">{t("title")}</Heading>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Card>
					<Card.Header>
						<Card.Title>Articles</Card.Title>
					</Card.Header>
					<Card.Content>
						<ul className="list-inside list-disc">
							{result.articles.map((searchTerm) => (
								<li key={searchTerm}>{searchTerm}</li>
							))}
						</ul>
					</Card.Content>
				</Card>

				<Card>
					<Card.Header>
						<Card.Title>Tutorials</Card.Title>
					</Card.Header>
					<Card.Content>
						<ul className="list-inside list-disc">
							{result.tutorials.map((searchTerm) => (
								<li key={searchTerm}>{searchTerm}</li>
							))}
						</ul>
					</Card.Content>
				</Card>
			</div>
		</div>
	);
}
