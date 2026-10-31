/**
 * Which picture each feature is argued with: the card scene the home's grid shows, the
 * product window a feature page opens on, and the different visual its steps sit beside.
 * Keyed by slug so a test can hold every feature to all three and to never repeating.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { CodeStage } from "@sdxc/ui/patterns";

import type { FeatureSlug } from "~/config/marketing";

import {
	ArticleView,
	FeedView,
	HAIRLINE,
	QueueRows,
	QueueView,
	ReaderWindow,
} from "~/resources/components/marketing/reader-window";
import { SAMPLE_POSTS } from "~/resources/components/marketing/sample-data";
import {
	AgentsScene,
	ArticleScene,
	CadenceScene,
	DataScene,
	FiltersScene,
	NotifyScene,
	OrganizeScene,
	SearchScene,
	scenePanel,
} from "~/resources/components/marketing/scenes";

/** A scene component that takes the translator and nothing else. */
type SceneComponent = (handle: Handle<{ t: Translate; framed?: boolean }>) => () => RemixNode;

/** The scene each feature's card shows on the home and on the pages that link to it. */
export const FEATURE_CARD_SCENES: Record<FeatureSlug, SceneComponent> = {
	freshness: CadenceScene,
	filters: FiltersScene,
	articles: ArticleScene,
	search: SearchScene,
	notifications: NotifyScene,
	organize: OrganizeScene,
	"your-data": DataScene,
	agents: AgentsScene,
};

/** The search the search page's window and scene both run, in the reader's own syntax. */
const SAMPLE_QUERY = "harbour OR ferry -sponsored";

/** The subscription list a reader carries in and out, as the export writes it. */
const SUBSCRIPTIONS_OPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Reader subscriptions</title></head>
  <body>
    <outline text="News">
      <outline type="rss" text="Harbor Daily"
        xmlUrl="https://harbordaily.example.com/feed.xml" />
      <outline type="rss" text="City Desk"
        xmlUrl="https://citydesk.example.com/rss" />
    </outline>
    <outline type="rss" text="Field Notes"
      xmlUrl="https://fieldnotes.example.com/atom.xml" />
  </body>
</opml>`;

/** A client configuration pointing at the agent endpoint with a minted token. */
const MCP_JSON = `{
  "mcpServers": {
    "reader": {
      "type": "http",
      "url": "https://reader.sergiodxa.com/mcp",
      "headers": {
        "Authorization": "Bearer \${READER_TOKEN}"
      }
    }
  }
}`;

/** One tool call over plain HTTP, the request any client makes on a reader's behalf. */
const SEARCH_SH = `curl https://reader.sergiodxa.com/mcp \\
  -H "Authorization: Bearer $READER_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_timeline",
      "arguments": { "query": "footbridge" }
    }
  }'`;

namespace PageWindow {
	export interface Props {
		t: Translate;
		label: string;
		title: string;
		path: string;
		heading: string;
		description?: string;
		active?: "reading" | "saved" | "feed";
		children: RemixNode;
	}
}

/** A signed-in page inside the window: its heading, the app's one-line explanation, its body. */
function PageWindow(handle: Handle<PageWindow.Props>) {
	return () => {
		let { active, children, description, heading, label, path, t, title } = handle.props;
		return (
			<ReaderWindow t={t} title={title} path={path} label={label} active={active}>
				<div
					mix={[raw({ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "0.75rem" })]}
				>
					<p
						mix={[
							raw({
								margin: "0",
								fontSize: "1.125rem",
								fontWeight: "600",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{heading}
					</p>
					{description ? (
						<p
							mix={[
								raw({
									margin: "0",
									fontSize: "0.75rem",
									color: "var(--ui-neutral-fg-muted)",
									maxInlineSize: "34rem",
									textWrap: "pretty",
								}),
							]}
						>
							{description}
						</p>
					) : null}
					{children}
				</div>
			</ReaderWindow>
		);
	};
}

/** The search syntax as the reader explains it: each form, and what it finds. */
function SyntaxScene(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		let forms = [
			['"night buses"', "phrase"],
			["ferry OR harbour", "either"],
			["-sponsored", "exclude"],
			["NOT podcast", "exclude"],
		] as const;
		return (
			<div aria-hidden="true" mix={[scenePanel()]}>
				{forms.map(([form, meaning], index) => (
					<div
						key={form}
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								gap: "1rem",
								alignItems: "baseline",
							}),
							index > 0
								? raw({ paddingBlockStart: "0.5rem", borderBlockStart: HAIRLINE })
								: raw({}),
						]}
					>
						<code
							mix={[
								raw({
									fontFamily: "var(--ui-font-mono)",
									fontSize: "0.8125rem",
									color: "var(--ui-brand-fg)",
									whiteSpace: "nowrap",
								}),
							]}
						>
							{form}
						</code>
						<span
							mix={[
								raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)", textAlign: "end" }),
							]}
						>
							{t(`landing.scenes.syntax.${meaning}`)}
						</span>
					</div>
				))}
			</div>
		);
	};
}

/** The browsers a reader allowed, as the notifications settings list them. */
function DevicesScene(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		let devices = [
			{ name: "Firefox · macOS", state: t("notifications.devices.delivered", { date: "07:02" }) },
			{ name: "Safari · iPhone", state: t("notifications.devices.delivered", { date: "07:02" }) },
			{ name: "Chrome · Android", state: t("notifications.devices.never") },
		];
		return (
			<div aria-hidden="true" mix={[scenePanel()]}>
				<p mix={[raw({ margin: "0", fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}>
					{t("notifications.devices.legend")}
				</p>
				{devices.map((device) => (
					<div
						key={device.name}
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								gap: "1rem",
								paddingBlockStart: "0.5rem",
								borderBlockStart: HAIRLINE,
							}),
						]}
					>
						<span mix={[raw({ color: "var(--ui-neutral-fg-emphasis)", whiteSpace: "nowrap" })]}>
							{device.name}
						</span>
						<span
							mix={[
								raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)", textAlign: "end" }),
							]}
						>
							{device.state}
						</span>
					</div>
				))}
			</div>
		);
	};
}

/** The window a feature page opens on, one per feature. */
export const FEATURE_HEROES: Record<FeatureSlug, (t: Translate) => RemixNode> = {
	freshness: (t) => (
		<ReaderWindow
			t={t}
			title="Harbor Daily"
			path="/reading/harbor-daily"
			active="feed"
			label={t("landing.features.pages.freshness.heroAlt")}
		>
			<FeedView t={t} />
		</ReaderWindow>
	),
	filters: (t) => (
		<PageWindow
			t={t}
			title={t("rules.title")}
			path="/rules"
			heading={t("rules.heading")}
			description={t("rules.description")}
			label={t("landing.features.pages.filters.heroAlt")}
		>
			<FiltersScene t={t} framed={false} />
		</PageWindow>
	),
	articles: (t) => (
		<ReaderWindow
			t={t}
			title="Field Notes"
			path="/reading/field-notes/walking-the-same-route"
			active="saved"
			label={t("landing.features.pages.articles.heroAlt")}
		>
			<ArticleView t={t} />
		</ReaderWindow>
	),
	search: (t) => (
		<PageWindow
			t={t}
			title={t("reading.heading")}
			path={`/reading?q=${encodeURIComponent(SAMPLE_QUERY)}`}
			heading={t("reading.headingFor", { query: SAMPLE_QUERY })}
			label={t("landing.features.pages.search.heroAlt")}
		>
			<QueueRows
				t={t}
				posts={SAMPLE_POSTS.filter((post) => /ferry|harbour|bus/i.test(post.title + post.summary))}
			/>
			<p mix={[raw({ margin: "0", fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
				{t("reading.searched.archive", { date: "2 Mar 2024" })}
			</p>
		</PageWindow>
	),
	notifications: (t) => (
		<PageWindow
			t={t}
			title={t("settings.title")}
			path="/settings"
			heading={t("notifications.legend")}
			description={t("notifications.description")}
			label={t("landing.features.pages.notifications.heroAlt")}
		>
			<NotifyScene t={t} framed={false} />
		</PageWindow>
	),
	organize: (t) => (
		<PageWindow
			t={t}
			title={t("saved.title")}
			path="/saved"
			heading={t("saved.heading")}
			active="saved"
			label={t("landing.features.pages.organize.heroAlt")}
		>
			<QueueRows
				t={t}
				posts={SAMPLE_POSTS.filter((post) => post.saved).map((post) => ({ ...post, read: false }))}
			/>
			<OrganizeScene t={t} framed={false} />
		</PageWindow>
	),
	"your-data": (t) => (
		<PageWindow
			t={t}
			title={t("settings.title")}
			path="/settings"
			heading={t("feeds.transfer.legend")}
			description={t("feeds.transfer.exportAllDescription")}
			label={t("landing.features.pages.yourData.heroAlt")}
		>
			<DataScene t={t} framed={false} />
		</PageWindow>
	),
	agents: (t) => (
		<PageWindow
			t={t}
			title={t("settings.title")}
			path="/settings"
			heading={t("agent.legend")}
			description={t("agent.description")}
			label={t("landing.features.pages.agents.heroAlt")}
		>
			<AgentsScene t={t} framed={false} />
		</PageWindow>
	),
};

/** The visual each feature page's steps sit beside, a different screen from its hero. */
export const FEATURE_STEP_VISUALS: Record<FeatureSlug, (t: Translate) => RemixNode> = {
	freshness: (t) => <CadenceScene t={t} framed={false} />,
	filters: (t) => (
		<ReaderWindow
			t={t}
			title={t("nav.reading")}
			path="/reading"
			label={t("landing.features.pages.filters.stepsAlt")}
		>
			<QueueView t={t} posts={SAMPLE_POSTS.slice(0, 4)} waiting={0} />
		</ReaderWindow>
	),
	articles: (t) => (
		<ReaderWindow
			t={t}
			title={t("nav.reading")}
			path="/reading"
			label={t("landing.features.pages.articles.stepsAlt")}
		>
			<QueueView t={t} posts={SAMPLE_POSTS.slice(0, 5)} waiting={0} />
		</ReaderWindow>
	),
	search: (t) => <SyntaxScene t={t} />,
	notifications: (t) => <DevicesScene t={t} />,
	organize: (t) => (
		<ReaderWindow
			t={t}
			title="Harbor Daily"
			path="/reading/harbor-daily"
			active="feed"
			label={t("landing.features.pages.organize.stepsAlt")}
		>
			<FeedView t={t} />
		</ReaderWindow>
	),
	"your-data": () => (
		<CodeStage variant="code" name="reader-opml" title="subscriptions.opml" language="xml">
			{SUBSCRIPTIONS_OPML}
		</CodeStage>
	),
	agents: () => (
		<CodeStage
			variant="code"
			name="reader-agents"
			tabs={[
				{ label: "mcp.json", content: MCP_JSON, language: "json" },
				{ label: "search.sh", content: SEARCH_SH, language: "sh" },
			]}
		/>
	),
};
