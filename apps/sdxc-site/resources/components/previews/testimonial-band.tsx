/**
 * Live preview for `TestimonialBand`: six quotes of varied length from uptime customers,
 * packed into masonry columns with initials avatars. A band is a page-width surface, so it
 * meets the frame's edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HeadingScope } from "@sdxc/ui";
import { TestimonialBand } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<TestimonialBand
	eyebrow="Testimonials"
	title="On-call teams sleep better"
	description="Thousands of teams watch their endpoints with us. Here is what a few of them say."
>
	<TestimonialBand.Quote name="Priya Natarajan" jobTitle="Staff SRE, Ledgerline" avatar="PN">
		We used to learn about outages from support tickets. Now the Slack alert lands <strong>before the first customer notices</strong>, and the status page updates itself.
	</TestimonialBand.Quote>
	<TestimonialBand.Quote name="Marcus Webb" jobTitle="CTO, Fernwood" avatar="MW">
		Setup took five minutes. I pasted our health check URLs and was done.
	</TestimonialBand.Quote>
	<TestimonialBand.Quote name="Lucía Ortega" jobTitle="Engineering manager, Tidepool" avatar="LO">
		The thirty-second checks caught a certificate that expired at 3am on a Sunday. Escalation woke the right person, the fix shipped in twelve minutes, and the monthly SLA report still came out at <strong>99.98%</strong>. That report is now the first thing our enterprise customers ask for.
	</TestimonialBand.Quote>
	<TestimonialBand.Quote name="Daniel Kim" jobTitle="Founder, Brightdesk" avatar="DK">
		Our status page on our own domain made us look like a much bigger company than we are.
	</TestimonialBand.Quote>
	<TestimonialBand.Quote name="Hannah Becker" jobTitle="Platform lead, Northwind Freight" avatar="HB">
		Six regions means we finally see when it is <strong>only Singapore</strong> that is slow, instead of guessing from one probe in Virginia.
	</TestimonialBand.Quote>
	<TestimonialBand.Quote name="Omar Haddad" jobTitle="Solo developer" avatar="OH">
		The free plan covers all my side projects. When one of them started making money, upgrading took one click.
	</TestimonialBand.Quote>
</TestimonialBand>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<TestimonialBand
				eyebrow="Testimonials"
				title="On-call teams sleep better"
				description="Thousands of teams watch their endpoints with us. Here is what a few of them say."
			>
				<TestimonialBand.Quote name="Priya Natarajan" jobTitle="Staff SRE, Ledgerline" avatar="PN">
					We used to learn about outages from support tickets. Now the Slack alert lands{" "}
					<strong>before the first customer notices</strong>, and the status page updates itself.
				</TestimonialBand.Quote>
				<TestimonialBand.Quote name="Marcus Webb" jobTitle="CTO, Fernwood" avatar="MW">
					Setup took five minutes. I pasted our health check URLs and was done.
				</TestimonialBand.Quote>
				<TestimonialBand.Quote
					name="Lucía Ortega"
					jobTitle="Engineering manager, Tidepool"
					avatar="LO"
				>
					The thirty-second checks caught a certificate that expired at 3am on a Sunday. Escalation
					woke the right person, the fix shipped in twelve minutes, and the monthly SLA report still
					came out at <strong>99.98%</strong>. That report is now the first thing our enterprise
					customers ask for.
				</TestimonialBand.Quote>
				<TestimonialBand.Quote name="Daniel Kim" jobTitle="Founder, Brightdesk" avatar="DK">
					Our status page on our own domain made us look like a much bigger company than we are.
				</TestimonialBand.Quote>
				<TestimonialBand.Quote
					name="Hannah Becker"
					jobTitle="Platform lead, Northwind Freight"
					avatar="HB"
				>
					Six regions means we finally see when it is <strong>only Singapore</strong> that is slow,
					instead of guessing from one probe in Virginia.
				</TestimonialBand.Quote>
				<TestimonialBand.Quote name="Omar Haddad" jobTitle="Solo developer" avatar="OH">
					The free plan covers all my side projects. When one of them started making money,
					upgrading took one click.
				</TestimonialBand.Quote>
			</TestimonialBand>
		</HeadingScope>
	),
};
