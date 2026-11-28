/**
 * The parts every demo blog shares whatever its design: a post's body set for reading, the
 * newsletter form that posts to the blog's sign-up, and dates as a reader sees them. Each
 * blog draws everything around them in its own direction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown } from "@sdxc/markdown";
import type { Handle } from "remix/component";

import { toRemix } from "@sdxc/markdown/remix";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { Button, TextField, Typeset } from "@sdxc/ui";

import { POST_COMPONENTS } from "~/resources/views/demo-blogs/markdown";

namespace PostBody {
	export interface Props {
		document: Markdown.Document;
		/**
		 * `reading` sets long-form at 20px for an article's page; `docs` sets it at 18px for a
		 * note shown in full inside a stream.
		 * @default "reading"
		 */
		preset?: Typeset.Preset;
		/** The body size, overriding the preset's, for a post shown in full inside a list. */
		size?: string;
	}
}

/**
 * A post's Markdown rendered through the kit's headings, code blocks and callouts, set in the
 * blog's reading face, which its `--demo-blog-reading-font` token names. Code and asides get
 * the room a paragraph break has, so prose never runs into a code block's edge.
 */
export function PostBody(handle: Handle<PostBody.Props>) {
	return () => {
		let { document, preset = "reading", size } = handle.props;
		return (
			<Typeset
				preset={preset}
				mix={[
					m(0),
					raw({
						fontFamily: "var(--demo-blog-reading-font, inherit)",
						"& :where(pre, code, kbd)": { fontFamily: "var(--ui-font-mono)" },
						"& > :where(figure, [data-slot='callout'])": { marginBlock: "1.75em" },
					}),
					size === undefined ? null : raw({ "--ui-typeset-size": size }),
				]}
			>
				{toRemix(document, { components: POST_COMPONENTS })}
			</Typeset>
		);
	};
}

namespace NewsletterForm {
	export interface Props {
		/** The blog's sign-up address, which the form posts to. */
		action: string;
		/** The button's label. @default "Subscribe" */
		submitLabel?: string;
		/** The field's visible label. @default "Email address" */
		label?: string;
	}
}

/**
 * An email field and a button, side by side from 30rem and stacked below. It posts, so the
 * address never lands in a URL, and the blog answers with its confirmation page.
 */
export function NewsletterForm(handle: Handle<NewsletterForm.Props>) {
	return () => {
		let { action, label = "Email address", submitLabel = "Subscribe" } = handle.props;
		return (
			<form
				method="post"
				action={action}
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					media("(min-width: 30rem)", hstack({ gap: 2, align: "end" })),
				]}
			>
				<TextField
					label={label}
					type="email"
					name="email"
					autoComplete="email"
					placeholder="you@example.com"
					required
					mix={[raw({ flex: "1 1 14rem" })]}
				/>
				<Button type="submit" color="brand">
					{submitLabel}
				</Button>
			</form>
		);
	};
}

/**
 * Formats `YYYY-MM-DD` as a reader sees it, read as a calendar date so no time zone moves it.
 *
 * @param style `long` ("November 12, 2026"), `short` ("Nov 12, 2026") or `day` ("Nov 12").
 * @default style "short"
 */
export function formatPostDate(date: string, style: "long" | "short" | "day" = "short"): string {
	return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
		year: style === "day" ? undefined : "numeric",
		month: style === "long" ? "long" : "short",
		day: "numeric",
		timeZone: "UTC",
	});
}

namespace PostDate {
	export interface Props {
		date: string;
		style?: "long" | "short" | "day";
	}
}

/** A post's date as a `<time>` carrying the machine-readable day. */
export function PostDate(handle: Handle<PostDate.Props>) {
	return () => (
		<time datetime={handle.props.date}>
			{formatPostDate(handle.props.date, handle.props.style)}
		</time>
	);
}

/**
 * The host a bookmark links to, without `www.`, for the chip beside its title.
 *
 * @example linkHost("https://www.rfc-editor.org/rfc/rfc9111") // "rfc-editor.org"
 */
export function linkHost(url: string): string {
	return new URL(url).hostname.replace(/^www\./, "");
}
