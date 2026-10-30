/**
 * The bands that turn interest into a download: what households say, the two plans,
 * the questions people ask before switching, and the closing call with the store badges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon, MonitorIcon } from "@sdxc/icons";
import { Accordion, LinkButton } from "@sdxc/ui";
import { CheckRow, ClosingCta, FaqBand, PricingBand, TestimonialBand } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import { StoreBadges } from "~/resources/views/demos/app/store-badges";

/** What households say, in the order the masonry columns fill. */
const STORIES = [
	{
		name: "Priya Raman",
		jobTitle: "Parent of three, Leeds",
		avatar: "PR",
		quote: (
			<>
				We used to send <strong>forty messages a week</strong> about milk. Now we send none, and
				nobody buys a second bag.
			</>
		),
	},
	{
		name: "Tomás Herrera",
		jobTitle: "Shares a flat with four",
		avatar: "TH",
		quote: (
			<>
				The rota ended the bathroom argument. It just says whose week it is and{" "}
				<strong>everyone accepts the app</strong>.
			</>
		),
	},
	{
		name: "Hannah Brooks",
		jobTitle: "Cares for her father",
		avatar: "HB",
		quote: (
			<>
				My brother lives two hours away and still sees the pharmacy list.{" "}
				<strong>We finally split the load</strong> without keeping score.
			</>
		),
	},
	{
		name: "Kofi Mensah",
		jobTitle: "Android in an iPhone family",
		avatar: "KM",
		quote: (
			<>
				Every shared-list app I tried left me out. This one works the same on my phone as on theirs.
			</>
		),
	},
	{
		name: "Elif Demir",
		jobTitle: "Plans dinners for six",
		avatar: "ED",
		quote: (
			<>
				I plan Sunday night, tap once, and the list is done.{" "}
				<strong>That tap saves me an hour</strong> every week.
			</>
		),
	},
	{
		name: "Sam Whitaker",
		jobTitle: "Dad and occasional cook",
		avatar: "SW",
		quote: <>The evening summary is the only notification I haven't turned off.</>,
	},
] as const;

/** Questions people ask before switching, split into the two accordion columns. */
const QUESTIONS = [
	[
		[
			"Does everyone need an account?",
			"Each person signs in once, with an email or a phone number. Children under 13 join through a parent and get a kid account with no email of its own.",
		],
		[
			"What happens to our lists if we stop paying?",
			"Nothing is deleted. You move back to the free plan, keep every list and rota, and meal plans become read-only until you renew.",
		],
		[
			"Can we use it without signal?",
			"Yes. Rooftree keeps the household's data on each device and syncs the changes when the connection returns. Two people editing the same item offline are merged by the latest tick.",
		],
	],
	[
		[
			"Is Rooftree really end-to-end encrypted?",
			"Lists, rotas, plans and calendar entries are encrypted on your devices with the household key. Our servers relay and store only ciphertext they cannot read.",
		],
		[
			"How do we move over from paper or another app?",
			"Paste any list and Rooftree splits it into rows, or import a calendar file. Most households are fully moved over within an evening.",
		],
		[
			"Do you offer a family discount?",
			"Plus is priced per household, not per person, so a family of six pays the same as a couple. Students and shared flats get the yearly plan at half price.",
		],
	],
] as const;

/**
 * The testimonials band: six households in a masonry of three columns.
 *
 * @returns The render function producing the band.
 */
export function Stories() {
	return () => (
		<TestimonialBand
			id="stories"
			eyebrow="Households"
			title="Fewer messages about milk"
			description="What people told us after their first month of sharing one list."
		>
			{STORIES.map((story) => (
				<TestimonialBand.Quote
					key={story.name}
					name={story.name}
					jobTitle={story.jobTitle}
					avatar={story.avatar}
				>
					{story.quote}
				</TestimonialBand.Quote>
			))}
		</TestimonialBand>
	);
}

/**
 * The pricing band: a free plan that covers a small household for good, and Plus,
 * priced per household rather than per person.
 *
 * @returns The render function producing the band.
 */
export function Pricing() {
	return () => (
		<PricingBand
			id="pricing"
			tone="tinted"
			columns={2}
			eyebrow="Pricing"
			title="Free for most homes"
			description={
				<>
					Start free and stay there if it fits. <strong>Plus is priced per household</strong>,
					however many people live in it.
				</>
			}
		>
			<PricingBand.Plan
				name="Free"
				price="$0"
				period="forever"
				description="Everything a couple or a small flat needs to share."
				features={
					<>
						<CheckRow>Up to 4 people</CheckRow>
						<CheckRow>Unlimited lists and chores</CheckRow>
						<CheckRow>Shared calendar</CheckRow>
						<CheckRow>Works offline on every device</CheckRow>
					</>
				}
				action={
					<LinkButton href="#download" variant="surface" mix={[marketingCtaChrome()]}>
						Download free
					</LinkButton>
				}
			/>
			<PricingBand.Plan
				featured
				name="Plus"
				badge="Most households"
				price="$4"
				period="/month, billed yearly"
				description="For bigger families and homes that plan the whole week."
				features={
					<>
						<CheckRow>Unlimited people and kid accounts</CheckRow>
						<CheckRow>Meal plans that fill the list</CheckRow>
						<CheckRow>Reminders by place</CheckRow>
						<CheckRow>Two years of history and receipts</CheckRow>
						<CheckRow>Priority help from a person</CheckRow>
					</>
				}
				action={
					<LinkButton href="#download" color="brand" mix={[marketingCtaChrome()]}>
						Try Plus free for 30 days
					</LinkButton>
				}
			/>
		</PricingBand>
	);
}

/**
 * The questions band: six answers in two accordion columns whose items share a name per
 * column, so opening one question closes the one before it.
 *
 * @returns The render function producing the band.
 */
export function Questions() {
	return () => (
		<FaqBand id="faq" columns={2} eyebrow="Questions" title="Before you switch">
			{QUESTIONS.map((column, index) => (
				<Accordion key={index}>
					{column.map(([question, answer]) => (
						<Accordion.Item key={question} name={`rooftree-faq-${index}`}>
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
 * The closing call on an inset brand panel: both store badges and the desktop download,
 * the last thing a reader sees before the footer.
 *
 * @returns The render function producing the band.
 */
export function Download() {
	return () => (
		<ClosingCta
			id="download"
			tone="brand"
			inset
			title="Bring everyone onto one list tonight"
			description="Download it, invite the household with a link, and the next shop is already shared."
			actions={
				<StoreBadges align="center">
					<LinkButton href="#platforms" variant="surface" mix={[marketingCtaChrome()]}>
						<MonitorIcon size={16} /> Mac & Windows
					</LinkButton>
				</StoreBadges>
			}
		/>
	);
}
