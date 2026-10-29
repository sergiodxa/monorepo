/**
 * Marketing landing for api.sdxc.dev: brand hero, x402 charging, MCP setup and
 * the priced operation catalog, composed from `@sdxc/ui` marketing primitives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flexWrap, gap, hstack, vstack } from "@sdxc/u/layout";
import { mbs, pb, pi } from "@sdxc/u/size";
import { font, nowrap, text, weight } from "@sdxc/u/typography";
import { HeadingScope, Link, LinkButton, MarketingHeader, MarketingSection, Table } from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	CheckList,
	CheckRow,
	ClosingCta,
	CodeStage,
	FeatureBand,
	LandingHero,
	StepList,
	TabbedStage,
} from "@sdxc/ui/patterns";

import type { Operation } from "~/config/catalog";

import { SITE_BRAND, SITE_ORIGIN, SITE_TAGLINE } from "~/config/site";

namespace HomeView {
	export interface Props {
		/** Priced operations from the catalog. */
		operations: readonly Operation[];
	}
}

/**
 * Cursor / Claude Desktop: first-party mcp-bridge with the operator Bearer so
 * priced tools/call skips x402 when OWNER_ACCESS_TOKEN is presented.
 */
const MCP_BRIDGE_JSON = `{
  "mcpServers": {
    "sdxc-api": {
      "command": "npx",
      "args": [
        "-y",
        "@sdxc/mcp@latest",
        "${SITE_ORIGIN}/mcp",
        "--token",
        "\${SDXC_API_OWNER_TOKEN}"
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
        "${SITE_ORIGIN}/mcp",
        "--token",
        "\${SDXC_API_OWNER_TOKEN}"
      ]
    }
  }
}`;

/** Stdio smoke from a shell. */
const MCP_BRIDGE_SHELL = `export SDXC_API_OWNER_TOKEN='owner_…'  # Worker secret OWNER_ACCESS_TOKEN
npx -y @sdxc/mcp@latest ${SITE_ORIGIN}/mcp --token "$SDXC_API_OWNER_TOKEN"`;

/** Example unpaid → paid HTTP exchange. */
const HTTP_EXAMPLE = `# 1. Challenge
curl -i -X POST ${SITE_ORIGIN}/v1/semver.satisfies \\
  -H 'content-type: application/json' \\
  -d '{"version":"1.2.3","comparison":"^","against":"1.0.0"}'
# → 402 + PAYMENT-REQUIRED

# 2. Retry with PAYMENT-SIGNATURE from your x402 wallet
# → 200 + PAYMENT-RESPONSE + JSON result`;

/** Numbered charging steps shown in the how-it-works band. */
const CHARGE_STEPS: ReadonlyArray<{ title: string; body: string }> = [
	{
		title: "Call unpaid",
		body: "Hit an operation or MCP tool without a payment signature.",
	},
	{
		title: "Read the 402",
		body: "The server answers HTTP 402 with PAYMENT-REQUIRED (amount, network, destination).",
	},
	{
		title: "Sign and retry",
		body: "Your client signs a payment and retries with PAYMENT-SIGNATURE.",
	},
	{
		title: "Settle and run",
		body: "We verify through a facilitator, then return the result with PAYMENT-RESPONSE.",
	},
];

/** Mono chip for inline path and flag names inside marketing copy. */
const CODE_CHIP = [font("mono"), text("sm"), rounded("sm"), bg("brand.tint"), pb(0.5), pi(1)];

/**
 * Renders the landing composition: hero, charging, MCP, catalog, HTTP.
 */
export default function HomeView(handle: Handle<HomeView.Props>) {
	return () => {
		let { operations } = handle.props;

		return (
			<>
				<LandingHero
					tone="grid"
					mix={[viewReveal()]}
					title={SITE_BRAND}
					description={
						<>
							{SITE_TAGLINE} Install packages from npm for free. When an agent needs hosted
							execution — encode a QR, highlight source, parse a zone file — it pays per call with{" "}
							<Link href="https://x402.org/">x402</Link>.
						</>
					}
					actions={
						<>
							<LinkButton href="#mcp" color="brand" size="lg">
								Connect MCP
							</LinkButton>
							<LinkButton href="#catalog" color="neutral" variant="outline" size="lg">
								Browse operations
							</LinkButton>
							<LinkButton href="/v1" color="neutral" variant="outline" size="lg">
								JSON catalog
							</LinkButton>
						</>
					}
				/>

				<FeatureBand
					id="pay"
					layout="steps"
					tone="tinted"
					eyebrow="x402"
					eyebrowVariant="mono"
					title="How charging works"
					description={
						<>
							Every priced call uses the <Link href="https://x402.org/">x402</Link> protocol. No API
							keys, no accounts — a wallet settles USDC on the configured network. Discovery stays
							free; only running an operation charges.
						</>
					}
					mix={[viewReveal()]}
				>
					{CHARGE_STEPS.map((step) => (
						<StepList.Item key={step.title} title={step.title}>
							{step.body}
						</StepList.Item>
					))}
				</FeatureBand>

				<MarketingSection spacing="compact" mix={[viewReveal()]}>
					<CheckList orientation="horizontal">
						<CheckRow>
							<code mix={CODE_CHIP}>GET /</code> free
						</CheckRow>
						<CheckRow>
							<code mix={CODE_CHIP}>GET /v1</code> free
						</CheckRow>
						<CheckRow>
							<code mix={CODE_CHIP}>GET /health</code> free
						</CheckRow>
						<CheckRow>MCP discovery free</CheckRow>
					</CheckList>
				</MarketingSection>

				<MarketingSection id="mcp" mix={[viewReveal()]}>
					<HeadingScope>
						<MarketingHeader
							eyebrow="MCP"
							eyebrowVariant="mono"
							description={
								<>
									Handshake-era agents (Cursor, Claude Desktop) speak an older MCP revision. Point{" "}
									<code mix={CODE_CHIP}>mcp-bridge</code> from{" "}
									<Link href="https://www.npmjs.com/package/@sdxc/mcp">@sdxc/mcp</Link> at the
									Streamable HTTP endpoint and pass <code mix={CODE_CHIP}>OWNER_ACCESS_TOKEN</code>{" "}
									so priced <code mix={CODE_CHIP}>tools/call</code> skips x402. Tool names match the
									catalog ids.
								</>
							}
						>
							Connect over MCP
						</MarketingHeader>

						<div mix={[vstack({ gap: 6, align: "stretch" })]}>
							<CodeStage variant="terminal" title="Endpoint">
								{`${SITE_ORIGIN}/mcp`}
							</CodeStage>

							<CodeStage variant="terminal" title="Shell">
								{MCP_BRIDGE_SHELL}
							</CodeStage>

							<TabbedStage name="mcp-client" aria-label="Cursor / Claude Desktop config">
								<TabbedStage.Item value="npx" label="npx" defaultChecked>
									<CodeStage title="mcp.json">{MCP_BRIDGE_JSON}</CodeStage>
								</TabbedStage.Item>
								<TabbedStage.Item value="bunx" label="bunx">
									<CodeStage title="mcp.json">{MCP_BRIDGE_BUN_JSON}</CodeStage>
								</TabbedStage.Item>
							</TabbedStage>

							<p mix={[mbs(2), text("sm")]}>
								<code mix={CODE_CHIP}>--token</code> sends{" "}
								<code mix={CODE_CHIP}>Authorization: Bearer …</code>. Without it, unpaid{" "}
								<code mix={CODE_CHIP}>tools/call</code> answers HTTP 402 with the same x402 headers
								as <code mix={CODE_CHIP}>POST /v1/…</code> and needs a wallet to settle.
							</p>
						</div>
					</HeadingScope>
				</MarketingSection>

				<MarketingSection id="catalog" tone="tinted" ruled mix={[viewReveal()]}>
					<HeadingScope>
						<MarketingHeader
							eyebrow="Catalog"
							eyebrowVariant="mono"
							description="Each row wraps one published package. Prices are USDC atomic units (6 decimals) on the configured network."
						>
							Operations
						</MarketingHeader>

						<Table.Container>
							<Table aria-label="Priced operations">
								<Table.Header>
									<Table.Row>
										<Table.Column>Id</Table.Column>
										<Table.Column>Package</Table.Column>
										<Table.Column numeric>Price</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{operations.map((operation) => (
										<Table.Row key={operation.id}>
											<Table.Cell>
												<div mix={[vstack({ gap: 1, align: "stretch" })]}>
													<code mix={[font("mono"), text("sm"), weight("medium")]}>
														{operation.id}
													</code>
													<span mix={[text("sm")]}>{operation.description}</span>
												</div>
											</Table.Cell>
											<Table.Cell>
												<Link
													href={`https://www.npmjs.com/package/${operation.package}`}
													mix={[font("mono"), text("sm"), nowrap()]}
												>
													{operation.package}
												</Link>
											</Table.Cell>
											<Table.Cell numeric>{operation.priceUsd}</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						</Table.Container>
					</HeadingScope>
				</MarketingSection>

				<MarketingSection id="http" mix={[viewReveal()]}>
					<HeadingScope>
						<MarketingHeader
							eyebrow="HTTP"
							eyebrowVariant="mono"
							description={
								<>
									<code mix={CODE_CHIP}>POST /v1/&lt;id&gt;</code> with a JSON body. Same prices and
									payment headers as MCP.
								</>
							}
						>
							Call over plain HTTP
						</MarketingHeader>

						<CodeStage variant="terminal" title="curl">
							{HTTP_EXAMPLE}
						</CodeStage>
					</HeadingScope>
				</MarketingSection>

				<ClosingCta
					tone="plain"
					ruled
					title="Docs and packages stay free"
					description="Install from npm and read guides on sdxc.dev. Agents settle only when they run a hosted operation."
					actions={
						<div mix={[hstack(), flexWrap(), gap(4)]}>
							<Link href="https://sdxc.dev">sdxc.dev</Link>
							<Link href="https://x402.org/">x402.org</Link>
							<Link href="/v1">/v1</Link>
							<Link href="/health">/health</Link>
						</div>
					}
					mix={[viewReveal()]}
				/>
			</>
		);
	};
}
