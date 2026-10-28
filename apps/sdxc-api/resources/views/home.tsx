/**
 * Marketing landing for api.sdxc.dev: brand hero, x402 charging, MCP setup and
 * the priced operation catalog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { css } from "remix/component";

import type { Operation } from "~/config/catalog";

import { SITE_BRAND, SITE_ORIGIN, SITE_TAGLINE } from "~/config/site";

namespace HomeView {
	export interface Props {
		/** Priced operations from the catalog. */
		operations: readonly Operation[];
	}
}

/** Cursor / Claude-style HTTP MCP server block. */
const MCP_JSON = `{
  "mcpServers": {
    "sdxc-apis": {
      "type": "http",
      "url": "${SITE_ORIGIN}/mcp"
    }
  }
}`;

/** Claude Desktop bridge when HTTP MCP is unavailable. */
const MCP_BRIDGE_JSON = `{
  "mcpServers": {
    "sdxc-apis": {
      "command": "npx",
      "args": [
        "-y",
        "@abluva/mcp-remote@latest",
        "${SITE_ORIGIN}/mcp",
        "--protocol",
        "2026-07-28"
      ]
    }
  }
}`;

/** Claude Code one-liner. */
const MCP_CLAUDE = `claude mcp add --transport http sdxc-apis ${SITE_ORIGIN}/mcp`;

/** Example unpaid → paid HTTP exchange. */
const HTTP_EXAMPLE = `# 1. Challenge
curl -i -X POST ${SITE_ORIGIN}/v1/semver.satisfies \\
  -H 'content-type: application/json' \\
  -d '{"version":"1.2.3","comparison":"^","against":"1.0.0"}'
# → 402 + PAYMENT-REQUIRED

# 2. Retry with PAYMENT-SIGNATURE from your x402 wallet
# → 200 + PAYMENT-RESPONSE + JSON result`;

/**
 * Renders the landing composition: hero, charging, MCP, catalog, HTTP.
 */
export default function HomeView(handle: Handle<HomeView.Props>) {
	return () => {
		let { operations } = handle.props;

		return (
			<div
				mix={css({
					position: "relative",
					isolation: "isolate",
					overflow: "clip",
				})}
			>
				<div
					aria-hidden="true"
					mix={css({
						position: "absolute",
						inset: 0,
						zIndex: -1,
						backgroundImage: `
							linear-gradient(160deg, var(--apis-paper) 0%, var(--apis-paper-deep) 55%, oklch(0.9 0.03 195) 100%),
							linear-gradient(var(--apis-grid) 1px, transparent 1px),
							linear-gradient(90deg, var(--apis-grid) 1px, transparent 1px)
						`,
						backgroundSize: "auto, 48px 48px, 48px 48px",
						animation: "apis-grid-drift 48s linear infinite",
					})}
				/>

				<header
					mix={css({
						display: "flex",
						flexDirection: "column",
						justifyContent: "flex-end",
						gap: "1.25rem",
						minHeight: "100dvh",
						padding: "clamp(1.5rem, 4vw, 3rem)",
						paddingBottom: "clamp(2.5rem, 8vh, 5rem)",
						boxSizing: "border-box",
						animation: "apis-rise 0.7s ease-out both",
					})}
				>
					<p
						mix={css({
							margin: 0,
							fontSize: "clamp(2.75rem, 9vw, 5.5rem)",
							fontWeight: 700,
							letterSpacing: "-0.04em",
							lineHeight: 0.95,
							color: "var(--apis-ink)",
						})}
					>
						{SITE_BRAND}
					</p>
					<h1
						mix={css({
							margin: 0,
							maxWidth: "22ch",
							fontSize: "clamp(1.35rem, 3.2vw, 2rem)",
							fontWeight: 500,
							letterSpacing: "-0.02em",
							lineHeight: 1.2,
							color: "var(--apis-ink-soft)",
							textWrap: "balance",
						})}
					>
						{SITE_TAGLINE}
					</h1>
					<p
						mix={css({
							margin: 0,
							maxWidth: "42rem",
							fontSize: "1.05rem",
							color: "var(--apis-ink-soft)",
						})}
					>
						Install packages from npm for free. When an agent needs hosted execution — encode a QR,
						highlight source, parse a zone file — it pays per call with{" "}
						<a href="https://x402.org/" mix={linkMix}>
							x402
						</a>
						.
					</p>
					<div
						mix={css({
							display: "flex",
							flexWrap: "wrap",
							gap: "0.75rem",
							marginTop: "0.5rem",
						})}
					>
						<a href="#mcp" mix={ctaPrimaryMix}>
							Connect MCP
						</a>
						<a href="#catalog" mix={ctaSecondaryMix}>
							Browse operations
						</a>
						<a href="/v1" mix={ctaSecondaryMix}>
							JSON catalog
						</a>
					</div>
				</header>

				<main
					mix={css({
						display: "flex",
						flexDirection: "column",
						gap: "clamp(3rem, 8vw, 5.5rem)",
						padding: "0 clamp(1.5rem, 4vw, 3rem) clamp(3rem, 8vw, 5rem)",
						maxWidth: "56rem",
					})}
				>
					<section id="pay" mix={sectionMix} aria-labelledby="pay-heading">
						<h2 id="pay-heading" mix={sectionHeadingMix}>
							How charging works
						</h2>
						<p mix={sectionLeadMix}>
							Every priced call uses the{" "}
							<a href="https://x402.org/" mix={linkMix}>
								x402
							</a>{" "}
							protocol. No API keys, no accounts — a wallet settles USDC on the configured network.
						</p>
						<ol
							mix={css({
								margin: 0,
								padding: 0,
								listStyle: "none",
								display: "flex",
								flexDirection: "column",
								gap: "1rem",
								counterReset: "step",
							})}
						>
							{[
								"Call an operation or MCP tool without payment.",
								"The server answers HTTP 402 with a PAYMENT-REQUIRED header (amount, network, destination).",
								"Your client signs a payment and retries with PAYMENT-SIGNATURE.",
								"We verify and settle through a facilitator, then return the result with PAYMENT-RESPONSE.",
							].map((step) => (
								<li
									key={step}
									mix={css({
										display: "grid",
										gridTemplateColumns: "2.5rem 1fr",
										gap: "0.85rem",
										alignItems: "start",
										counterIncrement: "step",
										"&::before": {
											content: "counter(step)",
											display: "grid",
											placeItems: "center",
											width: "2.5rem",
											height: "2.5rem",
											borderRadius: "999px",
											background: "var(--apis-accent)",
											color: "var(--apis-accent-ink)",
											fontWeight: 600,
											fontVariantNumeric: "tabular-nums",
										},
									})}
								>
									<span>{step}</span>
								</li>
							))}
						</ol>
						<p
							mix={css({
								margin: "1.25rem 0 0",
								color: "var(--apis-ink-soft)",
								fontSize: "0.95rem",
							})}
						>
							<code mix={inlineCodeMix}>GET /</code>, <code mix={inlineCodeMix}>GET /v1</code>,{" "}
							<code mix={inlineCodeMix}>GET /health</code> and MCP discovery stay free. Only running
							an operation charges.
						</p>
					</section>

					<section id="mcp" mix={sectionMix} aria-labelledby="mcp-heading">
						<h2 id="mcp-heading" mix={sectionHeadingMix}>
							Connect over MCP
						</h2>
						<p mix={sectionLeadMix}>
							Point your agent at the Streamable HTTP endpoint. Tool names match the catalog ids, so{" "}
							<code mix={inlineCodeMix}>semver.satisfies</code> is the same on HTTP and MCP.
						</p>
						<p
							mix={css({
								margin: "0 0 0.5rem",
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.85rem",
								color: "var(--apis-ink-soft)",
							})}
						>
							Endpoint
						</p>
						<pre mix={preMix}>
							<code>{`${SITE_ORIGIN}/mcp`}</code>
						</pre>

						<p
							mix={css({
								margin: "1.5rem 0 0.5rem",
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.85rem",
								color: "var(--apis-ink-soft)",
							})}
						>
							Claude Code
						</p>
						<pre mix={preMix}>
							<code>{MCP_CLAUDE}</code>
						</pre>

						<p
							mix={css({
								margin: "1.5rem 0 0.5rem",
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.85rem",
								color: "var(--apis-ink-soft)",
							})}
						>
							Cursor / clients with an MCP config file
						</p>
						<pre mix={preMix}>
							<code>{MCP_JSON}</code>
						</pre>

						<p
							mix={css({
								margin: "1.5rem 0 0.5rem",
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.85rem",
								color: "var(--apis-ink-soft)",
							})}
						>
							Claude Desktop (HTTP bridge)
						</p>
						<pre mix={preMix}>
							<code>{MCP_BRIDGE_JSON}</code>
						</pre>

						<p
							mix={css({
								margin: "1.25rem 0 0",
								color: "var(--apis-ink-soft)",
								fontSize: "0.95rem",
							})}
						>
							Unpaid <code mix={inlineCodeMix}>tools/call</code> requests answer HTTP 402 with the
							same x402 headers as <code mix={inlineCodeMix}>POST /v1/…</code>. Your MCP client
							needs an x402-aware wallet or bridge to settle.
						</p>
					</section>

					<section id="catalog" mix={sectionMix} aria-labelledby="catalog-heading">
						<h2 id="catalog-heading" mix={sectionHeadingMix}>
							Operations
						</h2>
						<p mix={sectionLeadMix}>
							Each row wraps one published package. Prices are USDC atomic units (6 decimals) on the
							configured network.
						</p>
						<div
							mix={css({
								overflowX: "auto",
								borderTop: "1px solid var(--apis-line)",
								borderBottom: "1px solid var(--apis-line)",
							})}
						>
							<table
								mix={css({
									width: "100%",
									borderCollapse: "collapse",
									fontSize: "0.95rem",
									textAlign: "left",
								})}
							>
								<thead>
									<tr>
										<th mix={thMix}>Id</th>
										<th mix={thMix}>Package</th>
										<th mix={thMix}>Price</th>
									</tr>
								</thead>
								<tbody>
									{operations.map((operation) => (
										<tr key={operation.id}>
											<td mix={tdMix}>
												<code mix={inlineCodeMix}>{operation.id}</code>
												<div
													mix={css({
														marginTop: "0.35rem",
														color: "var(--apis-ink-soft)",
														fontSize: "0.85rem",
													})}
												>
													{operation.description}
												</div>
											</td>
											<td mix={tdMix}>
												<a
													href={`https://www.npmjs.com/package/${operation.package}`}
													mix={linkMix}
												>
													{operation.package}
												</a>
											</td>
											<td mix={tdMix}>
												<span mix={css({ fontVariantNumeric: "tabular-nums" })}>
													{operation.priceUsd}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>

					<section id="http" mix={sectionMix} aria-labelledby="http-heading">
						<h2 id="http-heading" mix={sectionHeadingMix}>
							Call over plain HTTP
						</h2>
						<p mix={sectionLeadMix}>
							<code mix={inlineCodeMix}>POST /v1/&lt;id&gt;</code> with a JSON body. Same prices and
							payment headers as MCP.
						</p>
						<pre mix={preMix}>
							<code>{HTTP_EXAMPLE}</code>
						</pre>
					</section>
				</main>

				<footer
					mix={css({
						padding: "2rem clamp(1.5rem, 4vw, 3rem) 3rem",
						borderTop: "1px solid var(--apis-line)",
						color: "var(--apis-ink-soft)",
						fontSize: "0.9rem",
						display: "flex",
						flexWrap: "wrap",
						gap: "1rem 1.5rem",
					})}
				>
					<span>Docs and packages stay free on npm and sdxc.dev.</span>
					<a href="https://sdxc.dev" mix={linkMix}>
						sdxc.dev
					</a>
					<a href="https://x402.org/" mix={linkMix}>
						x402.org
					</a>
					<a href="/v1" mix={linkMix}>
						/v1
					</a>
					<a href="/health" mix={linkMix}>
						/health
					</a>
				</footer>
			</div>
		);
	};
}

const linkMix = css({
	color: "var(--apis-accent-ink)",
	textDecoration: "underline",
	textUnderlineOffset: "0.15em",
	"&:hover": { color: "var(--apis-ink)" },
});

const ctaPrimaryMix = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "0.7rem 1.15rem",
	borderRadius: "0.35rem",
	background: "var(--apis-ink)",
	color: "var(--apis-paper)",
	fontWeight: 600,
	textDecoration: "none",
	transition: "transform 0.2s ease, background-color 0.2s ease",
	"&:hover": {
		background: "var(--apis-accent-ink)",
		transform: "translateY(-1px)",
	},
});

const ctaSecondaryMix = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "0.7rem 1.15rem",
	borderRadius: "0.35rem",
	border: "1px solid var(--apis-ink)",
	color: "var(--apis-ink)",
	fontWeight: 600,
	textDecoration: "none",
	background: "transparent",
	transition: "background-color 0.2s ease, transform 0.2s ease",
	"&:hover": {
		background: "color-mix(in oklch, var(--apis-accent) 25%, transparent)",
		transform: "translateY(-1px)",
	},
});

const sectionMix = css({
	display: "flex",
	flexDirection: "column",
	gap: "1rem",
	animation: "apis-rise 0.6s ease-out both",
	animationDelay: "0.08s",
});

const sectionHeadingMix = css({
	margin: 0,
	fontSize: "clamp(1.5rem, 3vw, 1.85rem)",
	fontWeight: 600,
	letterSpacing: "-0.03em",
});

const sectionLeadMix = css({
	margin: 0,
	maxWidth: "40rem",
	color: "var(--apis-ink-soft)",
	fontSize: "1.05rem",
});

const preMix = css({
	margin: 0,
	padding: "1rem 1.1rem",
	overflowX: "auto",
	background: "var(--apis-code-bg)",
	color: "var(--apis-code-fg)",
	fontFamily: "var(--ui-font-mono)",
	fontSize: "0.82rem",
	lineHeight: 1.55,
	borderRadius: "0.35rem",
});

const inlineCodeMix = css({
	fontFamily: "var(--ui-font-mono)",
	fontSize: "0.88em",
	padding: "0.1em 0.35em",
	borderRadius: "0.25rem",
	background: "color-mix(in oklch, var(--apis-accent) 18%, var(--apis-paper))",
});

const thMix = css({
	padding: "0.75rem 0.85rem 0.75rem 0",
	borderBottom: "1px solid var(--apis-line)",
	fontSize: "0.8rem",
	fontWeight: 600,
	textTransform: "uppercase",
	letterSpacing: "0.04em",
	color: "var(--apis-ink-soft)",
});

const tdMix = css({
	padding: "1rem 0.85rem 1rem 0",
	borderBottom: "1px solid var(--apis-line)",
	verticalAlign: "top",
});
