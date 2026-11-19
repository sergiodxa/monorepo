/**
 * Live preview for `QuestionList`: two questions about a print, one answered by the store and
 * a buyer, one still waiting for an answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { QuestionList } from "@sdxc/ui/commerce/question-list";

/** The source the page shows. */
const CODE = `<QuestionList
	questions={product.questions.map((question) => ({
		id: question.id,
		question: question.text,
		meta: \`Asked by \${question.author} · \${question.when}\`,
		answers: question.answers.map((answer) => ({
			id: answer.id,
			author: answer.author,
			badge: answer.fromStore ? "Store" : undefined,
			body: answer.text,
			meta: answer.when,
		})),
	}))}
	empty="No questions yet. Ask the first one."
	labels={{ answers: "{n} answers" }}
/>`;

/** The questions the preview shows. */
const QUESTIONS = [
	{
		id: "q1",
		question: "Does the oak frame come with glass or acrylic?",
		meta: "Asked by Lee · 3 days ago",
		answers: [
			{
				id: "a1",
				author: "The shop",
				badge: "Store",
				body: "Shatter-proof acrylic, so it ships safely and is light enough for a single nail.",
				meta: "2 days ago",
			},
			{
				id: "a2",
				author: "Priya",
				badge: "Verified buyer",
				body: "Acrylic, and you honestly can't tell from across the room.",
				meta: "Yesterday",
			},
		],
	},
	{
		id: "q2",
		question: "Is the paper matte or satin?",
		meta: "Asked by Sam · Today",
		answers: [],
	},
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "34rem" })]}>
			<QuestionList questions={QUESTIONS} labels={{ answers: "{n} answers" }} />
		</div>
	),
};
