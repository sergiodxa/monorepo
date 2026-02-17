import type { TFunction } from "i18next";

import { Trans } from "react-i18next";

type Props = {
	t: TFunction<"translation", "articles" | "tutorials" | "glossary" | "bookmarks">;
};

export function PageHeader({ t }: Props) {
	return (
		<header className="flex flex-col gap-2">
			<h1 className="text-3xl font-bold tracking-tight">{t("header.title")}</h1>

			<Trans
				parent="p"
				className="text-xl text-neutral-800 dark:text-neutral-200"
				t={t}
				i18nKey="header.description"
			/>
		</header>
	);
}
