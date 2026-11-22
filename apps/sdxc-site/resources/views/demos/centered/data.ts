/**
 * Centered's one world: the six modules and their lessons, the lesson the player previews
 * with its chapters and transcript, and the figures the page counts from them, so every band
 * quotes the same course and no total is typed by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One lesson: its title, its length in seconds, and whether anyone may watch it free. */
export interface Lesson {
	title: string;
	seconds: number;
	free?: boolean;
}

/** The shape a module teaches toward, drawn as its silhouette on the path. */
export type PotShape = "ball" | "dome" | "cylinder" | "bowl" | "mug" | "jar";

/** One module: its lessons and what a student can make once it is done. */
export interface Module {
	title: string;
	/** What the module leaves you able to do, said as the skill. */
	outcome: string;
	/** The piece that proves it. */
	piece: string;
	shape: PotShape;
	lessons: readonly Lesson[];
}

/** The course in teaching order; lesson numbers run on across modules. */
export const MODULES: readonly Module[] = [
	{
		title: "Clay and the wheel",
		outcome: "Wedge two kilos and set up a wheel that works with you",
		piece: "A wedged, air-free ball",
		shape: "ball",
		lessons: [
			{ title: "The studio, and the six tools that matter", seconds: 492, free: true },
			{ title: "Reading clay: moisture, grog and plasticity", seconds: 580 },
			{ title: "Wedging: ram's head and spiral", seconds: 725, free: true },
			{ title: "Wheel speed, splash and posture", seconds: 478 },
		],
	},
	{
		title: "Centering",
		outcome: "Center a kilo in under two minutes, every time",
		piece: "A still dome that does not wobble",
		shape: "dome",
		lessons: [
			{ title: "Coning up and coning down", seconds: 622 },
			{ title: "Bracing: elbows, hips and breath", seconds: 527 },
			{ title: "Centering 3 kg", seconds: 703, free: true },
			{ title: "Diagnosing a wobble", seconds: 545 },
		],
	},
	{
		title: "Opening and pulling",
		outcome: "Throw a straight 15 cm cylinder with even walls",
		piece: "A cylinder you can cut in half",
		shape: "cylinder",
		lessons: [
			{ title: "Opening to a flat floor", seconds: 610 },
			{ title: "Compressing the floor", seconds: 394 },
			{ title: "First pull, third pull", seconds: 800, free: true },
			{ title: "Cutting a cylinder in half", seconds: 461 },
		],
	},
	{
		title: "Shaping",
		outcome: "Turn a cylinder into a bowl, a belly or a neck",
		piece: "A bowl with an even curve",
		shape: "bowl",
		lessons: [
			{ title: "Bowls, shaped from the inside", seconds: 768 },
			{ title: "Bellying out without a collapse", seconds: 662 },
			{ title: "Collaring a neck", seconds: 576 },
			{ title: "Rims that do not crack", seconds: 505, free: true },
		],
	},
	{
		title: "Trimming and handles",
		outcome: "Trim a foot ring and pull a handle that stays on",
		piece: "A mug that holds coffee",
		shape: "mug",
		lessons: [
			{ title: "Leather-hard, and when to trim", seconds: 410 },
			{ title: "Tapping a pot onto center", seconds: 494 },
			{ title: "Trimming a foot ring", seconds: 845 },
			{ title: "Pulling and attaching handles", seconds: 792, free: true },
		],
	},
	{
		title: "Lids and sets",
		outcome: "Throw a lidded jar whose lid fits the gallery",
		piece: "A lidded jar",
		shape: "jar",
		lessons: [
			{ title: "Measuring with calipers", seconds: 440 },
			{ title: "Throwing a flanged gallery", seconds: 756 },
			{ title: "The lid, thrown upside down", seconds: 714 },
			{ title: "Four mugs that match", seconds: 918 },
		],
	},
];

/** Every lesson in order, with its course-wide number and its module's number. */
export const LESSONS = MODULES.flatMap((module, moduleIndex) =>
	module.lessons.map((lesson) => ({ ...lesson, module: moduleIndex + 1 })),
).map((lesson, index) => ({ ...lesson, number: index + 1 }));

/** Total running time of the course, in seconds. */
export const TOTAL_SECONDS = LESSONS.reduce((sum, lesson) => sum + lesson.seconds, 0);

/** How many lessons anyone may watch before paying. */
export const FREE_LESSONS = LESSONS.filter((lesson) => lesson.free).length;

/**
 * Writes a length as the curriculum prints it.
 *
 * @param seconds A length in seconds.
 * @returns `m:ss` under an hour, otherwise hours and minutes such as `5 h 37 min`.
 */
export function formatLength(seconds: number): string {
	if (seconds >= 3600) {
		return `${Math.floor(seconds / 3600)} h ${Math.round((seconds % 3600) / 60)} min`;
	}
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Writes a module's total in whole minutes.
 *
 * @param module The module to total.
 * @returns Such as `39 min`.
 */
export function moduleMinutes(module: Module): string {
	return `${Math.round(module.lessons.reduce((sum, lesson) => sum + lesson.seconds, 0) / 60)} min`;
}

/** The lesson the hero's player previews: module 2, lesson 7, free to watch. */
export const PREVIEW = LESSONS.find((lesson) => lesson.title === "Centering 3 kg")!;

/** The lesson after the preview, for the player's "up next" card. */
export const NEXT = LESSONS[PREVIEW.number]!;

/** Where the clay stands in a chapter's frame, so each chapter's still shows its own moment. */
export type ClayState = "lump" | "cone-up" | "cone-down" | "brace" | "still" | "wobble" | "dome";

/** One chapter of the previewed lesson. */
export interface Chapter {
	start: number;
	title: string;
	clay: ClayState;
}

/** The previewed lesson's chapters, the last ending at the lesson's length. */
export const CHAPTERS: readonly Chapter[] = [
	{ start: 0, title: "Why 3 kg is different", clay: "lump" },
	{ start: 72, title: "Coning up", clay: "cone-up" },
	{ start: 185, title: "Coning down", clay: "cone-down" },
	{ start: 280, title: "Bracing against the pan", clay: "brace" },
	{ start: 418, title: "Checking with a still finger", clay: "still" },
	{ start: 510, title: "When it still wobbles", clay: "wobble" },
	{ start: 620, title: "Recap and a practice plan", clay: "dome" },
];

/** The previewed lesson's transcript, line by line. */
export const TRANSCRIPT: readonly { start: number; text: string }[] = [
	{
		start: 0,
		text: "Everything you threw last module was a kilo. Today it's three, and it pushes back.",
	},
	{ start: 38, text: "More clay means more wobble to remove, so we slow the wheel down, not up." },
	{ start: 72, text: "Wet your hands, squeeze from the base, and let the clay rise into a cone." },
	{ start: 130, text: "Keep the cone narrow. If the tip spirals, the wheel is too fast." },
	{
		start: 185,
		text: "Now the heel of your right hand comes over the top and presses it back down.",
	},
	{ start: 236, text: "Twice up and twice down is enough. More just tires the clay." },
	{ start: 280, text: "Lock your left elbow into your hip. The wheel moves the clay, not you." },
	{
		start: 350,
		text: "Breathe out as you push in. It sounds silly, and it is the thing that works.",
	},
	{ start: 418, text: "Take your hands off. Rest one finger on the side and watch the gap." },
	{
		start: 447,
		text: "If the gap stays the same as it spins, you're centered. If it flickers, go again.",
	},
	{
		start: 510,
		text: "Most wobble at three kilos lives at the base, so start your next pass lower.",
	},
	{
		start: 566,
		text: "Still wobbling after three passes? Cut it off and rewedge. That isn't failure.",
	},
	{ start: 620, text: "Center this five times before the next lesson, and time each one." },
	{ start: 668, text: "Next, we film five wobbles up close and name what causes each one." },
];

/** The moment the preview renders as playing: just past "Checking with a still finger". */
export const NOW = 431;

/**
 * How many of the 2,314 students who started between January and June 2025 finished each
 * module, as a share of those who started. Self-paced and cohort students together.
 */
export const COMPLETION: readonly { module: number; percent: number }[] = [
	{ module: 1, percent: 92 },
	{ module: 2, percent: 78 },
	{ module: 3, percent: 64 },
	{ module: 4, percent: 55 },
	{ module: 5, percent: 48 },
	{ module: 6, percent: 41 },
];

/** Students in the cohort {@link COMPLETION} counts. */
export const COHORT_SIZE = 2314;
