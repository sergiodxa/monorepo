/**
 * Small scenes for the feature cards and the split bands: each one moment of the reader at
 * work — a busy feed fetched every 15 minutes, a filter that has decided 214 posts, a search
 * narrowed with OR and a minus, one notification for three feeds, an OPML file arriving.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import {
	BellIcon,
	CheckIcon,
	FileArchiveIcon,
	FolderIcon,
	PinIcon,
	SearchIcon,
	TagIcon,
	TriangleAlertIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { landingSurface } from "@sdxc/ui/styles";

import { POLL_BANDS, POLL_DORMANT_MS } from "~/database/feed-schema";
import { HAIRLINE } from "~/resources/components/marketing/reader-window";
import { SAMPLE_FEEDS, SAMPLE_POSTS } from "~/resources/components/marketing/sample-data";

/**
 * The media slot's inner frame, one height for every scene so the titles under a row of
 * cards line up. The slot fades its lower half into the card, so each scene keeps its story
 * at the top and lets its last rows fall into the fade.
 */
export function sceneFrame() {
	return raw({
		display: "grid",
		alignContent: "start",
		blockSize: "18rem",
		overflow: "hidden",
		padding: "1.5rem 1.5rem 0",
		minInlineSize: "0",
	});
}

/** A raised panel in the scene, the surface the app groups content on. */
export function scenePanel() {
	return [
		landingSurface(),
		raw({
			display: "grid",
			gap: "0.625rem",
			padding: "1rem",
			fontSize: "0.8125rem",
			lineHeight: "1.25rem",
			minInlineSize: "0",
			textAlign: "start",
		}),
	];
}

/** One ruled row of a scene: content at the start, a figure or mark at the end. */
function sceneRow() {
	return raw({
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "0.75rem",
		minInlineSize: "0",
		paddingBlockStart: "0.5rem",
		borderBlockStart: HAIRLINE,
	});
}

/** Text that truncates rather than wraps, for names a narrow card cannot hold whole. */
function clipped() {
	return raw({
		minInlineSize: "0",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	});
}

/** Muted small print, for times, counts and the app's own explanations. */
function quiet() {
	return raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" });
}

/** Mono, for the code-like things a reader types: queries, tool names, file names. */
function mono() {
	return raw({ fontFamily: "var(--ui-font-mono)", fontSize: "0.75rem" });
}

/** A figure with tabular digits, so a column of them lines up. */
function figure() {
	return raw({
		fontVariantNumeric: "tabular-nums",
		whiteSpace: "nowrap",
		color: "var(--ui-neutral-fg-emphasis)",
	});
}

/** The scene's frame and panel, hidden from assistive technology like every scene. */
function Scene(handle: Handle<{ children: RemixNode; framed?: boolean }>) {
	return () => (
		<div
			aria-hidden="true"
			mix={[handle.props.framed === false ? raw({ display: "grid" }) : sceneFrame()]}
		>
			<div mix={[scenePanel()]}>{handle.props.children}</div>
		</div>
	);
}

/**
 * Formats a poll interval as the shortest unit that holds it whole, the way the cadence
 * table reads: 15 min, 4 h, 7 d.
 */
export function formatInterval(ms: number): string {
	let minutes = ms / 60_000;
	if (minutes < 60) return `${minutes} min`;
	let hours = minutes / 60;
	if (hours < 24) return `${hours} h`;
	return `${hours / 24} d`;
}

/**
 * The fetch schedule read straight off the bands the feed objects use: posts a day on one
 * side, how often the feed is fetched on the other, with a sample feed in the busiest band
 * and the weekly check a silent feed falls back to at the foot.
 */
export function CadenceScene(handle: Handle<{ t: Translate; framed?: boolean }>) {
	return () => {
		let { framed, t } = handle.props;
		let harbor = SAMPLE_FEEDS.find((feed) => feed.title === "Harbor Daily");
		return (
			<Scene framed={framed}>
				<div mix={[sceneRow(), raw({ borderBlockStart: "none", paddingBlockStart: "0" })]}>
					<span mix={[quiet()]}>{t("landing.scenes.cadence.rate")}</span>
					<span mix={[quiet()]}>{t("landing.scenes.cadence.every")}</span>
				</div>
				{POLL_BANDS.map((band, index) => (
					<div key={band.minRate} mix={[sceneRow()]}>
						<span mix={[clipped(), raw({ display: "flex", alignItems: "center", gap: "0.5rem" })]}>
							<span mix={[figure()]}>{band.minRate > 0 ? `≥ ${band.minRate}` : "> 0"}</span>
							{index === 0 && harbor ? (
								<span mix={[quiet(), clipped()]}>{harbor.title}</span>
							) : null}
						</span>
						<span
							mix={[
								figure(),
								raw({
									padding: "0.0625rem 0.5rem",
									borderRadius: "999px",
									backgroundColor: index === 0 ? "var(--ui-brand-bg-tint)" : "transparent",
									color:
										index === 0 ? "var(--ui-brand-fg-emphasis)" : "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{formatInterval(band.intervalMs)}
						</span>
					</div>
				))}
				<div mix={[sceneRow()]}>
					<span mix={[quiet()]}>{t("landing.scenes.cadence.silent")}</span>
					<span mix={[figure()]}>{formatInterval(POLL_DORMANT_MS)}</span>
				</div>
			</Scene>
		);
	};
}

/**
 * Three filters read back as the sentences they are, each with the count of posts it has
 * decided, and the preview of what a fourth would have caught before it is saved.
 */
export function FiltersScene(handle: Handle<{ t: Translate; framed?: boolean }>) {
	return () => {
		let { framed, t } = handle.props;
		let rules = [
			{
				field: "title",
				value: "Sponsored",
				action: "drop",
				count: 214,
				scope: t("rules.scope.all"),
			},
			{
				field: "title",
				value: "release",
				action: "flag",
				count: 37,
				scope: t("rules.scope.feed", { feed: "Kettle releases" }),
			},
			{
				field: "author",
				value: "Press office",
				action: "mark_read",
				count: 58,
				scope: t("rules.scope.feed", { feed: "City Desk" }),
			},
		] as const;
		return (
			<Scene framed={framed}>
				{rules.map((rule, index) => (
					<div
						key={rule.value}
						mix={[
							raw({ display: "grid", gap: "0.125rem" }),
							index > 0
								? raw({ paddingBlockStart: "0.625rem", borderBlockStart: HAIRLINE })
								: raw({}),
						]}
					>
						<span mix={[raw({ color: "var(--ui-neutral-fg-emphasis)", textWrap: "pretty" })]}>
							{t("rules.sentence", {
								field: t(`rules.fields.${rule.field}`),
								value: rule.value,
								action: t(`rules.actions.${rule.action}`),
							})}
						</span>
						<span
							mix={[
								quiet(),
								raw({ display: "flex", justifyContent: "space-between", gap: "0.5rem" }),
							]}
						>
							<span mix={[clipped()]}>{rule.scope}</span>
							<span mix={[figure(), raw({ color: "var(--ui-brand-fg)" })]}>
								{t("rules.matched", { count: rule.count })}
							</span>
						</span>
					</div>
				))}
				<div
					mix={[
						raw({
							display: "grid",
							gap: "0.25rem",
							padding: "0.625rem 0.75rem",
							borderRadius: "0.375rem",
							backgroundColor: "var(--ui-brand-bg-tint)",
							color: "var(--ui-brand-fg-emphasis)",
						}),
					]}
				>
					<span mix={[raw({ fontWeight: "600" })]}>{t("rules.preview.legend")}</span>
					<span mix={[raw({ fontSize: "0.75rem" })]}>
						{t("rules.preview.result", { count: 12, scanned: 500 })}
					</span>
				</div>
			</Scene>
		);
	};
}

/**
 * A search narrowed with a phrase, an OR and a minus, the posts it found, and the line
 * under the list naming how far back it looked.
 */
export function SearchScene(handle: Handle<{ t: Translate; framed?: boolean }>) {
	return () => {
		let { framed, t } = handle.props;
		let found = SAMPLE_POSTS.filter((post) => /ferry|footbridge|bus/i.test(post.title));
		return (
			<Scene framed={framed}>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							padding: "0.375rem 0.625rem",
							border: HAIRLINE,
							borderRadius: "0.375rem",
							minInlineSize: "0",
						}),
					]}
				>
					<SearchIcon size={14} />
					<span mix={[mono(), clipped(), raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
						harbour OR ferry -sponsored
					</span>
				</div>
				{found.map((post) => (
					<div key={post.title} mix={[sceneRow()]}>
						<span mix={[clipped(), raw({ fontFamily: "var(--ui-font-reading)" })]}>
							{post.title}
						</span>
						<span mix={[quiet(), raw({ whiteSpace: "nowrap" })]}>{post.time}</span>
					</div>
				))}
				<span mix={[quiet()]}>{t("reading.searched.archive", { date: "2 Mar 2024" })}</span>
			</Scene>
		);
	};
}

/** The post page's article under the row it was opened from, with its source named above it. */
export function ArticleScene(handle: Handle<{ t: Translate; framed?: boolean }>) {
	return () => {
		let { framed, t } = handle.props;
		return (
			<Scene framed={framed}>
				<span mix={[quiet(), raw({ color: "var(--ui-brand-fg)" })]}>
					{t("post.source", { feed: "Field Notes" })}
				</span>
				<span
					mix={[
						raw({
							fontFamily: "var(--ui-font-serif)",
							fontSize: "1.125rem",
							lineHeight: "1.3",
							color: "var(--ui-neutral-fg-emphasis)",
							textWrap: "balance",
						}),
					]}
				>
					Notes on walking the same route for a year
				</span>
				<span mix={[quiet()]}>{t("post.article.byline", { byline: "Ana Ruiz" })}</span>
				<span
					mix={[
						raw({
							fontFamily: "var(--ui-font-serif)",
							lineHeight: "1.6",
							color: "var(--ui-neutral-fg)",
						}),
					]}
				>
					For a year I walked the same four kilometres every morning: down the hill, along the
					harbour wall, back through the market before it opened.
				</span>
			</Scene>
		);
	};
}

/**
 * The one notification a check sends for every picked feed that had something, and the
 * quiet hours that would have held it back overnight.
 */
export function NotifyScene(handle: Handle<{ t: Translate; framed?: boolean }>) {
	return () => {
		let { framed, t } = handle.props;
		return (
			<Scene framed={framed}>
				<div mix={[raw({ display: "flex", gap: "0.75rem", alignItems: "start" })]}>
					<span
						mix={[
							raw({
								display: "inline-grid",
								placeItems: "center",
								flexShrink: "0",
								inlineSize: "2rem",
								blockSize: "2rem",
								borderRadius: "0.5rem",
								backgroundColor: "var(--ui-brand-bg-solid)",
								color: "var(--ui-brand-fg-on-solid)",
							}),
						]}
					>
						<BellIcon size={16} />
					</span>
					<span mix={[raw({ display: "grid", minInlineSize: "0" })]}>
						<span mix={[raw({ display: "flex", justifyContent: "space-between", gap: "0.5rem" })]}>
							<span mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}>
								{t("notifications.title", { count: 3 })}
							</span>
							<span mix={[quiet()]}>07:02</span>
						</span>
						<span mix={[raw({ color: "var(--ui-neutral-fg)", textWrap: "pretty" })]}>
							{t("notifications.body", { count: 3, feeds: "Harbor Daily, City Desk, Field Notes" })}
						</span>
					</span>
				</div>
				<div mix={[sceneRow()]}>
					<span mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
						{t("notifications.quiet.legend")}
					</span>
					<span mix={[figure()]}>22:00 – 07:00</span>
				</div>
				<span mix={[quiet(), raw({ textWrap: "pretty" })]}>
					{t("notifications.quiet.description")}
				</span>
			</Scene>
		);
	};
}

/** The sidebar's organizing bands: a pinned feed, three folders, and labels on kept posts. */
export function OrganizeScene(handle: Handle<{ t: Translate; framed?: boolean }>) {
	return () => {
		let { framed, t } = handle.props;
		let rows = [
			{ icon: <PinIcon size={14} />, label: "Field Notes", count: 2 },
			{ icon: <FolderIcon size={14} />, label: "News", count: 13 },
			{ icon: <FolderIcon size={14} />, label: "Engineering", count: 1 },
			{ icon: <FolderIcon size={14} />, label: "Reading", count: 2 },
		];
		return (
			<Scene framed={framed}>
				{rows.map((row, index) => (
					<div
						key={row.label}
						mix={[
							index === 0
								? raw({
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										gap: "0.75rem",
									})
								: sceneRow(),
						]}
					>
						<span
							mix={[
								raw({ display: "flex", alignItems: "center", gap: "0.5rem", minInlineSize: "0" }),
							]}
						>
							<span mix={[raw({ display: "inline-flex", color: "var(--ui-neutral-fg-muted)" })]}>
								{row.icon}
							</span>
							<span mix={[clipped(), raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
								{row.label}
							</span>
						</span>
						<span mix={[figure(), quiet()]}>{row.count}</span>
					</div>
				))}
				<div
					mix={[sceneRow(), raw({ justifyContent: "start", flexWrap: "wrap", gap: "0.375rem" })]}
				>
					{["to cook", "trip 2027", "cite"].map((label) => (
						<span
							key={label}
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.25rem",
									padding: "0.0625rem 0.5rem",
									borderRadius: "999px",
									border: HAIRLINE,
									fontSize: "0.75rem",
								}),
							]}
						>
							<TagIcon size={11} />
							{label}
						</span>
					))}
					<span mix={[quiet()]}>{t("tags.strip.legend")}</span>
				</div>
			</Scene>
		);
	};
}

/** An OPML file arriving, read back in the import's own counts, and the ZIP that leaves. */
export function DataScene(handle: Handle<{ t: Translate; framed?: boolean }>) {
	return () => {
		let { framed, t } = handle.props;
		let files = ["subscriptions.opml", "saved.csv", "reader.json"];
		return (
			<Scene framed={framed}>
				<span
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					<span mix={[mono()]}>feeds-2026.opml</span>
				</span>
				<span
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							color: "var(--ui-success-fg)",
						}),
					]}
				>
					<CheckIcon size={14} />
					{t("feeds.transfer.import.added", { count: 142 })}
				</span>
				<span mix={[quiet()]}>{t("feeds.transfer.import.alreadyFollowing", { count: 3 })}</span>
				<span
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							color: "var(--ui-warning-fg)",
						}),
					]}
				>
					<TriangleAlertIcon size={14} />
					{t("feeds.transfer.import.failed", { count: 1 })}
				</span>
				<div mix={[sceneRow(), raw({ justifyContent: "start" })]}>
					<FileArchiveIcon size={14} />
					<span mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
						{t("feeds.transfer.exportAll")}
					</span>
				</div>
				{files.map((file) => (
					<span key={file} mix={[mono(), quiet(), raw({ paddingInlineStart: "1.375rem" })]}>
						{file}
					</span>
				))}
			</Scene>
		);
	};
}

/** The tools an assistant called over one morning, as the agent endpoint names them. */
export function AgentsScene(handle: Handle<{ t: Translate; framed?: boolean }>) {
	return () => {
		let { framed, t } = handle.props;
		let calls = [
			{ tool: "read_timeline", result: t("landing.scenes.agents.timeline", { count: 17 }) },
			{ tool: "search_timeline", result: "“footbridge”" },
			{ tool: "save_post", result: "Field Notes" },
			{ tool: "mark_feed_read", result: "Harbor Daily" },
		];
		return (
			<Scene framed={framed}>
				<span mix={[raw({ display: "flex", justifyContent: "space-between", gap: "0.5rem" })]}>
					<span mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
						{t("agent.mint.placeholder")}
					</span>
					<span mix={[quiet()]}>{t("agent.scopes.write")}</span>
				</span>
				{calls.map((call) => (
					<div key={call.tool} mix={[sceneRow()]}>
						<span mix={[mono(), raw({ color: "var(--ui-brand-fg)" })]}>{call.tool}</span>
						<span mix={[quiet(), clipped()]}>{call.result}</span>
					</div>
				))}
			</Scene>
		);
	};
}
