/**
 * The questions shoppers asked about a product and the answers they got: each question set
 * bold behind a "Q:" mark, its answers indented behind "A:" with who answered, a badge such
 * as "Store" or "Verified buyer", when, and room for a helpful vote.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";

/** Prop types for {@link QuestionList}. */
export namespace QuestionList {
	/** One answer to a question. */
	export interface Answer {
		id: string;
		author: RemixNode;
		/** Beside the author, such as "Store" or "Verified buyer". */
		badge?: RemixNode;
		body: RemixNode;
		/** After the author, such as when it was written. */
		meta?: RemixNode;
		/** At the end of the answer, such as a POST form voting it helpful. */
		helpful?: RemixNode;
	}

	/** One question and its answers. */
	export interface Question {
		id: string;
		question: RemixNode;
		/** Under the question, such as who asked and when. */
		meta?: RemixNode;
		answers: Answer[];
	}

	/** The words the list carries. */
	export interface Labels {
		/** The answer count under each question, with `{n}` for the count, such as "{n} answers". */
		answers: string;
	}

	/** Props accepted by {@link QuestionList}; the host is a `<div>` holding the list. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		questions: Question[];
		/** Shown in place of the list when nobody has asked yet. */
		empty?: RemixNode;
		labels: Labels;
	}
}

/** The bold "Q:" or "A:" mark that leads a question or an answer. */
function Marker(handle: Handle<{ children: string }>) {
	return () => (
		<span
			data-marker=""
			mix={[
				raw({
					fontWeight: "800",
					color: "var(--ui-neutral-fg-emphasis)",
					fontVariantNumeric: "tabular-nums",
				}),
			]}
		>
			{handle.props.children}
		</span>
	);
}

/**
 * Renders each question as a list item: the "Q:" row, its meta and answer count, then an
 * indented list of answers, each with its "A:" mark, its words and a row naming who answered.
 * With no questions it renders `empty`, or nothing.
 *
 * @example
 * <QuestionList questions={[{ id: "q1", question: "Does it come framed?", answers: [{ id: "a1", author: "The shop", badge: "Store", body: "Pick a frame on the format step." }] }]} labels={{ answers: "{n} answers" }} />
 */
export function QuestionList(handle: Handle<QuestionList.Props>) {
	return () => {
		let { empty, labels, mix, questions, ...rest } = handle.props;
		if (questions.length === 0) {
			if (empty === undefined) return null;
			return (
				<div
					{...rest}
					data-slot="question-list"
					data-empty=""
					mix={mergeMix([raw({ color: "var(--ui-neutral-fg-muted)" })], mix)}
				>
					{empty}
				</div>
			);
		}
		return (
			<div {...rest} data-slot="question-list" mix={mix}>
				<ul mix={[raw({ margin: "0", padding: "0", listStyle: "none" })]}>
					{questions.map((entry) => (
						<li
							data-question={entry.id}
							mix={[
								raw({
									display: "grid",
									gap: "0.75rem",
									paddingBlock: "1.25rem",
									borderBlockEnd: "1px solid var(--ui-neutral-border)",
									"&:first-child": { paddingBlockStart: "0" },
								}),
							]}
						>
							<div mix={[raw({ display: "grid", gap: "0.25rem" })]}>
								<p
									data-slot="question-list-question"
									mix={[
										raw({
											display: "flex",
											gap: "0.5rem",
											margin: "0",
											fontWeight: "650",
											lineHeight: "1.45",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
									]}
								>
									<Marker>Q:</Marker>
									<span>{entry.question}</span>
								</p>
								<p
									mix={[
										raw({
											margin: "0",
											paddingInlineStart: "1.75rem",
											fontSize: "0.8125rem",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									{entry.meta === undefined ? null : <span>{entry.meta} · </span>}
									<span data-slot="question-list-count">
										{labels.answers.replace("{n}", String(entry.answers.length))}
									</span>
								</p>
							</div>
							{entry.answers.length === 0 ? null : (
								<ul
									mix={[
										raw({
											display: "grid",
											gap: "1rem",
											margin: "0",
											paddingInlineStart: "1.75rem",
											listStyle: "none",
										}),
									]}
								>
									{entry.answers.map((answer) => (
										<li
											data-answer={answer.id}
											mix={[
												raw({
													display: "grid",
													gridTemplateColumns: "1.25rem minmax(0, 1fr)",
													columnGap: "0.5rem",
													rowGap: "0.375rem",
													lineHeight: "1.55",
												}),
											]}
										>
											<Marker>A:</Marker>
											<div data-slot="question-list-answer">{answer.body}</div>
											<div
												mix={[
													raw({
														gridColumn: "2",
														display: "flex",
														flexWrap: "wrap",
														alignItems: "center",
														columnGap: "0.5rem",
														rowGap: "0.25rem",
														fontSize: "0.8125rem",
														color: "var(--ui-neutral-fg-muted)",
													}),
												]}
											>
												<span
													mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}
												>
													{answer.author}
												</span>
												{answer.badge === undefined ? null : (
													<span
														data-slot="question-list-badge"
														mix={[
															raw({
																paddingInline: "0.4375rem",
																paddingBlock: "0.0625rem",
																borderRadius: "999px",
																fontSize: "0.75rem",
																fontWeight: "600",
																color: "var(--ui-brand-fg)",
																backgroundColor: "var(--ui-brand-bg-tint)",
															}),
														]}
													>
														{answer.badge}
													</span>
												)}
												{answer.meta === undefined ? null : <span>{answer.meta}</span>}
												{answer.helpful === undefined ? null : (
													<span mix={[raw({ marginInlineStart: "auto" })]}>{answer.helpful}</span>
												)}
											</div>
										</li>
									))}
								</ul>
							)}
						</li>
					))}
				</ul>
			</div>
		);
	};
}
