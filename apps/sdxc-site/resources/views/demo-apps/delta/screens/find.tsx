/**
 * Go to file without script: a GET form whose `?q=` the server ranks against every path with
 * the same fuzzy match the `t` finder runs in the browser, listing each match with its matched
 * characters in bold, so the finder is a link a visitor can share.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { FileIcon, SearchIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, text, weight } from "@sdxc/u/typography";
import { Button, HeadingScope, SearchField } from "@sdxc/ui";
import { fuzzyFilter, fuzzySegments } from "@sdxc/ui/app/command-palette";
import { Empty } from "@sdxc/ui/app/empty";

import { fileHref, findHref } from "../data";
import { COPY } from "../labels";
import { RepoHeader } from "../shell";

/** How many matches the page lists at once. */
const LIMIT = 100;

namespace FindScreen {
	export interface Props {
		paths: readonly string[];
		/** What the visitor typed, from `?q=`. */
		query: string;
		commitCount: number;
	}
}

/**
 * Renders the finder: the field holding the query, then every path that matches it, best
 * first; an empty query lists every file, and a query matching nothing says so.
 */
export function FindScreen(handle: Handle<FindScreen.Props>) {
	return () => {
		let { commitCount, paths, query } = handle.props;
		let matches = fuzzyFilter(query, paths, LIMIT);
		return (
			<>
				<RepoHeader
					title={COPY.find.title}
					trail={[{ label: COPY.find.title }]}
					tab="code"
					commits={commitCount}
				/>
				<div mix={[raw({ display: "grid", gap: "1rem", paddingBlockStart: "1rem" })]}>
					<form
						method="get"
						action={findHref()}
						role="search"
						mix={[raw({ display: "flex", gap: "0.5rem", maxInlineSize: "40rem" })]}
					>
						<SearchField mix={[raw({ flex: "1 1 auto", minInlineSize: 0 })]}>
							<SearchField.Input
								name="q"
								defaultValue={query}
								aria-label={COPY.find.label}
								placeholder={COPY.find.placeholder}
								autocomplete="off"
							/>
						</SearchField>
						<Button type="submit" variant="outline" color="neutral">
							<SearchIcon size={16} aria-hidden="true" />
							{COPY.find.submit}
						</Button>
					</form>
					<HeadingScope level={2}>
						{matches.length === 0 ? (
							<Empty kind="no-results">
								<Empty.Title>{`${COPY.find.none}: “${query}”`}</Empty.Title>
								<Empty.Description>{COPY.find.noneHint}</Empty.Description>
							</Empty>
						) : (
							<section aria-labelledby="delta-find-results">
								<h2
									id="delta-find-results"
									mix={[
										text("sm"),
										weight("medium"),
										fg("neutral.muted"),
										raw({ margin: "0 0 0.5rem" }),
									]}
								>
									{COPY.find.matches(matches.length)}
								</h2>
								<ul
									mix={[
										raw({
											listStyle: "none",
											margin: 0,
											padding: 0,
											border: "1px solid var(--ui-neutral-border)",
											borderRadius: "var(--ui-radius-lg)",
											background: "var(--ui-bg)",
											"& > li + li": { borderBlockStart: "1px solid var(--ui-neutral-border)" },
											"& mark": {
												background: "transparent",
												color: "var(--ui-neutral-fg-emphasis)",
												fontWeight: 700,
											},
										}),
									]}
								>
									{matches.map((match) => (
										<li>
											<a
												href={fileHref(match.path)}
												data-rmx-prefetch="intent"
												mix={[
													raw({
														display: "flex",
														alignItems: "center",
														gap: "0.5rem",
														paddingBlock: "0.5rem",
														paddingInline: "0.875rem",
														textDecoration: "none",
														overflowWrap: "anywhere",
														"&:hover": { background: "var(--ui-neutral-bg-tint)" },
													}),
													font("mono"),
													text("sm"),
													fg("neutral.muted"),
												]}
											>
												<FileIcon size={16} aria-hidden="true" mix={[raw({ flexShrink: 0 })]} />
												<span>
													{fuzzySegments(match.path, match.positions).map((segment) =>
														segment.match ? <mark>{segment.text}</mark> : segment.text,
													)}
												</span>
											</a>
										</li>
									))}
								</ul>
							</section>
						)}
					</HeadingScope>
				</div>
			</>
		);
	};
}
