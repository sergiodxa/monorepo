/**
 * The last bands before the footer: notes from the neighbourhood, the questions people ask at
 * the counter, and the closing call back to the pickup order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ChevronDownIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Accordion, LinkButton } from "@sdxc/ui";
import { ClosingCta, FaqBand, TestimonialBand } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import { PHONE } from "~/resources/views/demos/bakery/site-chrome";
import { renderNearView } from "~/resources/views/demos/near-view";

/** What neighbours say: the first leads large, the rest fill the row in order. */
const NOTES = [
	{
		name: "Dolores Okafor",
		where: "Two doors down, since 2009",
		initials: "DO",
		hue: 30,
		quote: (
			<>
				I set my alarm by the smell. When Rosa's first loaves come out at seven, the whole street
				knows it, and <strong>I'm always third in the queue</strong>.
			</>
		),
	},
	{
		name: "Ben Whitlock",
		where: "Comes in on his wheelchair most mornings",
		initials: "BW",
		hue: 210,
		quote: (
			<>
				The front door opens on its own and there's a table I fit under.{" "}
				<strong>Small things, but nobody else on Alder has them.</strong>
			</>
		),
	},
	{
		name: "Priya and Sam",
		where: "Ordered their wedding cake here",
		initials: "PS",
		hue: 340,
		quote: <>Three tiers of lemon and raspberry. Guests still ask where it came from.</>,
	},
	{
		name: "Mr. Alvarez",
		where: "Retired teacher, Pine Street",
		initials: "MA",
		hue: 140,
		quote: (
			<>
				I order a rye for Saturday every Thursday. <strong>It has never once sold out on me</strong>
				.
			</>
		),
	},
	{
		name: "Hana Kim",
		where: "Runs the bookshop on 3rd",
		initials: "HK",
		hue: 260,
		quote: <>The cardamom buns are the reason my Tuesday shift starts happy.</>,
	},
	{
		name: "The Garcia family",
		where: "Sunday regulars with a dog called Biscuit",
		initials: "GF",
		hue: 70,
		quote: <>Biscuit gets a water bowl and a scratch behind the ears. We get morning buns.</>,
	},
] as const;

/** Questions asked at the counter, split into the two accordion columns. */
const QUESTIONS = [
	[
		[
			"Do you have anything gluten-free?",
			"Yes: a buckwheat and millet loaf and a flourless chocolate cake, baked on their own day in their own tins. Our kitchen still uses wheat, so we can't promise it's free of traces.",
		],
		[
			"Can I order a birthday cake?",
			"Please do, three days ahead. Pick a flavour at the counter or on the phone, tell us the name to write, and collect it any day we're open.",
		],
		[
			"What time do things sell out?",
			"Croissants usually go by eleven and sourdough by two on Saturdays. Ordering for pickup is the only way to be sure.",
		],
	],
	[
		[
			"Do you take cards?",
			"Cards, phones and cash, all welcome. There's no minimum, so a single cookie on a card is fine.",
		],
		[
			"Can I bring my dog?",
			"Assistance dogs are welcome inside. Every other dog is welcome on the porch, where there's a water bowl and, on a good day, a broken biscuit.",
		],
		[
			"Is there somewhere to sit?",
			"Six tables inside and two on the porch, with free refills of filter coffee while you're sitting with us.",
		],
	],
] as const;

/**
 * A neighbour's initials on a pastel disc in their own hue, with deep ink of the same hue so
 * the letters stay legible.
 *
 * @param handle Runtime handle carrying the initials and hue.
 * @returns The render function producing the disc.
 */
function NeighbourAvatar(handle: Handle<{ initials: string; hue: number }>) {
	return () => (
		<span
			mix={[
				raw({
					display: "grid",
					placeItems: "center",
					inlineSize: "100%",
					blockSize: "100%",
					fontWeight: "800",
					color: `oklch(0.33 0.09 ${handle.props.hue})`,
					backgroundColor: `oklch(0.88 0.07 ${handle.props.hue})`,
				}),
			]}
		>
			{handle.props.initials}
		</span>
	);
}

/**
 * The neighbours band: the warmest note set large, then five more in a row that scrolls
 * sideways.
 *
 * @returns The render function producing the band.
 */
export function Neighbours() {
	let [lead, ...rest] = NOTES;
	return () => (
		<TestimonialBand
			id="neighbours"
			mix={[renderNearView(674, 785)]}
			layout="carousel"
			carouselLabel="More notes from neighbours"
			eyebrow="From the neighbourhood"
			title="What the street says about us"
			description="Notes left on the board by the till, copied out with permission."
			featured={
				<TestimonialBand.Quote
					variant="featured"
					name={lead.name}
					jobTitle={lead.where}
					avatar={<NeighbourAvatar initials={lead.initials} hue={lead.hue} />}
				>
					{lead.quote}
				</TestimonialBand.Quote>
			}
		>
			{rest.map((note) => (
				<TestimonialBand.Quote
					key={note.name}
					name={note.name}
					jobTitle={note.where}
					avatar={<NeighbourAvatar initials={note.initials} hue={note.hue} />}
				>
					{note.quote}
				</TestimonialBand.Quote>
			))}
		</TestimonialBand>
	);
}

/**
 * The questions band: six answers in two accordion columns whose items share a name per
 * column, so opening one closes the one before it, with no script. One gap token spaces the
 * cards and the stacked columns alike, so a phone reads one even list.
 *
 * @returns The render function producing the band.
 */
export function Questions() {
	return () => (
		<FaqBand
			id="questions"
			mix={[raw({ "--ui-landing-faq-gap": "0.75rem" }), renderNearView(341, 503)]}
			tone="tinted"
			columns={2}
			eyebrow="Questions"
			title="Asked at the counter"
		>
			{QUESTIONS.map((column, index) => (
				<Accordion
					key={index}
					mix={[
						raw({
							"--ui-neutral-border": "transparent",
							display: "flex",
							flexDirection: "column",
							gap: "var(--ui-landing-faq-gap)",
						}),
					]}
				>
					{column.map(([question, answer]) => (
						<Accordion.Item
							key={question}
							name={`hollyhock-faq-${index}`}
							mix={[
								raw({
									paddingInline: "1.25rem",
									borderRadius: "var(--ui-landing-card-radius-inner)",
									backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
									boxShadow: "var(--ui-shadow-surface)",
								}),
							]}
						>
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
 * The closing call on an inset terracotta panel: the same pickup order the hero leads with,
 * in cream in both themes so it reads as the one action (the band's own tokens hold its
 * subtree in dark, hence the forced fill), and the phone number for anyone who'd rather talk.
 *
 * @returns The render function producing the band.
 */
export function Closing() {
	return () => (
		<ClosingCta
			id="come-by"
			tone="brand"
			inset
			title="Tomorrow's bread, kept back for you"
			description="Order tonight, collect any time we're open tomorrow. Or just come by; the kettle's always on."
			actions={
				<>
					<LinkButton
						href="#order"
						variant="surface"
						mix={[
							landingCtaChrome(),
							raw({
								backgroundColor: "oklch(0.975 0.018 85) !important",
								color: "oklch(0.38 0.11 38) !important",
								boxShadow: "none !important",
							}),
							when("&:hover", raw({ backgroundColor: "oklch(0.93 0.03 80) !important" })),
						]}
					>
						Order for pickup
					</LinkButton>
					<LinkButton href={PHONE.href} variant="ghost" mix={[landingCtaChrome()]}>
						Call {PHONE.label}
					</LinkButton>
				</>
			}
		/>
	);
}
