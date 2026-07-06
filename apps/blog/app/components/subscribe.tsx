/**
 * Subscribe component for the blog app. Renders a localized call-to-action
 * paragraph that invites readers to subscribe via RSS, using a Trans component so
 * the "rss" placeholder becomes a styled link to the /rss feed. It is reused
 * across the home, articles, tutorials, and bookmarks pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "i18next";

import { Link } from "@pkg/ui";
import { Trans } from "react-i18next";

type SubscribeProps = {
	t: TFunction<"translation", "tutorials" | "bookmarks" | "home" | "articles">;
};

export function Subscribe({ t }: SubscribeProps) {
	return (
		<Trans
			t={t}
			parent="p"
			className="text-sm text-neutral-600 dark:text-neutral-400"
			i18nKey="subscribe.cta"
			components={{
				rss: <Link href="/rss" className="text-primary-600 underline" />,
			}}
		/>
	);
}
