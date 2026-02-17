import type { TFunction } from "i18next";
import type { ReactNode } from "react";

import { cn } from "@pkg/cn";
import { Link } from "@pkg/ui";
import { BookIcon, BookmarkIcon, PencilIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import type { FeedItem } from "./types";

type Props = {
	t: TFunction<"translation", "home">;
	items: FeedItem[];
};

export function FeedList({ t, items }: Props) {
	return (
		<ol aria-label={t("feed.title") as string} className="h-feed">
			{items.map((item, index) => {
				if (item.type === "article") {
					return (
						<Item
							key={item.id}
							index={index}
							size={items.length - 1}
							body={
								<Trans
									parent="p"
									className="text-sm text-neutral-800 dark:text-neutral-200"
									i18nKey="feed.article"
									t={t}
									values={{ title: item.payload.title }}
									components={{
										articleLink: <Link href={item.payload.link} prefetch="intent" />,
									}}
								/>
							}
							icon={<PencilIcon className="size-5" aria-hidden />}
							iconColor="warning"
							createdAt={new Date(item.payload.createdAt)}
						/>
					);
				}

				if (item.type === "tutorial") {
					return (
						<Item
							key={item.id}
							index={index}
							size={items.length - 1}
							body={
								<Trans
									parent="p"
									className="text-sm text-neutral-800 dark:text-neutral-200"
									i18nKey="feed.tutorial"
									t={t}
									values={{ title: item.payload.title }}
									components={{
										tutorialLink: <Link href={item.payload.link} prefetch="intent" />,
									}}
								/>
							}
							icon={<PencilIcon className="size-5" aria-hidden />}
							iconColor="warning"
							createdAt={new Date(item.payload.createdAt)}
						/>
					);
				}

				if (item.type === "like") {
					return (
						<Item
							key={item.id}
							index={index}
							size={items.length - 1}
							body={
								<Trans
									parent="p"
									className="text-sm text-neutral-800 dark:text-neutral-200"
									i18nKey="feed.bookmark"
									t={t}
									values={{ title: item.payload.title }}
									components={{
										bookmarkLink: <Link href={item.payload.link} rel="nofollow noreferer" />,
									}}
								/>
							}
							icon={<BookmarkIcon className="size-5" aria-hidden />}
							iconColor="primary"
							createdAt={new Date(item.payload.createdAt)}
						/>
					);
				}

				if (item.type === "glossary") {
					return (
						<Item
							key={item.id}
							index={index}
							size={items.length - 1}
							body={
								<Trans
									parent="p"
									className="text-sm text-neutral-800 dark:text-neutral-200"
									i18nKey="feed.glossary"
									t={t}
									values={{ title: item.payload.title }}
									components={{
										glossaryLink: <Link href={item.payload.link} prefetch="intent" />,
									}}
								/>
							}
							icon={<BookIcon className="size-5" aria-hidden />}
							iconColor="primary"
							createdAt={new Date(item.payload.createdAt)}
						/>
					);
				}

				return null;
			})}
		</ol>
	);
}

type FeedItemProps = {
	body: ReactNode;
	index: number;
	size: number;
	icon: ReactNode;
	iconColor: "primary" | "warning";
	createdAt: Date;
};

function Item({ body, index, size, iconColor, icon, createdAt }: FeedItemProps) {
	let { i18n } = useTranslation("translation");

	return (
		<li className="h-entry">
			<div className="relative pb-8">
				{index !== size ? (
					<span
						className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-white dark:bg-neutral-900"
						aria-hidden
					/>
				) : null}
				<div className="relative flex space-x-3">
					<div>
						<span
							className={cn(
								"flex h-8 w-8 items-center justify-center rounded-full ring-8 ring-white dark:ring-neutral-900",
								{
									"bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400":
										iconColor === "primary",
									"bg-warning-100 text-warning-600 dark:bg-warning-900 dark:text-warning-400":
										iconColor === "warning",
								},
							)}
						>
							{icon}
						</span>
					</div>
					<div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
						{body}

						<div className="text-right text-sm whitespace-nowrap text-neutral-500 tabular-nums">
							<time dateTime={createdAt.toISOString()}>
								{createdAt.toLocaleDateString(i18n.language, {
									month: "short",
									day: "2-digit",
									year: "2-digit",
								})}
							</time>
						</div>
					</div>
				</div>
			</div>
		</li>
	);
}
