/**
 * The email listing bookmarks the weekly check found moved or gone since the last digest:
 * each one's title, URL and what the check saw, with a link to its CMS edit page, where
 * saving it closes the flag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailPropsOutput } from "@sdxc/mail";

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";

/** One flagged bookmark as the digest lists it. */
type DigestItem = EmailPropsOutput<typeof emails.bookmarks.digest>["items"][number];

/** What the check saw, in a few words: `Gone (404)`, `Moved to …`, or `Gone (no answer)`. */
function finding(item: DigestItem): string {
	if (item.flag === "moved") return `Moved to ${item.finalUrl ?? "another address"}`;
	return item.httpStatus === null ? "Gone (no answer)" : `Gone (${item.httpStatus})`;
}

/**
 * One section per flagged bookmark, newest flag first. The subject carries the count, as
 * `[Bookmarks] 3 to review`, so the inbox says how much there is before it is opened and the
 * message sorts with the other site mail.
 */
export default createEmail(emails.bookmarks.digest, {
	subject: ({ items }) => `[Bookmarks] ${items.length} to review`,
	body: (handle) => () => {
		let { items } = handle.props;
		let count = items.length === 1 ? "1 bookmark needs" : `${items.length} bookmarks need`;

		return (
			<Email.Layout title="Bookmarks to review" preview={`${count} a look`}>
				<Email.Heading>Bookmarks to review</Email.Heading>
				<Email.Text>
					{count} a look. Edit each one to fix its URL or delete it; saving it closes the flag.
				</Email.Text>
				{items.map((item) => (
					<>
						<Email.Heading level={2}>{item.title}</Email.Heading>
						<Email.Table
							rows={[
								{ label: "URL", value: item.url },
								{ label: "Found", value: finding(item) },
							]}
						/>
						<Email.Text>
							<Email.Link href={item.editUrl}>Review in the CMS</Email.Link>
						</Email.Text>
					</>
				))}
				<Email.Footer>Sent by the weekly bookmark check at sergiodxa.com.</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({
		items: [
			{
				title: "A post that moved",
				url: "https://example.com/old",
				flag: "moved",
				httpStatus: 200,
				finalUrl: "https://example.com/new",
				editUrl: "https://sergiodxa.com/cms/bookmarks/preview/edit",
			},
		],
	}),
});
