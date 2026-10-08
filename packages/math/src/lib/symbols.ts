/**
 * The vocabulary the parser recognizes: what each command and character turns
 * into. Kept as data apart from the grammar, so supporting another symbol is a
 * table row and never a parser change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Where a big operator's scripts go: under and over it in display mode, or always beside it. */
export type Limits = "display" | "always" | "never";

/**
 * Lowercase Greek, written as `mi` so the browser italicizes it. `\epsilon` and
 * `\phi` are the lunate and stroked forms TeX draws, and `\var…` the others.
 */
export const GREEK_LOWER: Record<string, string> = {
	"\\alpha": "α",
	"\\beta": "β",
	"\\gamma": "γ",
	"\\delta": "δ",
	"\\epsilon": "ϵ",
	"\\varepsilon": "ε",
	"\\zeta": "ζ",
	"\\eta": "η",
	"\\theta": "θ",
	"\\vartheta": "ϑ",
	"\\iota": "ι",
	"\\kappa": "κ",
	"\\lambda": "λ",
	"\\mu": "μ",
	"\\nu": "ν",
	"\\xi": "ξ",
	"\\omicron": "ο",
	"\\pi": "π",
	"\\varpi": "ϖ",
	"\\rho": "ρ",
	"\\varrho": "ϱ",
	"\\sigma": "σ",
	"\\varsigma": "ς",
	"\\tau": "τ",
	"\\upsilon": "υ",
	"\\phi": "ϕ",
	"\\varphi": "φ",
	"\\chi": "χ",
	"\\psi": "ψ",
	"\\omega": "ω",
};

/** Uppercase Greek, which TeX sets upright, so each carries `mathvariant="normal"`. */
export const GREEK_UPPER: Record<string, string> = {
	"\\Gamma": "Γ",
	"\\Delta": "Δ",
	"\\Theta": "Θ",
	"\\Lambda": "Λ",
	"\\Xi": "Ξ",
	"\\Pi": "Π",
	"\\Sigma": "Σ",
	"\\Upsilon": "Υ",
	"\\Phi": "Φ",
	"\\Psi": "Ψ",
	"\\Omega": "Ω",
};

/** Symbol commands: operators, relations and arrows as `mo`, quantities as `mi`. */
export const SYMBOLS: Record<string, { value: string; element: "mo" | "mi" }> = {
	"\\cdot": { value: "⋅", element: "mo" },
	"\\times": { value: "×", element: "mo" },
	"\\div": { value: "÷", element: "mo" },
	"\\pm": { value: "±", element: "mo" },
	"\\mp": { value: "∓", element: "mo" },
	"\\ast": { value: "∗", element: "mo" },
	"\\star": { value: "⋆", element: "mo" },
	"\\circ": { value: "∘", element: "mo" },
	"\\bullet": { value: "∙", element: "mo" },
	"\\oplus": { value: "⊕", element: "mo" },
	"\\otimes": { value: "⊗", element: "mo" },
	"\\leq": { value: "≤", element: "mo" },
	"\\le": { value: "≤", element: "mo" },
	"\\geq": { value: "≥", element: "mo" },
	"\\ge": { value: "≥", element: "mo" },
	"\\neq": { value: "≠", element: "mo" },
	"\\ne": { value: "≠", element: "mo" },
	"\\approx": { value: "≈", element: "mo" },
	"\\equiv": { value: "≡", element: "mo" },
	"\\sim": { value: "∼", element: "mo" },
	"\\simeq": { value: "≃", element: "mo" },
	"\\cong": { value: "≅", element: "mo" },
	"\\propto": { value: "∝", element: "mo" },
	"\\ll": { value: "≪", element: "mo" },
	"\\gg": { value: "≫", element: "mo" },
	"\\in": { value: "∈", element: "mo" },
	"\\notin": { value: "∉", element: "mo" },
	"\\ni": { value: "∋", element: "mo" },
	"\\subset": { value: "⊂", element: "mo" },
	"\\supset": { value: "⊃", element: "mo" },
	"\\subseteq": { value: "⊆", element: "mo" },
	"\\supseteq": { value: "⊇", element: "mo" },
	"\\cup": { value: "∪", element: "mo" },
	"\\cap": { value: "∩", element: "mo" },
	"\\setminus": { value: "∖", element: "mo" },
	"\\wedge": { value: "∧", element: "mo" },
	"\\land": { value: "∧", element: "mo" },
	"\\vee": { value: "∨", element: "mo" },
	"\\lor": { value: "∨", element: "mo" },
	"\\neg": { value: "¬", element: "mo" },
	"\\lnot": { value: "¬", element: "mo" },
	"\\to": { value: "→", element: "mo" },
	"\\rightarrow": { value: "→", element: "mo" },
	"\\leftarrow": { value: "←", element: "mo" },
	"\\gets": { value: "←", element: "mo" },
	"\\leftrightarrow": { value: "↔", element: "mo" },
	"\\longrightarrow": { value: "⟶", element: "mo" },
	"\\longleftarrow": { value: "⟵", element: "mo" },
	"\\Rightarrow": { value: "⇒", element: "mo" },
	"\\Leftarrow": { value: "⇐", element: "mo" },
	"\\Leftrightarrow": { value: "⇔", element: "mo" },
	"\\implies": { value: "⟹", element: "mo" },
	"\\impliedby": { value: "⟸", element: "mo" },
	"\\iff": { value: "⟺", element: "mo" },
	"\\mapsto": { value: "↦", element: "mo" },
	"\\uparrow": { value: "↑", element: "mo" },
	"\\downarrow": { value: "↓", element: "mo" },
	"\\forall": { value: "∀", element: "mo" },
	"\\exists": { value: "∃", element: "mo" },
	"\\nexists": { value: "∄", element: "mo" },
	"\\ldots": { value: "…", element: "mo" },
	"\\dots": { value: "…", element: "mo" },
	"\\cdots": { value: "⋯", element: "mo" },
	"\\vdots": { value: "⋮", element: "mo" },
	"\\ddots": { value: "⋱", element: "mo" },
	"\\mid": { value: "∣", element: "mo" },
	"\\parallel": { value: "∥", element: "mo" },
	"\\perp": { value: "⊥", element: "mo" },
	"\\colon": { value: ":", element: "mo" },
	"\\prime": { value: "′", element: "mo" },
	"\\%": { value: "%", element: "mo" },
	"\\#": { value: "#", element: "mo" },
	"\\&": { value: "&", element: "mo" },
	"\\$": { value: "$", element: "mi" },
	"\\_": { value: "_", element: "mi" },
	"\\infty": { value: "∞", element: "mi" },
	"\\partial": { value: "∂", element: "mi" },
	"\\nabla": { value: "∇", element: "mi" },
	"\\emptyset": { value: "∅", element: "mi" },
	"\\varnothing": { value: "∅", element: "mi" },
	"\\hbar": { value: "ℏ", element: "mi" },
	"\\ell": { value: "ℓ", element: "mi" },
	"\\Re": { value: "ℜ", element: "mi" },
	"\\Im": { value: "ℑ", element: "mi" },
	"\\aleph": { value: "ℵ", element: "mi" },
	"\\angle": { value: "∠", element: "mi" },
};

/** Delimiter commands, usable bare at their natural size or after `\left` and `\right`. */
export const DELIMITER_COMMANDS: Record<string, string> = {
	"\\{": "{",
	"\\}": "}",
	"\\lbrace": "{",
	"\\rbrace": "}",
	"\\langle": "⟨",
	"\\rangle": "⟩",
	"\\vert": "|",
	"\\lvert": "|",
	"\\rvert": "|",
	"\\|": "‖",
	"\\Vert": "‖",
	"\\lVert": "‖",
	"\\rVert": "‖",
	"\\lfloor": "⌊",
	"\\rfloor": "⌋",
	"\\lceil": "⌈",
	"\\rceil": "⌉",
};

/** Characters that fence content; written bare, each keeps its natural size. */
export const DELIMITER_CHARACTERS = new Set(["(", ")", "[", "]", "|"]);

/**
 * Operator characters, mapped to the character MathML should show: a hyphen is
 * a minus sign and an asterisk an asterisk operator, as TeX draws them.
 */
export const OPERATOR_CHARACTERS: Record<string, string> = {
	"+": "+",
	"-": "−",
	"=": "=",
	"<": "<",
	">": ">",
	",": ",",
	";": ";",
	":": ":",
	"!": "!",
	"?": "?",
	"/": "/",
	"*": "∗",
	".": ".",
	"'": "′",
	"@": "@",
};

/** Operators whose scripts can become limits, with where those limits go by default. */
export const BIG_OPERATORS: Record<string, { value: string; limits: Limits }> = {
	"\\sum": { value: "∑", limits: "display" },
	"\\prod": { value: "∏", limits: "display" },
	"\\coprod": { value: "∐", limits: "display" },
	"\\bigcup": { value: "⋃", limits: "display" },
	"\\bigcap": { value: "⋂", limits: "display" },
	"\\bigoplus": { value: "⨁", limits: "display" },
	"\\bigotimes": { value: "⨂", limits: "display" },
	"\\bigvee": { value: "⋁", limits: "display" },
	"\\bigwedge": { value: "⋀", limits: "display" },
	"\\int": { value: "∫", limits: "never" },
	"\\iint": { value: "∬", limits: "never" },
	"\\iiint": { value: "∭", limits: "never" },
	"\\oint": { value: "∮", limits: "never" },
};

/**
 * Named functions, written upright and followed by function application. The
 * ones that take limits in TeX — `\lim`, `\max` — set their subscript under them
 * in display mode.
 */
export const FUNCTIONS: Record<string, { limits?: Limits }> = {
	"\\sin": {},
	"\\cos": {},
	"\\tan": {},
	"\\cot": {},
	"\\sec": {},
	"\\csc": {},
	"\\arcsin": {},
	"\\arccos": {},
	"\\arctan": {},
	"\\sinh": {},
	"\\cosh": {},
	"\\tanh": {},
	"\\coth": {},
	"\\log": {},
	"\\ln": {},
	"\\lg": {},
	"\\exp": {},
	"\\dim": {},
	"\\deg": {},
	"\\ker": {},
	"\\hom": {},
	"\\arg": {},
	"\\det": { limits: "display" },
	"\\gcd": { limits: "display" },
	"\\max": { limits: "display" },
	"\\min": { limits: "display" },
	"\\sup": { limits: "display" },
	"\\inf": { limits: "display" },
	"\\lim": { limits: "display" },
	"\\Pr": { limits: "display" },
};

/** Spacing commands at TeX's widths, in em so they scale with the formula. */
export const SPACES: Record<string, string> = {
	"\\,": "0.1667em",
	"\\:": "0.2222em",
	"\\>": "0.2222em",
	"\\;": "0.2778em",
	"\\!": "-0.1667em",
	"\\enspace": "0.5em",
	"\\quad": "1em",
	"\\qquad": "2em",
};

/** Accents, each drawn as an `mover` over the argument. */
export const ACCENTS: Record<string, string> = {
	"\\hat": "^",
	"\\bar": "¯",
	"\\vec": "→",
	"\\tilde": "~",
	"\\dot": "˙",
	"\\ddot": "¨",
};

/** Font commands, keyed to the style the argument's letters take. */
export const FONTS: Record<string, "normal" | "bold" | "italic" | "double-struck"> = {
	"\\mathrm": "normal",
	"\\mathbf": "bold",
	"\\mathit": "italic",
	"\\mathbb": "double-struck",
};

/**
 * The environments `\begin` accepts. Each lays its cells out as an `mtable`,
 * fenced by stretched delimiters where the environment draws them.
 */
export const ENVIRONMENTS: Record<string, { open?: string; close?: string; columnalign?: string }> =
	{
		matrix: {},
		pmatrix: { open: "(", close: ")" },
		bmatrix: { open: "[", close: "]" },
		Bmatrix: { open: "{", close: "}" },
		vmatrix: { open: "|", close: "|" },
		Vmatrix: { open: "‖", close: "‖" },
		cases: { open: "{", columnalign: "left left" },
	};
