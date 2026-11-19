/**
 * Holds the question list to its contract in a real browser: each question leads with its
 * mark and answer count, answers sit indented under it with who answered, and an empty list
 * shows its message.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { QuestionList } from "./question-list.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("QuestionList", () => {
	test("sets each question with its mark and count, and its answers indented beneath", () => {
		mounted = render(
			<QuestionList
				questions={[
					{
						id: "q1",
						question: "Does it come framed?",
						meta: "Asked by Lee",
						answers: [
							{
								id: "a1",
								author: "The shop",
								badge: "Store",
								body: "Pick a frame on the format step.",
								meta: "2 days ago",
								helpful: <button type="button">Helpful</button>,
							},
						],
					},
					{ id: "q2", question: "Is the paper matte?", answers: [] },
				]}
				labels={{ answers: "{n} answers" }}
			/>,
		);
		let questions = [...mounted.container.querySelectorAll<HTMLElement>("li[data-question]")];
		expect(questions).toHaveLength(2);
		let first = questions[0]!;
		expect(first.querySelector('[data-slot="question-list-question"]')!.textContent).toBe(
			"Q:Does it come framed?",
		);
		expect(first.querySelector('[data-slot="question-list-count"]')!.textContent).toBe("1 answers");
		let answer = first.querySelector<HTMLElement>("li[data-answer]")!;
		expect(answer.textContent).toBe(
			"A:Pick a frame on the format step.The shopStore2 days agoHelpful",
		);
		let question = first.querySelector<HTMLElement>('[data-slot="question-list-question"]')!;
		expect(answer.getBoundingClientRect().left).toBeGreaterThan(
			question.getBoundingClientRect().left,
		);
		expect(questions[1]!.querySelector("li[data-answer]")).toBeNull();
		expect(questions[1]!.textContent).toContain("0 answers");
	});

	test("shows the empty message when nobody has asked", () => {
		mounted = render(
			<QuestionList questions={[]} empty="No questions yet." labels={{ answers: "{n} answers" }} />,
		);
		expect(mounted.container.textContent).toBe("No questions yet.");
		expect(mounted.container.querySelector("ul")).toBeNull();
	});
});
