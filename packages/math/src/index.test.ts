/**
 * Specifies the TeX subset this package reads and the MathML Core it writes:
 * one assertion per construct, the display-dependent placement of limits, the
 * escaping of every serialized value, and where a failure points in the source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { MathError, parseMath, toMathML } from "./index.js";

/**
 * The presentation markup between the `<semantics>` wrapper and its TeX
 * annotation, which is the part every construct below changes.
 *
 * @param tex - The source to convert
 * @param display - Whether to convert it as a block formula
 * @returns The MathML of the formula itself
 */
function body(tex: string, display = false): string {
	let result = toMathML(tex, { display });
	if (isFailure(result)) throw result.error;
	let start = result.data.indexOf("<semantics>") + "<semantics>".length;
	let end = result.data.indexOf("<annotation");
	return result.data.slice(start, end);
}

/**
 * @param tex - Source the conversion must refuse
 * @returns The error it refused with
 */
function error(tex: string): MathError {
	let result = parseMath(tex);
	if (isSuccess(result)) throw new Error(`Converted ${tex} instead of failing`);
	return result.error;
}

describe("toMathML", () => {
	test("wraps the formula in a namespaced math element carrying its TeX", () => {
		let result = toMathML("x", { display: false });

		expect(result).toEqual({
			status: "success",
			data: '<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline"><semantics><mi>x</mi><annotation encoding="application/x-tex">x</annotation></semantics></math>',
		});
	});

	test("marks a display formula as a block", () => {
		let result = toMathML("x", { display: true });

		expect(isSuccess(result) && result.data).toContain('display="block"');
	});

	test("converts inline by default", () => {
		let result = toMathML("x");

		expect(isSuccess(result) && result.data).toContain('display="inline"');
	});

	test("escapes markup in operators and in the annotation", () => {
		let result = toMathML("a<b\\&c");

		expect(isSuccess(result) && result.data).toContain("<mo>&lt;</mo>");
		expect(isSuccess(result) && result.data).toContain(
			'<annotation encoding="application/x-tex">a&lt;b\\&amp;c</annotation>',
		);
	});
});

describe("tokens", () => {
	test("rows identifiers, operators and numbers, ignoring whitespace", () => {
		expect(body("x + 1")).toBe("<mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow>");
		expect(body("x+1")).toBe(body("x + 1"));
	});

	test("reads a decimal as one number", () => {
		expect(body("3.14")).toBe("<mn>3.14</mn>");
	});

	test("writes a hyphen as a minus sign", () => {
		expect(body("a-b")).toBe("<mrow><mi>a</mi><mo>\u2212</mo><mi>b</mi></mrow>");
	});

	test("keeps a bracket written without \\left at its natural size", () => {
		expect(body("(x)")).toBe(
			'<mrow><mo stretchy="false">(</mo><mi>x</mi><mo stretchy="false">)</mo></mrow>',
		);
		expect(body("\\{x\\}")).toBe(
			'<mrow><mo stretchy="false">{</mo><mi>x</mi><mo stretchy="false">}</mo></mrow>',
		);
	});

	test("writes a prime as the prime character", () => {
		expect(body("f'")).toBe("<mrow><mi>f</mi><mo>\u2032</mo></mrow>");
	});

	test("skips a comment to the end of its line", () => {
		expect(body("x % the unknown\n+ 1")).toBe("<mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow>");
	});

	test("unwraps a group holding one node and rows one holding several", () => {
		expect(body("{x}")).toBe("<mi>x</mi>");
		expect(body("{}")).toBe("<mrow></mrow>");
		expect(body("")).toBe("<mrow></mrow>");
	});
});

describe("scripts", () => {
	test("raises a superscript and lowers a subscript", () => {
		expect(body("x^2")).toBe("<msup><mi>x</mi><mn>2</mn></msup>");
		expect(body("x_i")).toBe("<msub><mi>x</mi><mi>i</mi></msub>");
	});

	test("takes one digit as an unbraced script, as TeX does", () => {
		expect(body("x^23")).toBe("<mrow><msup><mi>x</mi><mn>2</mn></msup><mn>3</mn></mrow>");
	});

	test("combines both scripts in either order", () => {
		let expected = "<msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup>";

		expect(body("x_i^2")).toBe(expected);
		expect(body("x^2_i")).toBe(expected);
	});

	test("scripts a braced group as one row", () => {
		expect(body("e^{i\\pi}")).toBe("<msup><mi>e</mi><mrow><mi>i</mi><mi>π</mi></mrow></msup>");
	});

	test("scripts an empty base", () => {
		expect(body("^2")).toBe("<msup><mrow></mrow><mn>2</mn></msup>");
	});
});

describe("commands", () => {
	test("builds a fraction from braced or single-token arguments", () => {
		expect(body("\\frac{a}{b}")).toBe("<mfrac><mi>a</mi><mi>b</mi></mfrac>");
		expect(body("\\frac12")).toBe("<mfrac><mn>1</mn><mn>2</mn></mfrac>");
	});

	test("builds a binomial as an unruled fraction in parentheses", () => {
		expect(body("\\binom{n}{k}")).toBe(
			'<mrow><mo form="prefix" stretchy="true">(</mo><mfrac linethickness="0"><mi>n</mi><mi>k</mi></mfrac><mo form="postfix" stretchy="true">)</mo></mrow>',
		);
	});

	test("builds a square root and an indexed root", () => {
		expect(body("\\sqrt{x}")).toBe("<msqrt><mi>x</mi></msqrt>");
		expect(body("\\sqrt[3]{x}")).toBe("<mroot><mi>x</mi><mn>3</mn></mroot>");
	});

	test("writes Greek letters, uppercase ones upright", () => {
		expect(body("\\alpha")).toBe("<mi>α</mi>");
		expect(body("\\varepsilon")).toBe("<mi>ε</mi>");
		expect(body("\\Omega")).toBe('<mi mathvariant="normal">Ω</mi>');
	});

	test("writes relations and binary operators as operators", () => {
		expect(body("a \\leq b")).toBe("<mrow><mi>a</mi><mo>≤</mo><mi>b</mi></mrow>");
		expect(body("\\cdot")).toBe("<mo>⋅</mo>");
		expect(body("\\to")).toBe("<mo>→</mo>");
		expect(body("\\Rightarrow")).toBe("<mo>⇒</mo>");
		expect(body("\\iff")).toBe("<mo>⟺</mo>");
		expect(body("\\ldots")).toBe("<mo>…</mo>");
	});

	test("writes symbols that stand for a quantity as identifiers", () => {
		expect(body("\\infty")).toBe("<mi>∞</mi>");
		expect(body("\\partial")).toBe("<mi>∂</mi>");
	});

	test("writes a function name upright, followed by function application", () => {
		expect(body("\\sin x")).toBe("<mrow><mi>sin</mi><mo>\u2061</mo><mi>x</mi></mrow>");
		expect(body("\\operatorname{rank} A")).toBe(
			"<mrow><mi>rank</mi><mo>\u2061</mo><mi>A</mi></mrow>",
		);
	});

	test("places a big operator's limits under and over it in display mode only", () => {
		expect(body("\\sum_{i=1}^n", true)).toBe(
			"<munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover>",
		);
		expect(body("\\sum_{i=1}^n")).toBe(
			"<msubsup><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></msubsup>",
		);
	});

	test("keeps an integral's limits beside it in display mode", () => {
		expect(body("\\int_0^1", true)).toBe("<msubsup><mo>∫</mo><mn>0</mn><mn>1</mn></msubsup>");
	});

	test("honors \\limits and \\nolimits", () => {
		expect(body("\\int\\limits_0^1", true)).toBe(
			"<munderover><mo>∫</mo><mn>0</mn><mn>1</mn></munderover>",
		);
		expect(body("\\sum\\nolimits_i", true)).toBe("<msub><mo>∑</mo><mi>i</mi></msub>");
	});

	test("places a limit's subscript under it in display mode, then applies it", () => {
		expect(body("\\lim_{x\\to0} f", true)).toBe(
			"<mrow><munder><mi>lim</mi><mrow><mi>x</mi><mo>→</mo><mn>0</mn></mrow></munder><mo>\u2061</mo><mi>f</mi></mrow>",
		);
		expect(body("\\lim_n")).toBe("<mrow><msub><mi>lim</mi><mi>n</mi></msub><mo>\u2061</mo></mrow>");
	});

	test("stretches \\left and \\right delimiters around their content", () => {
		expect(body("\\left( x \\right)")).toBe(
			'<mrow><mo form="prefix" stretchy="true">(</mo><mi>x</mi><mo form="postfix" stretchy="true">)</mo></mrow>',
		);
		expect(body("\\left. x \\right|")).toBe(
			'<mrow><mi>x</mi><mo form="postfix" stretchy="true">|</mo></mrow>',
		);
		expect(body("\\left\\langle x \\right\\rangle")).toBe(
			'<mrow><mo form="prefix" stretchy="true">⟨</mo><mi>x</mi><mo form="postfix" stretchy="true">⟩</mo></mrow>',
		);
	});

	test("writes text verbatim, keeping its edge spaces", () => {
		expect(body("\\text{if } x")).toBe("<mrow><mtext>if\u00A0</mtext><mi>x</mi></mrow>");
		expect(body("\\text{a {b} \\$}")).toBe("<mtext>a {b} $</mtext>");
	});

	test("restyles letters with \\mathrm, \\mathbf, \\mathit and \\mathbb", () => {
		expect(body("\\mathrm{d}")).toBe('<mi mathvariant="normal">d</mi>');
		expect(body("\\mathrm{max}")).toBe("<mi>max</mi>");
		expect(body("\\mathbf{v}")).toBe("<mi>𝐯</mi>");
		expect(body("\\mathbf{F1}")).toBe("<mrow><mi>𝐅</mi><mn>𝟏</mn></mrow>");
		expect(body("\\mathit{h}")).toBe("<mi>ℎ</mi>");
		expect(body("\\mathbb{R}")).toBe("<mi>ℝ</mi>");
		expect(body("\\mathbb{A}")).toBe("<mi>𝔸</mi>");
	});

	test("puts an accent over its base", () => {
		expect(body("\\hat{x}")).toBe('<mover accent="true"><mi>x</mi><mo>^</mo></mover>');
		expect(body("\\vec v")).toBe('<mover accent="true"><mi>v</mi><mo>→</mo></mover>');
	});

	test("spaces with the TeX widths", () => {
		expect(body("a\\,b")).toBe(
			'<mrow><mi>a</mi><mspace width="0.1667em"></mspace><mi>b</mi></mrow>',
		);
		expect(body("\\;")).toBe('<mspace width="0.2778em"></mspace>');
		expect(body("\\quad")).toBe('<mspace width="1em"></mspace>');
		expect(body("\\qquad")).toBe('<mspace width="2em"></mspace>');
	});
});

describe("environments", () => {
	test("lays out a matrix as a table", () => {
		expect(body("\\begin{matrix} a & b \\\\ c & d \\end{matrix}")).toBe(
			"<mtable><mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr><mtr><mtd><mi>c</mi></mtd><mtd><mi>d</mi></mtd></mtr></mtable>",
		);
	});

	test("fences a pmatrix and a bmatrix with stretched delimiters", () => {
		expect(body("\\begin{pmatrix} a \\end{pmatrix}")).toBe(
			'<mrow><mo form="prefix" stretchy="true">(</mo><mtable><mtr><mtd><mi>a</mi></mtd></mtr></mtable><mo form="postfix" stretchy="true">)</mo></mrow>',
		);
		expect(body("\\begin{bmatrix} a \\end{bmatrix}")).toContain(
			'<mo form="prefix" stretchy="true">[</mo>',
		);
		expect(body("\\begin{vmatrix} a \\end{vmatrix}")).toContain(
			'<mo form="postfix" stretchy="true">|</mo>',
		);
	});

	test("drops the empty row a trailing line break leaves", () => {
		expect(body("\\begin{matrix} a \\\\ \\end{matrix}")).toBe(
			"<mtable><mtr><mtd><mi>a</mi></mtd></mtr></mtable>",
		);
	});

	test("left-aligns cases behind an opening brace", () => {
		expect(body("\\begin{cases} 1 & x \\\\ 0 & y \\end{cases}")).toBe(
			'<mrow><mo form="prefix" stretchy="true">{</mo><mtable columnalign="left left"><mtr><mtd><mn>1</mn></mtd><mtd><mi>x</mi></mtd></mtr><mtr><mtd><mn>0</mn></mtd><mtd><mi>y</mi></mtd></mtr></mtable></mrow>',
		);
	});
});

describe("parseMath", () => {
	test("returns a JSON tree rooted at the math element", () => {
		let result = parseMath("x^2", { display: true });
		if (isFailure(result)) throw result.error;

		expect(result.data).toEqual({
			type: "element",
			name: "math",
			attributes: { xmlns: "http://www.w3.org/1998/Math/MathML", display: "block" },
			children: [
				{
					type: "element",
					name: "semantics",
					attributes: {},
					children: [
						{
							type: "element",
							name: "msup",
							attributes: {},
							children: [
								{
									type: "element",
									name: "mi",
									attributes: {},
									children: [{ type: "text", value: "x" }],
								},
								{
									type: "element",
									name: "mn",
									attributes: {},
									children: [{ type: "text", value: "2" }],
								},
							],
						},
						{
							type: "element",
							name: "annotation",
							attributes: { encoding: "application/x-tex" },
							children: [{ type: "text", value: "x^2" }],
						},
					],
				},
			],
		});
		expect(JSON.parse(JSON.stringify(result.data))).toEqual(result.data);
	});
});

describe("errors", () => {
	test("names an unknown command and where it starts", () => {
		let failure = error("a + \\foo");

		expect(failure).toBeInstanceOf(MathError);
		expect(failure.message).toBe("Unknown command \\foo at 1:5");
		expect(failure.index).toBe(4);
		expect(failure.line).toBe(1);
		expect(failure.column).toBe(5);
	});

	test("counts lines in a multi-line formula", () => {
		let failure = error("a\n+ \\foo");

		expect(failure.line).toBe(2);
		expect(failure.column).toBe(3);
	});

	test("refuses an unknown environment", () => {
		expect(error("\\begin{align} x \\end{align}").message).toBe("Unknown environment align at 1:1");
	});

	test("refuses an environment closed under another name", () => {
		expect(error("\\begin{matrix} a \\end{pmatrix}").message).toBe(
			"\\begin{matrix} ended by \\end{pmatrix} at 1:18",
		);
	});

	test("refuses a cell or row separator outside an environment", () => {
		expect(error("a & b").message).toBe("& is only allowed inside an environment at 1:3");
		expect(error("a \\\\ b").message).toBe("\\\\ is only allowed inside an environment at 1:3");
	});

	test("refuses unbalanced groups", () => {
		expect(error("{x").message).toBe("Expected } at 1:3");
		expect(error("x}").message).toBe("Unexpected } at 1:2");
	});

	test("refuses a script with nothing to raise", () => {
		expect(error("x^").message).toBe("Expected an argument at 1:3");
	});

	test("refuses a doubled script", () => {
		expect(error("x^a^b").message).toBe("Double superscript at 1:4");
		expect(error("x_a_b").message).toBe("Double subscript at 1:4");
	});

	test("refuses \\left without \\right and \\right without \\left", () => {
		expect(error("\\left( x").message).toBe("Expected \\right at 1:9");
		expect(error("x \\right)").message).toBe("Unexpected \\right at 1:3");
	});

	test("refuses a delimiter it does not know", () => {
		expect(error("\\left x \\right)").message).toBe("Unknown delimiter x at 1:7");
	});

	test("refuses a character TeX math has no meaning for", () => {
		expect(error("a # b").message).toBe("Unexpected character # at 1:3");
	});
});
