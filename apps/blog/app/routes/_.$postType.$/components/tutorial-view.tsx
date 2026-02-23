import { cn } from "@pkg/cn";
import { Badge, Button, Card, Form, Link, TagGroup } from "@pkg/ui";
import { Suspense } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Await, Link as RemixLink, href, useAsyncValue } from "react-router";

import { MarkdownView } from "~/components/markdown";
import { Support } from "~/components/support";
import { useUser } from "~/hooks/use-user";
import { useHints } from "~/utils/client-hints";
import { formatPublishDate } from "~/utils/format-publish-date";

import type { TutorialLoaderData } from "../route";

export type TutorialData = TutorialLoaderData;
type RecommendationsList = TutorialData["recommendations"];

export function TutorialView({ post }: { post: TutorialData }) {
	let { t } = useTranslation("translation", { keyPrefix: "tutorial" });
	let user = useUser();

	if (post.postType !== "tutorials") return null;

	return (
		<article className="mx-auto flex max-w-3xl flex-col gap-8 pb-14">
			<div className="mx-auto prose w-full max-w-prose space-y-8 prose-blue sm:prose-lg dark:prose-invert">
				<div className="not-prose flex flex-wrap items-center justify-between gap-2">
					<Tags
						tags={
							post.tutorial.tags
								? Array.isArray(post.tutorial.tags)
									? post.tutorial.tags
									: [post.tutorial.tags]
								: []
						}
					/>

					<div className="flex shrink-0 gap-2">
						{user?.role === "admin" && (
							<Form
								method="get"
								action={href("/cms/tutorials/:postId", {
									postId: post.tutorial.id,
								})}
							>
								<Button type="submit" color="primary" size="sm">
									{t("header.edit")}
								</Button>
							</Form>
						)}

						<Form
							method="get"
							reloadDocument
							action={href("/md/:postType/*", {
								postType: "tutorials",
								"*": post.tutorial.slug,
							})}
						>
							<Button type="submit" color="primary" size="sm">
								{t("header.markdown")}
							</Button>
						</Form>
					</div>
				</div>

				<div>
					<header className="gap-4 md:flex md:items-start md:justify-between">
						<div>
							{post.isPreview && post.publishedAt && (
								<Badge color="warning" className="mb-2">
									<Badge.Text>
										<PublishDateBadge publishedAt={post.publishedAt} />
									</Badge.Text>
								</Badge>
							)}
							<h1>
								<small className="block text-xl text-primary-500">{t("header.eyebrown")}</small>
								{post.tutorial.title}
							</h1>
						</div>
					</header>

					<MarkdownView content={post.tutorial?.content} />
				</div>
			</div>

			<Support />

			<Suspense fallback={null}>
				<Await resolve={post.recommendations} errorElement={null}>
					<footer>
						<Recommendations />
					</footer>
				</Await>
			</Suspense>
		</article>
	);
}

function Tags({ tags }: { tags: string[] }) {
	let { t } = useTranslation("translation", { keyPrefix: "tutorial" });

	if (tags.length === 0) return null;

	return (
		<TagGroup aria-label={t("tags")} className="flex-row">
			<TagGroup.List>
				{tags.map((tag) => {
					let searchParams = new URLSearchParams();
					searchParams.set("q", `tech:${tag}`);

					let to = `/?${searchParams.toString()}`;

					return (
						<TagGroup.Tag key={tag} color="primary" size="sm">
							<RemixLink to={to}>{tag}</RemixLink>
						</TagGroup.Tag>
					);
				})}
			</TagGroup.List>
		</TagGroup>
	);
}

function Recommendations() {
	let recommendations = useAsyncValue() as RecommendationsList;
	let { t } = useTranslation("translation", { keyPrefix: "tutorial.related" });

	if (!recommendations || recommendations.length === 0) return null;

	return (
		<section className="not-prose mt-4 space-y-4">
			<header className="border-b border-neutral-200 pb-5 dark:border-neutral-700">
				<h2 className="text-lg leading-6 font-medium text-neutral-900 dark:text-neutral-100">
					{t("title")}
				</h2>
			</header>

			<div
				className={cn("grid grid-cols-1 gap-4", {
					"md:grid-cols-1": recommendations.length === 1,
					"md:grid-cols-2": recommendations.length === 2,
					"md:grid-cols-3": recommendations.length >= 3,
				})}
			>
				{recommendations.map(({ title, slug, matchedTag }) => {
					let searchParams = new URLSearchParams();
					searchParams.set("q", `tech:${matchedTag}`);

					return (
						<Card key={slug}>
							<Card.Header>
								<Card.Title className="text-base font-medium">
									<Link
										href={href("/:postType/*", {
											postType: "tutorials",
											"*": slug,
										})}
									>
										{title}
									</Link>
								</Card.Title>
							</Card.Header>
							<Card.Content>
								<Trans
									t={t}
									parent="p"
									className="text-sm"
									i18nKey="reason"
									values={{ tag: matchedTag }}
									components={{
										anchor: (
											<Badge color="primary">
												<Badge.Text>{matchedTag}</Badge.Text>
											</Badge>
										),
									}}
								/>
							</Card.Content>
						</Card>
					);
				})}
			</div>
		</section>
	);
}

function PublishDateBadge({ publishedAt }: { publishedAt: Date }) {
	let { t, i18n } = useTranslation("translation", { keyPrefix: "tutorial.preview" });
	let hints = useHints();

	let { formatted, isRelative } = formatPublishDate(publishedAt, {
		locale: i18n.language,
		timeZone: hints?.timeZone,
	});

	if (isRelative) {
		return t("badgeRelative", { relativeTime: formatted });
	}

	return t("badge", { date: formatted });
}
