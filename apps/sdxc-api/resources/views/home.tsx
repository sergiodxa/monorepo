/**
 * Marketing landing for api.sdxc.dev: brand hero pinned to the bottom-left of
 * the first viewport, then x402 charging, MCP setup and the priced catalog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { counterIncrement, counterReset, pseudoContent, raw } from "@sdxc/u/general";
import {
	absolute,
	flex,
	flexCol,
	flexWrap,
	gap,
	grid,
	gridTemplate,
	inlineFlex,
	inset,
	items,
	justify,
	relative,
} from "@sdxc/u/layout";
import { overflow, overflowX } from "@sdxc/u/overflow";
import { m, maxIs, minBs, mbs, p } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { before, hover } from "@sdxc/u/state";
import {
	font,
	leading,
	nowrap,
	tabularNums,
	textAlign,
	textDecoration,
	weight,
} from "@sdxc/u/typography";

import type { Operation } from "~/config/catalog";

import { SITE_BRAND, SITE_ORIGIN, SITE_TAGLINE } from "~/config/site";

namespace HomeView {
	export interface Props {
		/** Priced operations from the catalog. */
		operations: readonly Operation[];
	}
}

/**
 * Cursor / Claude Desktop config: first-party mcp-bridge at the Streamable HTTP
 * endpoint. Public samples omit operator credentials.
 */
const MCP_BRIDGE_JSON = `{
  "mcpServers": {
    "sdxc-api": {
      "command": "npx",
      "args": [
        "-y",
        "@sdxc/mcp@latest",
        "${SITE_ORIGIN}/mcp"
      ]
    }
  }
}`;

/** Same bridge via Bun. */
const MCP_BRIDGE_BUN_JSON = `{
  "mcpServers": {
    "sdxc-api": {
      "command": "bunx",
      "args": [
        "@sdxc/mcp@latest",
        "${SITE_ORIGIN}/mcp"
      ]
    }
  }
}`;

/** Stdio smoke from a shell. */
const MCP_BRIDGE_SHELL = `npx -y @sdxc/mcp@latest ${SITE_ORIGIN}/mcp`;

/** Example unpaid → paid HTTP exchange. */
const HTTP_EXAMPLE = `# 1. Challenge
curl -i -X POST ${SITE_ORIGIN}/v1/semver.satisfies \\
  -H 'content-type: application/json' \\
  -d '{"version":"1.2.3","comparison":"^","against":"1.0.0"}'
# → 402 + PAYMENT-REQUIRED

# 2. Retry with PAYMENT-SIGNATURE from your x402 wallet
# → 200 + PAYMENT-RESPONSE + JSON result`;

/** Soft entrance for the hero (keyframes live in `colors.css`). */
const RISE = raw({ animation: "apis-rise 0.7s ease-out both" });

/** Soft entrance for content sections under the hero. */
const SECTION_RISE = raw({ animation: "apis-rise 0.6s ease-out 0.08s both" });

/** Mono chip for inline path and flag names. */
const INLINE_CODE = [
	font("mono"),
	raw({
		fontSize: "0.88em",
		padding: "0.1em 0.35em",
		borderRadius: "0.25rem",
		background: "color-mix(in oklch, var(--apis-accent) 18%, var(--apis-paper))",
	}),
];

/** Underlined accent link used in body copy and the footer. */
const LINK = [
	raw({ color: "var(--apis-accent-ink)", textUnderlineOffset: "0.15em" }),
	textDecoration("underline"),
	hover(raw({ color: "var(--apis-ink)" })),
];

/** Primary hero CTA — ink fill. */
const CTA_PRIMARY = [
	inlineFlex(),
	items("center"),
	justify("center"),
	weight("semibold"),
	raw({
		padding: "0.7rem 1.15rem",
		borderRadius: "0.35rem",
		background: "var(--apis-ink)",
		color: "var(--apis-paper)",
		textDecoration: "none",
		transition: "transform 0.2s ease, background-color 0.2s ease",
	}),
	hover(
		raw({
			background: "var(--apis-accent-ink)",
			transform: "translateY(-1px)",
		}),
	),
];

/** Secondary hero CTA — ink outline. */
const CTA_SECONDARY = [
	inlineFlex(),
	items("center"),
	justify("center"),
	weight("semibold"),
	raw({
		padding: "0.7rem 1.15rem",
		borderRadius: "0.35rem",
		border: "1px solid var(--apis-ink)",
		color: "var(--apis-ink)",
		textDecoration: "none",
		background: "transparent",
		transition: "background-color 0.2s ease, transform 0.2s ease",
	}),
	hover(
		raw({
			background: "color-mix(in oklch, var(--apis-accent) 25%, transparent)",
			transform: "translateY(-1px)",
		}),
	),
];

/** Content section stack under the hero. */
const SECTION = [flex(), flexCol(), gap(4), SECTION_RISE];

/** Section chapter title. */
const SECTION_HEADING = [
	m(0),
	weight("semibold"),
	raw({
		fontSize: "clamp(1.5rem, 3vw, 1.85rem)",
		letterSpacing: "-0.03em",
	}),
];

/** Section lead paragraph. */
const SECTION_LEAD = [
	m(0),
	maxIs("40rem"),
	raw({ color: "var(--apis-ink-soft)", fontSize: "1.05rem" }),
];

/** Dark mono sample block. */
const PRE = [
	m(0),
	overflowX("auto"),
	font("mono"),
	raw({
		padding: "1rem 1.1rem",
		background: "var(--apis-code-bg)",
		color: "var(--apis-code-fg)",
		fontSize: "0.82rem",
		lineHeight: "1.55",
		borderRadius: "0.35rem",
	}),
];

/** Mono label above a sample block. */
const SAMPLE_LABEL = [
	font("mono"),
	raw({
		margin: "0 0 0.5rem",
		fontSize: "0.85rem",
		color: "var(--apis-ink-soft)",
	}),
];

/** Table header cell. */
const TH = [
	raw({
		padding: "0.75rem 0.85rem 0.75rem 0",
		borderBottom: "1px solid var(--apis-line)",
		fontSize: "0.8rem",
		fontWeight: "600",
		textTransform: "uppercase",
		letterSpacing: "0.04em",
		color: "var(--apis-ink-soft)",
	}),
];

/** Table body cell. */
const TD = [
	raw({
		padding: "1rem 0.85rem 1rem 0",
		borderBottom: "1px solid var(--apis-line)",
		verticalAlign: "top",
	}),
];

/**
 * Price column: physical right alignment and tabular mono figures so amounts
 * share one trailing edge down the column.
 */
const PRICE_TH = [
	...TH,
	nowrap(),
	textAlign("right"),
	tabularNums(),
	font("mono"),
	raw({ paddingInlineEnd: "0" }),
];

/** Body cell companion to {@link PRICE_TH}. */
const PRICE_TD = [
	...TD,
	nowrap(),
	textAlign("right"),
	tabularNums(),
	font("mono"),
	raw({ paddingInlineEnd: "0" }),
];

/**
 * Renders the landing composition: bottom-left hero, charging, MCP, catalog, HTTP.
 */
export default function HomeView(handle: Handle<HomeView.Props>) {
	return () => {
		let { operations } = handle.props;

		return (
			<div mix={[relative(), raw({ isolation: "isolate" }), overflow("clip")]}>
				<div
					aria-hidden="true"
					mix={[
						absolute(),
						inset(0),
						z(-1),
						raw({
							backgroundImage: `
								linear-gradient(160deg, var(--apis-paper) 0%, var(--apis-paper-deep) 55%, oklch(0.9 0.03 195) 100%),
								linear-gradient(var(--apis-grid) 1px, transparent 1px),
								linear-gradient(90deg, var(--apis-grid) 1px, transparent 1px)
							`,
							backgroundSize: "auto, 48px 48px, 48px 48px",
							animation: "apis-grid-drift 48s linear infinite",
						}),
					]}
				/>

				<header
					mix={[
						flex(),
						flexCol(),
						justify("end"),
						gap(5),
						minBs("100dvh"),
						RISE,
						raw({
							padding: "clamp(1.5rem, 4vw, 3rem)",
							paddingBottom: "clamp(2.5rem, 8vh, 5rem)",
							boxSizing: "border-box",
						}),
					]}
				>
					<p
						mix={[
							m(0),
							weight("bold"),
							leading("none"),
							raw({
								fontSize: "clamp(2.75rem, 9vw, 5.5rem)",
								letterSpacing: "-0.04em",
								lineHeight: "0.95",
								color: "var(--apis-ink)",
							}),
						]}
					>
						{SITE_BRAND}
					</p>
					<h1
						mix={[
							m(0),
							maxIs("22ch"),
							weight("medium"),
							raw({
								fontSize: "clamp(1.35rem, 3.2vw, 2rem)",
								letterSpacing: "-0.02em",
								lineHeight: "1.2",
								color: "var(--apis-ink-soft)",
								textWrap: "balance",
							}),
						]}
					>
						{SITE_TAGLINE}
					</h1>
					<p
						mix={[
							m(0),
							maxIs("42rem"),
							raw({ fontSize: "1.05rem", color: "var(--apis-ink-soft)" }),
						]}
					>
						Install packages from npm for free. When an agent needs hosted execution — encode a QR,
						highlight source, parse a zone file — it pays per call with{" "}
						<a href="https://x402.org/" mix={LINK}>
							x402
						</a>
						.
					</p>
					<div mix={[flex(), flexWrap(), gap(3), mbs(2)]}>
						<a href="#mcp" mix={CTA_PRIMARY}>
							Connect MCP
						</a>
						<a href="#catalog" mix={CTA_SECONDARY}>
							Browse operations
						</a>
						<a href="/v1" mix={CTA_SECONDARY}>
							JSON catalog
						</a>
					</div>
				</header>

				<main
					mix={[
						flex(),
						flexCol(),
						raw({
							gap: "clamp(3rem, 8vw, 5.5rem)",
							padding: "0 clamp(1.5rem, 4vw, 3rem) clamp(3rem, 8vw, 5rem)",
							maxWidth: "56rem",
						}),
					]}
				>
					<section id="pay" mix={SECTION} aria-labelledby="pay-heading">
						<h2 id="pay-heading" mix={SECTION_HEADING}>
							How charging works
						</h2>
						<p mix={SECTION_LEAD}>
							Every priced call uses the{" "}
							<a href="https://x402.org/" mix={LINK}>
								x402
							</a>{" "}
							protocol. No API keys, no accounts — a wallet settles USDC on the configured network.
						</p>
						<ol
							mix={[
								m(0),
								p(0),
								flex(),
								flexCol(),
								gap(3),
								counterReset("step"),
								raw({ listStyle: "none" }),
							]}
						>
							{[
								"Call an operation or MCP tool without payment.",
								"The server answers HTTP 402 with a PAYMENT-REQUIRED header (amount, network, destination).",
								"Your client signs a payment and retries with PAYMENT-SIGNATURE.",
								"We verify and settle through a facilitator, then return the result with PAYMENT-RESPONSE.",
							].map((step) => (
								<li
									key={step}
									mix={[
										grid(),
										gridTemplate({ columns: "1.35rem 1fr" }),
										gap(3),
										items("baseline"),
										counterIncrement("step"),
										before([
											pseudoContent("counter(step)"),
											inlineFlex(),
											items("center"),
											justify("center"),
											tabularNums(),
											weight("semibold"),
											raw({
												width: "1.35rem",
												height: "1.35rem",
												borderRadius: "999px",
												background: "var(--apis-accent)",
												color: "var(--apis-accent-ink)",
												fontSize: "0.72rem",
												lineHeight: "1",
												translate: "0 0.12em",
											}),
										]),
									]}
								>
									<span mix={[leading("normal")]}>{step}</span>
								</li>
							))}
						</ol>
						<p
							mix={[
								raw({ margin: "1.25rem 0 0", color: "var(--apis-ink-soft)", fontSize: "0.95rem" }),
							]}
						>
							<code mix={INLINE_CODE}>GET /</code>, <code mix={INLINE_CODE}>GET /v1</code>,{" "}
							<code mix={INLINE_CODE}>GET /health</code> and MCP discovery stay free. Only running
							an operation charges.
						</p>
					</section>

					<section id="mcp" mix={SECTION} aria-labelledby="mcp-heading">
						<h2 id="mcp-heading" mix={SECTION_HEADING}>
							Connect over MCP
						</h2>
						<p mix={SECTION_LEAD}>
							Handshake-era agents (Cursor, Claude Desktop) speak an older MCP revision. Point{" "}
							<code mix={INLINE_CODE}>mcp-bridge</code> from{" "}
							<a href="https://www.npmjs.com/package/@sdxc/mcp" mix={LINK}>
								@sdxc/mcp
							</a>{" "}
							at the Streamable HTTP endpoint. Tool names match the catalog ids.
						</p>

						<p mix={SAMPLE_LABEL}>Endpoint</p>
						<pre mix={PRE}>
							<code>{`${SITE_ORIGIN}/mcp`}</code>
						</pre>

						<p mix={[SAMPLE_LABEL, raw({ marginBlockStart: "1.5rem" })]}>Shell</p>
						<pre mix={PRE}>
							<code>{MCP_BRIDGE_SHELL}</code>
						</pre>

						<p mix={[SAMPLE_LABEL, raw({ marginBlockStart: "1.5rem" })]}>
							Cursor / Claude Desktop (npx)
						</p>
						<pre mix={PRE}>
							<code>{MCP_BRIDGE_JSON}</code>
						</pre>

						<p mix={[SAMPLE_LABEL, raw({ marginBlockStart: "1.5rem" })]}>
							Cursor / Claude Desktop (bunx)
						</p>
						<pre mix={PRE}>
							<code>{MCP_BRIDGE_BUN_JSON}</code>
						</pre>

						<p
							mix={[
								raw({ margin: "1.25rem 0 0", color: "var(--apis-ink-soft)", fontSize: "0.95rem" }),
							]}
						>
							Unpaid <code mix={INLINE_CODE}>tools/call</code> answers HTTP 402 with the same x402
							headers as <code mix={INLINE_CODE}>POST /v1/…</code>. Your MCP client needs an
							x402-aware wallet or bridge to settle.
						</p>
					</section>

					<section id="catalog" mix={SECTION} aria-labelledby="catalog-heading">
						<h2 id="catalog-heading" mix={SECTION_HEADING}>
							Operations
						</h2>
						<p mix={SECTION_LEAD}>
							Each row wraps one published package. Prices are USDC atomic units (6 decimals) on the
							configured network.
						</p>
						<div
							mix={[
								overflowX("auto"),
								raw({
									borderTop: "1px solid var(--apis-line)",
									borderBottom: "1px solid var(--apis-line)",
								}),
							]}
						>
							<table
								mix={[
									raw({
										width: "100%",
										borderCollapse: "collapse",
										fontSize: "0.95rem",
										textAlign: "left",
									}),
								]}
							>
								<thead>
									<tr>
										<th mix={TH}>Id</th>
										<th mix={[TH, nowrap(), raw({ paddingInlineEnd: "1.25rem" })]}>Package</th>
										<th mix={PRICE_TH}>Price</th>
									</tr>
								</thead>
								<tbody>
									{operations.map((operation) => (
										<tr key={operation.id}>
											<td mix={TD}>
												<code mix={INLINE_CODE}>{operation.id}</code>
												<div
													mix={[
														raw({
															marginTop: "0.35rem",
															color: "var(--apis-ink-soft)",
															fontSize: "0.85rem",
														}),
													]}
												>
													{operation.description}
												</div>
											</td>
											<td mix={[TD, nowrap(), raw({ paddingInlineEnd: "1.25rem" })]}>
												<a
													href={`https://www.npmjs.com/package/${operation.package}`}
													mix={[LINK, nowrap(), font("mono"), raw({ fontSize: "0.9em" })]}
												>
													{operation.package}
												</a>
											</td>
											<td mix={PRICE_TD}>{operation.priceUsd}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>

					<section id="http" mix={SECTION} aria-labelledby="http-heading">
						<h2 id="http-heading" mix={SECTION_HEADING}>
							Call over plain HTTP
						</h2>
						<p mix={SECTION_LEAD}>
							<code mix={INLINE_CODE}>POST /v1/&lt;id&gt;</code> with a JSON body. Same prices and
							payment headers as MCP.
						</p>
						<pre mix={PRE}>
							<code>{HTTP_EXAMPLE}</code>
						</pre>
					</section>
				</main>

				<footer
					mix={[
						flex(),
						flexWrap(),
						gap(4, 6),
						raw({
							padding: "2rem clamp(1.5rem, 4vw, 3rem) 3rem",
							borderTop: "1px solid var(--apis-line)",
							color: "var(--apis-ink-soft)",
							fontSize: "0.9rem",
						}),
					]}
				>
					<span>Docs and packages stay free on npm and sdxc.dev.</span>
					<a href="https://sdxc.dev" mix={LINK}>
						sdxc.dev
					</a>
					<a href="https://x402.org/" mix={LINK}>
						x402.org
					</a>
					<a href="/v1" mix={LINK}>
						/v1
					</a>
					<a href="/health" mix={LINK}>
						/health
					</a>
				</footer>
			</div>
		);
	};
}
