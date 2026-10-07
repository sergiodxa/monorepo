/**
 * The email listing bookmarks the weekly check found moved or gone since the last digest:
 * each one's title, URL and what the check saw, with a link to its CMS edit page, where
 * saving it closes the flag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address, Email as EmailContract } from "@sdxc/mail";
import type { Handle } from "remix/component";

import { Email } from "@sdxc/mail";

/** Types for the digest. */
export namespace BookmarksDigestEmail {
	/** One flagged bookmark as the digest lists it. */
	export interface Item {
		title: string;
		url: string;
		flag: "moved" | "gone";
		/** The final response's status, or `null` when the page never answered. */
		httpStatus: number | null;
		/** Where a moved bookmark's redirects end now. */
		finalUrl: string | null;
		/** The bookmark's CMS edit page, absolute so it opens from any mail client. */
		editUrl: string;
	}
}

/** What the check saw, in a few words: `Gone (404)`, `Moved to …`, or `Gone (no answer)`. */
function finding(item: BookmarksDigestEmail.Item): string {
	if (item.flag === "moved") return `Moved to ${item.finalUrl ?? "another address"}`;
	return item.httpStatus === null ? "Gone (no answer)" : `Gone (${item.httpStatus})`;
}

/** The digest body: one section per flagged bookmark, newest flag first. */
function DigestBody(handle: Handle<{ items: BookmarksDigestEmail.Item[] }>) {
	return () => {
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
	};
}

/**
 * The digest for one run, ready for `mailer.send()`. The subject carries the count, so the
 * inbox says how much there is before it is opened.
 */
export class BookmarksDigestEmail implements EmailContract {
	/**
	 * @param recipient Who reviews the bookmarks.
	 * @param items The bookmarks flagged since the last digest.
	 */
	constructor(
		private recipient: Address,
		private items: BookmarksDigestEmail.Item[],
	) {}

	/** The person who reviews bookmarks. */
	get to(): Address {
		return this.recipient;
	}

	/** `[Bookmarks] 3 to review`, which sorts with the other site mail in an inbox. */
	get subject(): string {
		return `[Bookmarks] ${this.items.length} to review`;
	}

	/** Renders every flagged bookmark with what was found and where to fix it. */
	body() {
		return <DigestBody items={this.items} />;
	}
}
