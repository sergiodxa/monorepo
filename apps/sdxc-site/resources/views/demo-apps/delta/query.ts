/**
 * The query a list of issues or pull requests reads, in GitHub's grammar: `is:open`,
 * `label:bug`, `author:mara`, `assignee:@me`, `no:assignee` and free words, one string in the
 * address, so a filtered list is a link and a power user types what a click would apply.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Which records a query keeps by state. */
export type QueryState = "open" | "closed" | "merged" | "all";

/** A query read into its parts. */
export interface ListQuery {
	state: QueryState;
	labels: string[];
	authors: string[];
	assignees: string[];
	reviewers: string[];
	/** `no:assignee`, `no:label`, `no:milestone`. */
	missing: Array<"assignee" | "label" | "milestone">;
	milestone?: string;
	draft?: boolean;
	review?: "approved" | "changes_requested" | "required";
	/** Words matched against the title, and `#number`. */
	words: string[];
}

/** What a list shows when its address names no query. */
export const DEFAULT_QUERY = "is:open";

/** Splits a query into tokens, keeping a quoted value (`label:"good first issue"`) whole. */
export function tokenize(query: string): string[] {
	return [...query.matchAll(/(\S+?:"[^"]*"?|"[^"]*"?|\S+)/g)].map((match) => match[0]);
}

/** A qualifier's value without its quotes. */
function unquote(value: string): string {
	return value.replace(/^"|"$/g, "");
}

/**
 * Reads a query. Unknown qualifiers read as words, so a typo narrows the list rather than
 * being dropped without a word.
 *
 * @param query The query as typed.
 * @param me The handle `@me` stands for.
 */
export function parseQuery(query: string, me: string): ListQuery {
	let parsed: ListQuery = {
		state: "all",
		labels: [],
		authors: [],
		assignees: [],
		reviewers: [],
		missing: [],
		words: [],
	};
	let person = (value: string) => {
		let name = unquote(value).replace(/^@/, "");
		return name === "me" ? me : name;
	};
	for (let token of tokenize(query)) {
		let colon = token.indexOf(":");
		let key = colon === -1 ? "" : token.slice(0, colon).toLowerCase();
		let value = colon === -1 ? token : token.slice(colon + 1);
		if (key === "is" && ["open", "closed", "merged"].includes(value)) {
			parsed.state = value as QueryState;
		} else if (key === "is" && (value === "issue" || value === "pr")) {
			continue;
		} else if (key === "is" && value === "draft") {
			parsed.draft = true;
		} else if (key === "label") {
			parsed.labels.push(unquote(value));
		} else if (key === "author") {
			parsed.authors.push(person(value));
		} else if (key === "assignee") {
			parsed.assignees.push(person(value));
		} else if (key === "review-requested") {
			parsed.reviewers.push(person(value));
		} else if (key === "milestone") {
			parsed.milestone = unquote(value);
		} else if (
			key === "no" &&
			(value === "assignee" || value === "label" || value === "milestone")
		) {
			parsed.missing.push(value);
		} else if (
			key === "review" &&
			(value === "approved" || value === "changes_requested" || value === "required")
		) {
			parsed.review = value;
		} else if (unquote(token) !== "") {
			parsed.words.push(unquote(token).toLowerCase());
		}
	}
	return parsed;
}

/**
 * The query with its state qualifier set: `is:open` swapped for `is:closed`, or added when
 * the query had none, keeping every other token as typed.
 */
export function withState(query: string, state: Exclude<QueryState, "all">): string {
	let tokens = tokenize(query).filter((token) => !/^is:(open|closed|merged)$/i.test(token));
	return [`is:${state}`, ...tokens].join(" ");
}

/** The query without its state qualifier, for counting each tab. */
export function withoutState(query: string): string {
	return tokenize(query)
		.filter((token) => !/^is:(open|closed|merged)$/i.test(token))
		.join(" ");
}

/** Whether a title matches every free word, or a word names the record's `#number`. */
export function matchesWords(words: readonly string[], title: string, number: number): boolean {
	let lower = title.toLowerCase();
	return words.every(
		(word) => word === `#${number}` || word === String(number) || lower.includes(word),
	);
}
