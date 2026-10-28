/**
 * Landing page for humans (HTML) and agents (`Accept: text/markdown`): pitch,
 * x402 charging, MCP setup and the operation catalog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { accepts } from "@sdxc/http/negotiate";
import { createAction } from "remix/router";

import { OPERATIONS } from "~/config/catalog";
import { SITE_BRAND, SITE_DESCRIPTION, SITE_ORIGIN, SITE_TAGLINE } from "~/config/site";
import DocumentLayout from "~/resources/layouts/document";
import HomeView from "~/resources/views/home";
import routes from "~/routes/web";

/** Media types the landing negotiates. */
const HTML = "text/html";
const MARKDOWN = "text/markdown";

/** Answers `GET /` as HTML for browsers or Markdown for agents. */
export default createAction(routes.home, (ctx) => {
	if (accepts(ctx.request).preferred(HTML, MARKDOWN) === MARKDOWN) {
		return new Response(landingMarkdown(), {
			headers: { "content-type": "text/markdown; charset=utf-8" },
		});
	}

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${SITE_BRAND} — pay-per-call package APIs`}
			description={SITE_DESCRIPTION}
			canonical={new URL("/", ctx.url).href}
		>
			<HomeView operations={OPERATIONS} />
		</DocumentLayout>,
	);
});

/**
 * Markdown twin of the landing so agents that prefer `text/markdown` get the
 * same MCP and pricing facts without scraping HTML.
 */
function landingMarkdown(): string {
	let operations = OPERATIONS.map(
		(operation) =>
			`- \`${operation.id}\` (${operation.priceUsd}, ${operation.package}) — ${operation.description}`,
	).join("\n");

	return [
		`# ${SITE_BRAND}`,
		"",
		SITE_TAGLINE,
		"",
		SITE_DESCRIPTION,
		"",
		"## How charging works",
		"",
		"Priced calls use [x402](https://x402.org/). Unpaid requests answer HTTP `402` with a",
		"`PAYMENT-REQUIRED` header. Retry with `PAYMENT-SIGNATURE`; a settled call returns the",
		"result and `PAYMENT-RESPONSE`.",
		"",
		"`GET /`, `GET /v1`, `GET /health` and MCP discovery stay free.",
		"",
		"## Connect MCP",
		"",
		"Endpoint:",
		"",
		"```",
		`${SITE_ORIGIN}/mcp`,
		"```",
		"",
		"Claude Code:",
		"",
		"```sh",
		`claude mcp add --transport http sdxc-apis ${SITE_ORIGIN}/mcp`,
		"```",
		"",
		"Config file:",
		"",
		"```json",
		`{`,
		`  "mcpServers": {`,
		`    "sdxc-apis": { "type": "http", "url": "${SITE_ORIGIN}/mcp" }`,
		`  }`,
		`}`,
		"```",
		"",
		"Unpaid `tools/call` answers HTTP 402 with the same x402 headers as `POST /v1/...`.",
		"",
		"## Operations",
		"",
		operations,
		"",
		"Machine catalog: `GET /v1`.",
		"",
	].join("\n");
}
