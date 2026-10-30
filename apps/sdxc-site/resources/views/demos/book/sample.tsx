/**
 * The free-chapter band: the offer and an email form beside the chapter's first page, with
 * a direct download for a reader who would rather not leave an address. The form posts to
 * an example endpoint that returns the reader to this page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DownloadIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { flexCol, flexRow, hstack, items, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Button, Link, TextField } from "@sdxc/ui";
import { FeatureBand } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import BookSamplePage from "~/resources/views/demos/book/sample-page";

/**
 * Renders the offer beside the page from the `lg` container up. The field and button share
 * a row from `sm`, so the address and the action read as one step.
 *
 * @returns The render function producing the band.
 */
export default function BookSample() {
	return () => (
		<FeatureBand
			id="sample"
			layout="split"
			eyebrow="Free chapter"
			title="Read chapter 2 before you buy"
			description={
				<>
					The whole chapter on measure, 24 pages, plus the video lesson that goes with it. One email
					with the files, and <strong>nothing after that</strong> unless you ask.
				</>
			}
			media={<BookSamplePage />}
		>
			<div mix={[vstack({ gap: 4, align: "stretch" })]}>
				<form method="post" action="/examples/book/sample-chapter">
					<div
						mix={[
							combine([
								flexCol(),
								raw({ display: "flex", gap: "0.75rem" }),
								at("sm", [flexRow(), items("end")]),
							]),
						]}
					>
						<TextField
							label="Email address"
							type="email"
							name="email"
							autoComplete="email"
							placeholder="you@studio.com"
							required
							mix={[raw({ flex: "1" })]}
						/>
						<Button type="submit" color="brand" mix={[marketingCtaChrome()]}>
							Send me chapter 2
						</Button>
					</div>
				</form>
				<p mix={[m(0), hstack({ gap: 2, align: "start" }), text("sm"), fg("neutral.muted")]}>
					<DownloadIcon
						aria-hidden="true"
						mix={[
							raw({
								inlineSize: "1rem",
								blockSize: "1rem",
								flexShrink: "0",
								marginBlockStart: "0.125rem",
							}),
						]}
					/>
					<span>
						Rather skip the email?{" "}
						<Link href="/examples/book/sample-chapter.pdf" mix={[weight("medium")]}>
							Download the PDF
						</Link>{" "}
						{"(2.1\u00a0MB)"}
					</span>
				</p>
			</div>
		</FeatureBand>
	);
}
