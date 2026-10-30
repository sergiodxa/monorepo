/**
 * Every band of the Keel page, from the hero to the closing call. The chapters stack as
 * ruled columns with registration marks, numbered in mono, and two near-black inset
 * panels (the workflow and the closing call) break the column at the page's turning points.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	ArrowRightIcon,
	ChevronDownIcon,
	FileTextIcon,
	FlaskConicalIcon,
	GlobeIcon,
	KeyRoundIcon,
	LockIcon,
	ShieldCheckIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { font, text } from "@sdxc/u/typography";
import {
	Accordion,
	Badge,
	Feature,
	HeadingScope,
	LinkButton,
	LogoCloud,
	MarketingHeader,
	Split,
	StatStrip,
} from "@sdxc/ui";
import {
	Bento,
	ChangelogStrip,
	CheckList,
	CheckRow,
	ClosingCta,
	CodeStage,
	Crosshair,
	FaqBand,
	FeatureBand,
	LandingHero,
	PricingBand,
	ProductFrame,
	Rails,
	SegmentedStage,
	TabbedStage,
	TestimonialBand,
} from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import {
	CurrencyScene,
	PortalScene,
	RecognitionScene,
	TaxScene,
	WebhookScene,
} from "~/resources/views/demos/saas/bento-media";
import { CUSTOMERS, CustomerMark } from "~/resources/views/demos/saas/marks";
import {
	InvoicePanel,
	MetersPanel,
	PricePanel,
	RecoveryPanel,
} from "~/resources/views/demos/saas/product-panels";
import { RevenueBoard } from "~/resources/views/demos/saas/revenue-board";

/** One usage event sent from a Node request handler. */
const TRACK_USAGE_TS = `import { Keel } from "@keel/node";

let keel = new Keel(env.KEEL_SECRET);

await keel.events.send({
	customer: "cus_orbitkit",
	meter: "api_requests",
	value: 1,
	idempotencyKey: request.id,
});`;

/** The same event from a Python worker. */
const TRACK_USAGE_PY = `from keel import Keel

keel = Keel(os.environ["KEEL_SECRET"])

keel.events.send(
    customer="cus_orbitkit",
    meter="api_requests",
    value=1,
    idempotency_key=request.id,
)`;

/** The same event over plain HTTP, for any other runtime. */
const TRACK_USAGE_SH = `curl https://api.keel.dev/v1/events \\
  -H "Authorization: Bearer $KEEL_SECRET" \\
  -H "Idempotency-Key: req_8f2c41" \\
  -d customer=cus_orbitkit \\
  -d meter=api_requests \\
  -d value=1`;

/** The releases the changelog lists, newest first. */
const RELEASES = [
	{
		dateTime: "2026-10-28",
		date: "Oct 28, 2026",
		title: "Spend alerts on every plan",
		body: "Warn customers at 80% of their commitment and again at 100%.",
	},
	{
		dateTime: "2026-10-14",
		date: "Oct 14, 2026",
		title: "Replay a month in the sandbox",
		body: "Diff every invoice a draft plan would change before you ship it.",
	},
	{
		dateTime: "2026-09-30",
		date: "Sep 30, 2026",
		title: "Unique-count meters",
		body: "Bill per active seat, device or project, counted once a period.",
	},
	{
		dateTime: "2026-09-16",
		date: "Sep 16, 2026",
		title: "Credit notes over the API",
		body: "Issue and void credit notes, each tied to the line it corrects.",
	},
] as const;

/** The four testimonials under the featured one, two by two: name, job title, initials and quote. */
const QUOTES = [
	{
		name: "Tomás Ibarra",
		jobTitle: "Staff Engineer, Parcelbase",
		initials: "TI",
		quote: (
			<>
				Our homegrown billing service was three cron jobs and a prayer. We replaced it with one
				event call per request and <strong>deleted 14,000 lines</strong>.
			</>
		),
	},
	{
		name: "Hannah Lindqvist",
		jobTitle: "VP Revenue, Sundial",
		initials: "HL",
		quote: (
			<>
				Moving from seats to usage pricing used to be a quarter-long project. We ran both models
				side by side for a month and <strong>switched with a toggle</strong>.
			</>
		),
	},
	{
		name: "Kenji Watanabe",
		jobTitle: "CTO, Hatchway",
		initials: "KW",
		quote: (
			<>
				The sandbox replays real traffic against a draft plan. We priced our new tier off{" "}
				<strong>actual data</strong>, not a spreadsheet guess.
			</>
		),
	},
	{
		name: "Priya Raman",
		jobTitle: "Billing Operations, Tessera",
		initials: "PR",
		quote: (
			<>
				Recovery emails go out on each customer's payday. Failed payments dropped by a third, and{" "}
				<strong>nobody on my team chases cards</strong> anymore.
			</>
		),
	},
] as const;

/** Each question and its two-to-three-sentence answer, split across the two columns. */
const QUESTIONS = [
	[
		[
			"How is Keel priced?",
			"Starter is free until you bill $10,000 a month through Keel. Growth adds 0.5% of billed revenue over that, and Scale is an annual contract with volume pricing.",
		],
		[
			"Do we need to replace our payment processor?",
			"No. Keel prices and invoices, then charges through the processor you already use. Your customers, cards and payouts stay where they are.",
		],
		[
			"What happens to an event that arrives late?",
			"It lands in the period its timestamp names. If that invoice has already gone out, Keel adds the difference to the next one as a dated adjustment.",
		],
	],
	[
		[
			"Can we migrate customers mid-contract?",
			"Yes. Keel prorates the old plan to the day and starts the new one on the switch date. The customer sees both on one invoice with a line for each.",
		],
		[
			"How long does an integration take?",
			"Most teams send their first events the day they sign up and invoice live customers within three weeks. The sandbox replays production traffic, so you test plans before anyone is billed.",
		],
		[
			"Where is our data stored?",
			"In the United States or the European Union, chosen per workspace. Events are encrypted at rest and kept for seven years to satisfy revenue audits.",
		],
	],
] as const;

/**
 * The opening band: the claim set flush left over a stage that switches between the
 * dashboard, the meters and the API call, pinned at its corners like a drawing. The
 * release pin under the actions links the newest changelog entry.
 *
 * @returns The render function producing the hero.
 */
export function HeroSection() {
	return () => (
		<LandingHero
			align="start"
			mediaPlacement="below"
			tone="grid"
			entrance
			title="Turn API usage into paid invoices"
			description={
				<>
					Keel meters every event your product emits, prices it on any plan you can describe and
					sends the invoice on the first of the month, so{" "}
					<strong>finance closes without asking engineering</strong>.
				</>
			}
			actions={
				<>
					<LinkButton href="#start" color="brand" mix={[marketingCtaChrome()]}>
						Start free
					</LinkButton>
					<LinkButton href="#product" variant="surface" mix={[marketingCtaChrome()]}>
						Read the quickstart
					</LinkButton>
				</>
			}
			release={<a href="#changelog">v4.2 · Spend alerts, Oct 28</a>}
			media={
				<div mix={[raw({ position: "relative" })]}>
					<SegmentedStage name="keel-hero-views" aria-label="Keel product views" align="start">
						<SegmentedStage.Item value="revenue" label="Revenue" defaultChecked>
							<ProductFrame lights title="Revenue" url="app.keel.dev">
								<RevenueBoard />
							</ProductFrame>
						</SegmentedStage.Item>
						<SegmentedStage.Item value="meters" label="Meters">
							<MetersPanel />
						</SegmentedStage.Item>
						<SegmentedStage.Item value="api" label="API">
							<CodeStage variant="slab" title="track-usage.ts" language="ts" lineNumbers>
								{TRACK_USAGE_TS}
							</CodeStage>
						</SegmentedStage.Item>
					</SegmentedStage>
					<Crosshair corner="end-start" size="md" />
					<Crosshair corner="end-end" size="md" />
				</div>
			}
		/>
	);
}

/**
 * The customers: six marks in a ruled grid, the first column of the page's rails.
 *
 * @returns The render function producing the strip.
 */
export function CustomersStrip() {
	return () => (
		<Rails ruled marks="corners" spacing="compact">
			<LogoCloud layout="ruled" label="Billing for API-first companies like" muted>
				{CUSTOMERS.map((customer) => (
					<CustomerMark key={customer.name} name={customer.name} glyph={customer.glyph} />
				))}
			</LogoCloud>
		</Rails>
	);
}

/**
 * Chapter 01, metering: the claim and its guarantees beside the one call that sends an
 * event, in three languages, since the integration is the first thing an engineer asks about.
 *
 * @returns The render function producing the chapter.
 */
export function MeteringChapter() {
	return () => (
		<Rails id="product" ruled marks="corners">
			<HeadingScope level={2}>
				<Split>
					<Split.Copy>
						<MarketingHeader
							mix={[raw({ "--ui-marketing-header-end": "2rem" })]}
							eyebrow="01 / Metering"
							description={
								<>
									One call per event, from any language. Keel{" "}
									<strong>deduplicates, aggregates and keeps every event</strong> for seven years,
									so each invoice line traces back to the requests behind it.
								</>
							}
						>
							Send events, Keel does the math
						</MarketingHeader>
						<CheckList>
							<CheckRow>Idempotency keys drop retried events</CheckRow>
							<CheckRow>Count, sum, max or unique per meter</CheckRow>
							<CheckRow>Backfill a month without double billing</CheckRow>
						</CheckList>
					</Split.Copy>
					<Split.Media>
						<CodeStage
							variant="code"
							lineNumbers
							name="keel-track-usage"
							tabs={[
								{ label: "node.ts", content: TRACK_USAGE_TS, language: "ts" },
								{ label: "worker.py", content: TRACK_USAGE_PY, language: "py" },
								{ label: "curl.sh", content: TRACK_USAGE_SH, language: "sh" },
							]}
						/>
					</Split.Media>
				</Split>
			</HeadingScope>
		</Rails>
	);
}

/**
 * Four figures about what runs through Keel, set at display size in the ruled column.
 *
 * @returns The render function producing the strip.
 */
export function FiguresStrip() {
	return () => (
		<Rails ruled marks="corners" spacing="compact">
			<StatStrip size="display" variant="gap">
				<StatStrip.Item label="Billed through Keel last year">$2.4B</StatStrip.Item>
				<StatStrip.Item label="Usage events metered each month">41B</StatStrip.Item>
				<StatStrip.Item label="Median days from contract to first invoice">18</StatStrip.Item>
				<StatStrip.Item label="Fewer failed payments after recovery">37%</StatStrip.Item>
			</StatStrip>
		</Rails>
	);
}

/**
 * Chapter 02, the workflow: a vertical stage on a near-black inset panel, one product
 * screen per step of a billing month, switched by native radios.
 *
 * @returns The render function producing the band.
 */
export function WorkflowBand() {
	return () => (
		<FeatureBand
			id="workflow"
			layout="stage"
			tone="inverse"
			inset
			eyebrow="02 / Workflow"
			title="From raw events to paid invoices"
			description={
				<>
					Four steps run on their own every month, and you can inspect each one{" "}
					<strong>before a customer sees it</strong>.
				</>
			}
			stageLabel="A billing month in Keel"
		>
			<TabbedStage.Item
				value="meter"
				label="Meter the usage"
				description="Events stream into meters that count, sum or take the peak, per customer and per day."
				defaultChecked
			>
				<MetersPanel />
			</TabbedStage.Item>
			<TabbedStage.Item
				value="price"
				label="Price it on any plan"
				description={
					<>
						Flat, tiered, graduated or committed spend with overages. Preview a plan on{" "}
						<strong>last month's real usage</strong> before you publish it.
					</>
				}
			>
				<PricePanel />
			</TabbedStage.Item>
			<TabbedStage.Item
				value="invoice"
				label="Send the invoice"
				description="Invoices finalize on the first with tax, currency and every line itemized, then go out by email and API."
			>
				<InvoicePanel />
			</TabbedStage.Item>
			<TabbedStage.Item
				value="collect"
				label="Collect what's owed"
				description="A declined card retries on the customer's payday and sends one reminder, never a flood."
			>
				<RecoveryPanel />
			</TabbedStage.Item>
		</FeatureBand>
	);
}

/**
 * Chapter 03, the platform: a split chapter header over five bento cells, each led by a
 * product scene. Five cells over three columns leave the last one spanning two.
 *
 * @returns The render function producing the chapter.
 */
export function PlatformChapter() {
	return () => (
		<Rails id="platform" ruled marks="corners">
			<HeadingScope level={2}>
				<MarketingHeader
					layout="split"
					eyebrow="03 / Platform"
					description={
						<>
							The parts of billing nobody wants to build twice,{" "}
							<strong>shipped and maintained</strong> so your team works on the product.
						</>
					}
				>
					Everything after the meter
				</MarketingHeader>
				<Bento columns={3}>
					<Bento.Cell>
						<Bento.Media>
							<PortalScene />
						</Bento.Media>
						<Bento.Title>A portal customers run</Bento.Title>
						<Bento.Body>
							Customers check usage, change plans and download invoices on a page with{" "}
							<strong>your logo and domain</strong>.
						</Bento.Body>
					</Bento.Cell>
					<Bento.Cell>
						<Bento.Media>
							<TaxScene />
						</Bento.Media>
						<Bento.Title>Tax in 60 countries</Bento.Title>
						<Bento.Body>
							Rates follow the customer's address and update when the law does, with{" "}
							<strong>filing-ready reports</strong> each quarter.
						</Bento.Body>
					</Bento.Cell>
					<Bento.Cell>
						<Bento.Media>
							<CurrencyScene />
						</Bento.Media>
						<Bento.Title>Prices in 135 currencies</Bento.Title>
						<Bento.Body>
							Set a price per currency or convert at the day's rate, and{" "}
							<strong>settle in the one you report in</strong>.
						</Bento.Body>
					</Bento.Cell>
					<Bento.Cell>
						<Bento.Media>
							<WebhookScene />
						</Bento.Media>
						<Bento.Title>Webhooks for every change</Bento.Title>
						<Bento.Body>
							Signed deliveries with retries for 72 hours, and a log to{" "}
							<strong>replay any event</strong>.
						</Bento.Body>
					</Bento.Cell>
					<Bento.Cell>
						<Bento.Media>
							<RecognitionScene />
						</Bento.Media>
						<Bento.Title size="lg">Revenue recognition, built in</Bento.Title>
						<Bento.Body>
							Annual contracts and prepaid credits recognize day by day, so the ledger your auditor
							reads <strong>matches the invoices to the cent</strong>.
						</Bento.Body>
					</Bento.Cell>
				</Bento>
			</HeadingScope>
		</Rails>
	);
}

/**
 * Chapter 04, security: six controls a procurement review asks about, as an un-carded
 * icon list, so the chapter reads as a specification rather than a wall of cards.
 *
 * @returns The render function producing the chapter.
 */
export function SecurityChapter() {
	return () => (
		<Rails id="security" ruled marks="corners">
			<HeadingScope level={2}>
				<MarketingHeader
					eyebrow="04 / Security"
					description={
						<>
							Billing data is financial data. Keel is held to the same controls as{" "}
							<strong>the ledger it feeds</strong>.
						</>
					}
				>
					Built to pass your audit
				</MarketingHeader>
				<Feature.Grid variant="list" columns={3}>
					<Feature>
						<Feature.Icon>
							<ShieldCheckIcon />
						</Feature.Icon>
						<Feature.Title>SOC 2 Type II</Feature.Title>
						<Feature.Description>
							Audited every year, with the report and a bridge letter <strong>on request</strong>.
						</Feature.Description>
					</Feature>
					<Feature>
						<Feature.Icon>
							<LockIcon />
						</Feature.Icon>
						<Feature.Title>SSO and SCIM</Feature.Title>
						<Feature.Description>
							Sign in through your identity provider and remove access the moment someone leaves.
						</Feature.Description>
					</Feature>
					<Feature>
						<Feature.Icon>
							<FileTextIcon />
						</Feature.Icon>
						<Feature.Title>Audit log</Feature.Title>
						<Feature.Description>
							Every price change, credit and refund records <strong>who made it and why</strong>.
						</Feature.Description>
					</Feature>
					<Feature>
						<Feature.Icon>
							<KeyRoundIcon />
						</Feature.Icon>
						<Feature.Title>Scoped API keys</Feature.Title>
						<Feature.Description>
							Give a service the right to send events and nothing else, and rotate keys without
							downtime.
						</Feature.Description>
					</Feature>
					<Feature>
						<Feature.Icon>
							<FlaskConicalIcon />
						</Feature.Icon>
						<Feature.Title>Sandbox workspaces</Feature.Title>
						<Feature.Description>
							Replay production traffic against a draft plan, with{" "}
							<strong>no customer billed</strong>
						</Feature.Description>
					</Feature>
					<Feature>
						<Feature.Icon>
							<GlobeIcon />
						</Feature.Icon>
						<Feature.Title>Data residency</Feature.Title>
						<Feature.Description>
							Keep each workspace's events in the United States or the European Union.
						</Feature.Description>
					</Feature>
				</Feature.Grid>
			</HeadingScope>
		</Rails>
	);
}

/**
 * The changelog: the four latest releases on one dated rule, closing the ruled column,
 * since a billing product's pace of releases is part of what a buyer weighs.
 *
 * @returns The render function producing the strip.
 */
export function ChangelogSection() {
	return () => (
		<Rails id="changelog" ruled marks="corners">
			<HeadingScope level={2}>
				<ChangelogStrip
					title="Changelog"
					action={
						<a
							href="#changelog"
							mix={[hstack({ gap: 1.5, align: "center" }), font("mono"), text("sm")]}
						>
							All releases
							<ArrowRightIcon
								aria-hidden="true"
								mix={[raw({ inlineSize: "1em", blockSize: "1em" })]}
							/>
						</a>
					}
				>
					{RELEASES.map((release) => (
						<ChangelogStrip.Entry
							key={release.dateTime}
							dateTime={release.dateTime}
							date={release.date}
							title={release.title}
						>
							{release.body}
						</ChangelogStrip.Entry>
					))}
				</ChangelogStrip>
			</HeadingScope>
		</Rails>
	);
}

/**
 * The customers band: one featured story with its mark and a link, then four short
 * quotes in two columns, so every row is full at every width.
 *
 * @returns The render function producing the band.
 */
export function TestimonialSection() {
	return () => (
		<TestimonialBand
			id="customers"
			tone="tinted"
			columns={2}
			eyebrow="05 / Customers"
			title="Finance and engineering agree"
			description="Teams that bill for usage moved off homegrown billing, and nobody asked to go back."
			featured={
				<TestimonialBand.Quote
					variant="featured"
					name="Amara Okafor"
					jobTitle="Head of Finance, Orbitkit"
					avatar="AO"
					logo={<CustomerMark name="Orbitkit" glyph="orbit" />}
					href="#customers"
					linkLabel="Read the Orbitkit story"
				>
					We closed October in two days instead of nine. Every invoice line links back to the
					requests behind it, so <strong>audit questions take minutes</strong> now.
				</TestimonialBand.Quote>
			}
		>
			{QUOTES.map((quote) => (
				<TestimonialBand.Quote
					key={quote.name}
					name={quote.name}
					jobTitle={quote.jobTitle}
					avatar={quote.initials}
				>
					{quote.quote}
				</TestimonialBand.Quote>
			))}
		</TestimonialBand>
	);
}

/**
 * The pricing band: three plans with the middle one featured, priced on what a
 * customer bills rather than on seats.
 *
 * @returns The render function producing the band.
 */
export function PricingSection() {
	return () => (
		<PricingBand
			id="pricing"
			eyebrow="06 / Pricing"
			title="Pay as your revenue grows"
			description={
				<>
					Every plan meters without limits. You pay a share of <strong>what Keel bills</strong>,
					never for seats.
				</>
			}
		>
			<PricingBand.Plan
				name="Starter"
				price="$0"
				period="/month"
				description="For a first usage-priced product, until it bills $10k a month."
				features={
					<>
						<CheckRow>Unlimited events and meters</CheckRow>
						<CheckRow>Tiered and graduated pricing</CheckRow>
						<CheckRow>Invoices in 135 currencies</CheckRow>
						<CheckRow>Sandbox workspace</CheckRow>
					</>
				}
				action={
					<LinkButton href="#start" variant="surface">
						Start free
					</LinkButton>
				}
			/>
			<PricingBand.Plan
				name="Growth"
				price="0.5%"
				period="of billed revenue"
				featured
				badge={<Badge color="brand">Most popular</Badge>}
				description="For a team selling usage plans to hundreds of customers."
				features={
					<>
						<CheckRow>Everything in Starter</CheckRow>
						<CheckRow>Customer portal on your domain</CheckRow>
						<CheckRow>Tax in 60 countries</CheckRow>
						<CheckRow>Payday-aware payment recovery</CheckRow>
						<CheckRow>SSO and audit log</CheckRow>
					</>
				}
				action={
					<LinkButton href="#start" color="brand">
						Start a 30-day trial
					</LinkButton>
				}
			/>
			<PricingBand.Plan
				name="Scale"
				price="Custom"
				description="For companies billing millions a month on committed contracts."
				features={
					<>
						<CheckRow>Everything in Growth</CheckRow>
						<CheckRow>Volume pricing on billed revenue</CheckRow>
						<CheckRow>Revenue recognition</CheckRow>
						<CheckRow>EU or US data residency</CheckRow>
						<CheckRow>A named billing engineer</CheckRow>
					</>
				}
				action={
					<LinkButton href="#start" variant="surface">
						Talk to sales
					</LinkButton>
				}
			/>
		</PricingBand>
	);
}

/**
 * The questions band: six answers in two accordion columns, every item sharing one
 * name so opening a question closes the one before.
 *
 * @returns The render function producing the band.
 */
export function FaqSection() {
	return () => (
		<FaqBand
			id="faq"
			ruled
			columns={2}
			eyebrow="07 / FAQ"
			title="Questions, answered"
			description="What finance and engineering teams ask before they move billing to Keel."
		>
			{QUESTIONS.map((column, index) => (
				<Accordion key={index}>
					{column.map(([question, answer]) => (
						<Accordion.Item key={question} name="keel-faq">
							<Accordion.Trigger>
								{question}
								<ChevronDownIcon data-slot="icon" aria-hidden="true" />
							</Accordion.Trigger>
							<Accordion.Content>
								<p>{answer}</p>
							</Accordion.Content>
						</Accordion.Item>
					))}
				</Accordion>
			))}
		</FaqBand>
	);
}

/**
 * The closing call on a near-black inset panel, echoing the workflow band: one sentence
 * of promise, the primary action and a quieter route to sales.
 *
 * @returns The render function producing the band.
 */
export function ClosingBand() {
	return () => (
		<ClosingCta
			id="start"
			tone="inverse"
			inset
			title="Ship usage pricing this sprint"
			description="Send your first event in ten minutes and invoice real customers when you are ready. Starter is free until you bill $10k a month."
			actions={
				<>
					<LinkButton href="#top" color="brand" mix={[marketingCtaChrome()]}>
						Start free
					</LinkButton>
					<LinkButton href="#faq" variant="surface" mix={[marketingCtaChrome()]}>
						Talk to sales
					</LinkButton>
				</>
			}
		/>
	);
}
