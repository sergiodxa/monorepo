/**
 * Page header component for the blog app. Renders a section's localized title and
 * description heading block, using a Trans component so the description can carry
 * inline markup. It provides a consistent header used across the articles,
 * tutorials, glossary, and bookmarks listing pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
