/**
 * View for the `/mcp` page: what this blog's MCP server offers and how to point a client
 * at it.
 *
 * The page exists because MCP has no discovery mechanism for an anonymous server — a
 * person adds the URL by hand — so the address somebody is given has to be the address
 * that explains itself. Its tool and resource lists come from the server's own
 * declarations, so the page cannot describe a tool that is not served.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { gap, grid } from "@pkg/u/layout";
import { overflowX } from "@pkg/u/overflow";
import { m, maxIs, mbs, p, pi } from "@pkg/u/size";
import { font, text, weight } from "@pkg/u/typography";
import { Heading } from "@pkg/ui";

import { BlogLayout } from "~/resources/layouts/blog";

/**
 * Shared types for the MCP page view model.
 */
export namespace McpView {
	/** One tool, as the server declares it. */
	export interface Tool {
		name: string;
		title?: string;
		description: string;
	}

	/** One resource, as the server declares it. */
	export interface Resource {
		name: string;
		title?: string;
		description?: string;
		uriTemplate: string;
	}

	/** Data required to render the page. */
	export interface Model {
		/** Absolute URL of the endpoint, as the reader should paste it. */
		endpoint: string;
		tools: Array<Tool>;
		resources: Array<Resource>;
		/** Requests one caller may spend per minute. */
		rateLimit: number;
	}
}

/**
 * Renders a shell command or configuration snippet.
 *
 * Its own component because the page has three, and a reader copies them verbatim —
 * so they scroll rather than wrap, since a wrapped command is one somebody pastes broken.
 */
function Snippet(handle: Handle<{ children: string }>) {
	return () => (
		<pre
			mix={[
				m(0),
				p(4),
				rounded("lg"),
				bg("neutral.tint"),
				border({ width: 1, color: "neutral" }),
				overflowX("auto"),
				font("mono"),
				text("sm"),
				fg("neutral.emphasis"),
			]}
		>
			<code>{handle.props.children}</code>
		</pre>
	);
}

/**
 * Creates a renderer for the MCP page.
 *
 * @returns View function that renders the endpoint, the client configuration, and what the
 * server offers.
 */
export function McpView() {
	return ({ model }: { model: McpView.Model }) => (
		<BlogLayout
			title="MCP server"
			description="Connect this blog to your agent so it can search and read my writing."
		>
			<main mix={[grid(), gap(6)]}>
				<header mix={[grid(), gap(3)]}>
					<Heading level={1} mix={[text("3xl")]}>
						MCP server
					</Heading>
					<p mix={[m(0), maxIs("62ch"), text("lg"), fg("neutral")]}>
						This blog speaks the{" "}
						<a href="https://modelcontextprotocol.io">Model Context Protocol</a>. Point your agent
						at it once and it can search my articles, tutorials and glossary, and read any of them
						in full — instead of relying on whatever it happened to memorize, or on a web search
						that may surface an outdated copy.
					</p>
					<p mix={[m(0), maxIs("62ch"), text("lg"), fg("neutral")]}>
						Everything here is read-only and needs no account. The endpoint is:
					</p>
					<Snippet>{model.endpoint}</Snippet>
				</header>

				<section mix={[grid(), gap(3)]}>
					<Heading level={2} mix={[text("2xl")]}>
						Connecting
					</Heading>
					<p mix={[m(0), maxIs("62ch"), text("lg"), fg("neutral")]}>In Claude Code, one command:</p>
					<Snippet>{`claude mcp add --transport http sergiodxa ${model.endpoint}`}</Snippet>
					<p mix={[m(0), maxIs("62ch"), text("lg"), fg("neutral")]}>
						In any client configured with a file, add a server entry:
					</p>
					<Snippet>
						{JSON.stringify(
							{ mcpServers: { sergiodxa: { type: "http", url: model.endpoint } } },
							null,
							2,
						)}
					</Snippet>
				</section>

				<section mix={[grid(), gap(3)]}>
					<Heading level={2} mix={[text("2xl")]}>
						Tools
					</Heading>
					<p mix={[m(0), maxIs("62ch"), text("lg"), fg("neutral")]}>
						Your agent calls these on its own, when the conversation calls for one.
					</p>
					<dl mix={[m(0), grid(), gap(3)]}>
						{model.tools.map((tool) => (
							<div
								key={tool.name}
								mix={[
									p(4),
									rounded("lg"),
									bg("neutral.tint"),
									border({ width: 1, color: "neutral" }),
								]}
							>
								<dt mix={[m(0), font("mono"), text("base"), weight("bold"), fg("brand.emphasis")]}>
									{tool.name}
								</dt>
								<dd mix={[m(0), mbs(2), text("lg"), fg("neutral.emphasis")]}>{tool.description}</dd>
							</div>
						))}
					</dl>
				</section>

				<section mix={[grid(), gap(3)]}>
					<Heading level={2} mix={[text("2xl")]}>
						Resources
					</Heading>
					<p mix={[m(0), maxIs("62ch"), text("lg"), fg("neutral")]}>
						These are for you rather than for the model: a client that renders a picker lists every
						post here, so you can attach one to a conversation yourself. Each is served as Markdown
						at its own URL, so a client may fetch it directly.
					</p>
					<dl mix={[m(0), grid(), gap(3)]}>
						{model.resources.map((resource) => (
							<div
								key={resource.name}
								mix={[
									p(4),
									rounded("lg"),
									bg("neutral.tint"),
									border({ width: 1, color: "neutral" }),
								]}
							>
								<dt mix={[m(0), text("xl"), weight("bold"), fg("neutral.emphasis")]}>
									{resource.title ?? resource.name}
								</dt>
								{resource.description && (
									<dd mix={[m(0), mbs(2), text("lg"), fg("neutral.emphasis")]}>
										{resource.description}
									</dd>
								)}
								<dd mix={[m(0), mbs(2), pi(0), font("mono"), text("sm"), fg("neutral.muted")]}>
									{resource.uriTemplate}
								</dd>
							</div>
						))}
					</dl>
				</section>

				<section mix={[grid(), gap(3)]}>
					<Heading level={2} mix={[text("2xl")]}>
						Fine print
					</Heading>
					<ul mix={[m(0), grid(), gap(2), text("lg"), fg("neutral")]}>
						<li>Nothing here writes. There is no tool that can change anything on this blog.</li>
						<li>Unpublished and scheduled posts are never reachable, by any tool or resource.</li>
						<li>
							{model.rateLimit} requests a minute per caller, which is far above what a conversation
							uses and low enough to be uninteresting to a scraper.
						</li>
						<li>Answers may be up to five minutes stale, the same as a feed reader would show.</li>
					</ul>
				</section>
			</main>
		</BlogLayout>
	);
}
