/**
 * Live preview for `PricingBand`: three uptime plans with the middle one featured, which
 * inverts and reads first when the band is narrow. A band is a page-width surface, so it
 * meets the frame's edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge, HeadingScope, LinkButton } from "@sdxc/ui";
import { CheckRow, PricingBand } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<PricingBand
	eyebrow="Pricing"
	title="Plans that grow with your pager"
	description={
		<>
			Every plan checks from six regions. Pay for <strong>more monitors and faster checks</strong>,
			never for seats.
		</>
	}
>
	<PricingBand.Plan
		name="Hobby"
		price="$0"
		period="/month"
		description="For side projects and a personal status page."
		features={
			<>
				<CheckRow>Five monitors</CheckRow>
				<CheckRow>Five-minute checks</CheckRow>
				<CheckRow>Email alerts</CheckRow>
				<CheckRow>One public status page</CheckRow>
			</>
		}
		action={
			<LinkButton href="/examples/signup" color="neutral" variant="surface">
				Start for free
			</LinkButton>
		}
	/>
	<PricingBand.Plan
		name="Team"
		price="$29"
		period="/month"
		featured
		badge={<Badge color="brand">Most popular</Badge>}
		description="For a product team that shares the on-call rotation."
		features={
			<>
				<CheckRow>Fifty monitors</CheckRow>
				<CheckRow>Thirty-second checks</CheckRow>
				<CheckRow>Slack, SMS and webhook alerts</CheckRow>
				<CheckRow>Status pages on your own domain</CheckRow>
				<CheckRow>Ninety days of response history</CheckRow>
			</>
		}
		action={
			<LinkButton href="/examples/signup?plan=team" color="brand">
				Start a 14-day trial
			</LinkButton>
		}
	/>
	<PricingBand.Plan
		name="Business"
		price="$99"
		period="/month"
		description="For companies with an uptime promise in their contracts."
		features={
			<>
				<CheckRow>Two hundred monitors</CheckRow>
				<CheckRow>Ten-second checks</CheckRow>
				<CheckRow>Escalation policies and schedules</CheckRow>
				<CheckRow>SLA reports every month</CheckRow>
				<CheckRow>SAML single sign-on</CheckRow>
			</>
		}
		action={
			<LinkButton href="/examples/pricing" color="neutral" variant="surface">
				Talk to sales
			</LinkButton>
		}
	/>
</PricingBand>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<PricingBand
				eyebrow="Pricing"
				title="Plans that grow with your pager"
				description={
					<>
						Every plan checks from six regions. Pay for{" "}
						<strong>more monitors and faster checks</strong>, never for seats.
					</>
				}
			>
				<PricingBand.Plan
					name="Hobby"
					price="$0"
					period="/month"
					description="For side projects and a personal status page."
					features={
						<>
							<CheckRow>Five monitors</CheckRow>
							<CheckRow>Five-minute checks</CheckRow>
							<CheckRow>Email alerts</CheckRow>
							<CheckRow>One public status page</CheckRow>
						</>
					}
					action={
						<LinkButton href="/examples/signup" color="neutral" variant="surface">
							Start for free
						</LinkButton>
					}
				/>
				<PricingBand.Plan
					name="Team"
					price="$29"
					period="/month"
					featured
					badge={<Badge color="brand">Most popular</Badge>}
					description="For a product team that shares the on-call rotation."
					features={
						<>
							<CheckRow>Fifty monitors</CheckRow>
							<CheckRow>Thirty-second checks</CheckRow>
							<CheckRow>Slack, SMS and webhook alerts</CheckRow>
							<CheckRow>Status pages on your own domain</CheckRow>
							<CheckRow>Ninety days of response history</CheckRow>
						</>
					}
					action={
						<LinkButton href="/examples/signup?plan=team" color="brand">
							Start a 14-day trial
						</LinkButton>
					}
				/>
				<PricingBand.Plan
					name="Business"
					price="$99"
					period="/month"
					description="For companies with an uptime promise in their contracts."
					features={
						<>
							<CheckRow>Two hundred monitors</CheckRow>
							<CheckRow>Ten-second checks</CheckRow>
							<CheckRow>Escalation policies and schedules</CheckRow>
							<CheckRow>SLA reports every month</CheckRow>
							<CheckRow>SAML single sign-on</CheckRow>
						</>
					}
					action={
						<LinkButton href="/examples/pricing" color="neutral" variant="surface">
							Talk to sales
						</LinkButton>
					}
				/>
			</PricingBand>
		</HeadingScope>
	),
};
