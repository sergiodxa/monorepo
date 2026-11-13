/**
 * Undercurrent's footer: the wordmark and a line on what it is, the page's links in three
 * short columns, and the copyright with the ways to follow along, closed like the foot of
 * a letter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MailIcon, RssIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { m } from "@sdxc/u/size";
import { SiteFooter } from "@sdxc/ui/landing";

import UndercurrentLogo from "~/resources/views/demos/newsletter/logo";

/** The link columns: three, so a phone sets them under each other and the sheet in one row. */
const COLUMNS: SiteFooter.Column[] = [
	{
		title: "Read",
		links: [
			{ href: "#latest", label: "Latest letter" },
			{ href: "#archive", label: "Archive" },
			{ href: "#subscribe", label: "Subscribe" },
		],
	},
	{
		title: "Listen",
		links: [
			{ href: "#listen", label: "Episodes" },
			{ href: "/examples/newsletter/feed.xml", label: "Podcast feed" },
			{ href: "#membership", label: "Membership" },
		],
	},
	{
		title: "Write back",
		links: [
			{ href: "#host", label: "About Tove" },
			{ href: "#replies", label: "Replies" },
			{ href: "/examples/newsletter/reply", label: "Send a question" },
		],
	},
];

/**
 * Renders the footer with the wordmark and tagline above the columns, and the copyright
 * with the email and feed links in the last row.
 *
 * @returns The render function producing the footer.
 */
export default function NewsletterFooter() {
	return () => (
		<SiteFooter
			brand={<UndercurrentLogo />}
			tagline="Letters and episodes about the infrastructure under an ordinary day, by Tove Adler."
			columns={COLUMNS}
			social={
				<>
					<a href="/examples/newsletter/reply" aria-label="Write to Tove">
						<MailIcon aria-hidden="true" />
					</a>
					<a href="/examples/newsletter/feed.xml" aria-label="Podcast feed">
						<RssIcon aria-hidden="true" />
					</a>
				</>
			}
			legal={<p mix={[m(0)]}>© 2026 Tove Adler. Written and recorded in Harbour Ward.</p>}
			mix={[raw({ marginBlockStart: "auto" })]}
		/>
	);
}
