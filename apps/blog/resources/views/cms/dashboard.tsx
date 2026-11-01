/**
 * View for the CMS dashboard: how much of each kind is on the site, the queues that need the
 * author (Webmentions to moderate, bookmarks to review), the bookmark quick add, and the edge
 * cache control, whose outcome comes back as a toast.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { ChevronRightIcon } from "@sdxc/icons";
import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { divide } from "@sdxc/u/overflow";
import { m, p } from "@sdxc/u/size";
import { tabularNums, text, weight } from "@sdxc/u/typography";
import { Button, Confirm, LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { StatCard } from "@sdxc/ui/app/stat-card";
import { HeadingScope } from "@sdxc/ui/heading-scope";

import type { CMSToast } from "~/app/http/toast";

import { readCMSShell } from "~/app/http/middleware/cms-shell";
import { CMSLayout } from "~/resources/layouts/cms";
import { QuickBookmarkForm } from "~/resources/views/cms/bookmarks";
import routes from "~/routes/web";

/**
 * Groups dashboard view data contracts.
 */
export namespace CMSDashboardView {
	/**
	 * Aggregate counts displayed in the dashboard stat cards.
	 */
	export interface Stats {
		articles: number;
		likes: number;
		tutorials: number;
		glossary: number;
	}

	/** How the last purge went, when the operator has just run one. */
	export type PurgeResult = "ok" | "failed";

	/**
	 * Model consumed by the dashboard view renderer.
	 */
	export interface Props {
		stats: Stats;
		purgeResult?: PurgeResult;
	}
}

/** The confirm dialog the cache button opens. */
const PURGE_DIALOG_ID = "purge-cache-dialog";

/** What the toast says about each purge outcome; a failure never reads as a success. */
const PURGE_TOASTS: Record<CMSDashboardView.PurgeResult, CMSToast> = {
	ok: { color: "success", message: "Cache cleared. Pages rebuild on their next request." },
	failed: {
		color: "danger",
		message: "The cache did not clear. Check the logs before relying on it.",
	},
};

/** Props accepted by {@link Panel}. */
interface PanelProps {
	title: string;
	description?: string;
	children: RemixNode;
}

/** A titled card on the dashboard. */
function Panel(handle: Handle<PanelProps>) {
	return () => {
		let { title, description, children } = handle.props;
		return (
			<section
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					p(4),
					rounded("lg"),
					border({ color: "neutral", width: 1 }),
					raw({ backgroundColor: "var(--ui-bg)" }),
				]}
			>
				<header mix={[vstack({ gap: 1, align: "stretch" })]}>
					<h2 mix={[m(0), text("base"), weight("semibold"), fg("neutral.emphasis")]}>{title}</h2>
					{description ? <p mix={[m(0), text("sm"), fg("neutral.muted")]}>{description}</p> : null}
				</header>
				{children}
			</section>
		);
	};
}

/** Props accepted by {@link QueueRow}. */
interface QueueRowProps {
	href: string;
	label: string;
	count: number;
}

/** One queue waiting on the author: what it is, how many, and the list that resolves it. */
function QueueRow(handle: Handle<QueueRowProps>) {
	return () => {
		let { href, label, count } = handle.props;
		return (
			<li>
				<a
					href={href}
					mix={[
						hstack({ gap: 3, align: "center" }),
						raw({
							padding: "0.625rem 0",
							color: "inherit",
							textDecoration: "none",
							"&:hover": { color: "var(--ui-brand-fg)" },
						}),
					]}
				>
					<span mix={[raw({ flex: "1 1 auto" }), text("sm")]}>{label}</span>
					<span mix={[tabularNums(), weight("semibold")]}>{count}</span>
					<ChevronRightIcon size={16} aria-hidden="true" />
				</a>
			</li>
		);
	};
}

/**
 * The dashboard: one look says how much is published and whether anything waits on the
 * author; the quick add and the cache control sit below as the two tools used from here.
 */
export function CMSDashboardView() {
	return ({ model, assets }: { model: CMSDashboardView.Props; assets: DocumentAssets }) => {
		let { stats, purgeResult } = model;
		let shell = readCMSShell();
		let queues = [
			{
				href: `${routes.cms.webmentions.index.href()}?status=pending`,
				label: "Webmentions to moderate",
				count: shell?.pendingWebmentions ?? 0,
			},
			{
				href: `${routes.cms.bookmarks.index.href()}?status=review`,
				label: "Bookmarks to review",
				count: shell?.openBookmarkFlags ?? 0,
			},
		].filter((queue) => queue.count > 0);

		return (
			<CMSLayout
				assets={assets}
				title="Dashboard"
				activePath={routes.cms.dashboard.href()}
				toast={purgeResult ? PURGE_TOASTS[purgeResult] : undefined}
			>
				<div mix={[vstack({ gap: 6, align: "stretch" })]}>
					<PageHeader
						title="Dashboard"
						description="What's on the site and what's waiting on you."
						primaryAction={
							<LinkButton href={routes.cms.articles.new.href()} color="brand" size="sm">
								New article
							</LinkButton>
						}
					/>
					<StatCard.Group variant="cards" aria-label="Posts on the site">
						<StatCard href={routes.cms.articles.index.href()}>
							<StatCard.Label>Articles</StatCard.Label>
							<StatCard.Value>{stats.articles}</StatCard.Value>
						</StatCard>
						<StatCard href={routes.cms.tutorials.index.href()}>
							<StatCard.Label>Tutorials</StatCard.Label>
							<StatCard.Value>{stats.tutorials}</StatCard.Value>
						</StatCard>
						<StatCard href={routes.cms.bookmarks.index.href()}>
							<StatCard.Label>Bookmarks</StatCard.Label>
							<StatCard.Value>{stats.likes}</StatCard.Value>
						</StatCard>
						<StatCard href={routes.cms.glossary.index.href()}>
							<StatCard.Label>Glossary terms</StatCard.Label>
							<StatCard.Value>{stats.glossary}</StatCard.Value>
						</StatCard>
					</StatCard.Group>
					<HeadingScope level={2}>
						<div
							mix={[
								raw({
									display: "grid",
									gap: "1.5rem",
									gridTemplateColumns: "minmax(0, 1fr)",
									alignItems: "start",
									"@container ui-app-content (min-width: 56rem)": {
										gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
									},
								}),
							]}
						>
							<div mix={[vstack({ gap: 6, align: "stretch" })]}>
								<Panel title="Needs attention">
									{queues.length === 0 ? (
										<Empty kind="cleared" size="compact">
											<Empty.Title>All caught up</Empty.Title>
											<Empty.Description>
												No Webmentions to moderate and no bookmarks to review.
											</Empty.Description>
										</Empty>
									) : (
										<ul mix={[m(0), p(0), raw({ listStyle: "none" }), divide("block", "neutral")]}>
											{queues.map((queue) => (
												<QueueRow href={queue.href} label={queue.label} count={queue.count} />
											))}
										</ul>
									)}
								</Panel>
								<Panel
									title="Bookmark a page"
									description="Paste a URL; the title and description are read from the page."
								>
									<QuickBookmarkForm />
								</Panel>
							</div>
							<Panel
								title="Edge cache"
								description="Every write clears the pages it changed, and a deploy starts on an empty cache. Clear it by hand to rebuild every page without shipping a new version."
							>
								<div>
									<Button
										type="button"
										commandfor={PURGE_DIALOG_ID}
										command="show-modal"
										color="danger"
										variant="outline"
										size="sm"
									>
										Clear the cache
									</Button>
								</div>
								<Confirm
									id={PURGE_DIALOG_ID}
									title="Clear every cached page?"
									description="Each page rebuilds on its next request, so the site works harder until the cache refills."
									confirmLabel="Confirm clear"
									cancelLabel="Cancel"
									color="danger"
									form={{ action: routes.cms.purgeCache.href(), method: "post" }}
								/>
							</Panel>
						</div>
					</HeadingScope>
				</div>
			</CMSLayout>
		);
	};
}
