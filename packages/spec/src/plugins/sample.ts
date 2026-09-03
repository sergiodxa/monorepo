/**
 * The built-in `sample` capability: generated input for a spec that needs a
 * name, an address, or fifty of something, without a literal typed into the
 * suite. Every tool draws from the test's own stream, so the same test sees
 * the same values on every run whatever else the suite is doing.
 *
 * A call target carries at most one dot, so a module reaches a spec as one
 * zero-argument tool returning every field that module generates —
 * `let who = sample.person` then `who.job_title`. Generators that need an
 * argument keep a tool of their own. Fields are named the way a spec names
 * things, in snake case.
 *
 * The tools are actions rather than observations: a draw advances the stream,
 * and polling `eventually` until a random value matches is never what an
 * author meant. None needs a permission — generation is computation, reaching
 * nothing outside the process.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";
import type { Sample } from "@pkg/sample";

import { failure, success } from "@pkg/result";
import { createSample } from "@pkg/sample";

import type { SpecError } from "../errors";
import type { Plugin, ToolContext, ToolDescriptor } from "../plugin";
import type { ToolArg, Value, ValueObject } from "../values";

import { ToolError } from "../errors";

/** One module, as the record a spec binds and reads fields off. */
const MODULE_TOOLS = [
	"person",
	"internet",
	"location",
	"company",
	"lorem",
	"date",
	"string",
	"number",
	"color",
	"datatype",
	"git",
	"hacker",
	"phone",
	"system",
] as const;

/** The generators that need an argument, plus the two shortest shortcuts. */
const CALL_TOOLS = ["email", "uuid", "int", "float", "words", "pick"] as const;

type ModuleTool = (typeof MODULE_TOOLS)[number];

type CallTool = (typeof CALL_TOOLS)[number];

type SampleTool = ModuleTool | CallTool;

/** One line of documentation per module tool, shown in diagnostics. */
const MODULE_SUMMARIES: Record<ModuleTool, string> = {
	person: "A person: names, titles, sex, job, contact details.",
	internet: "Addresses, handles, links, and protocol values.",
	location: "A place: country, city, street, postcode, coordinates.",
	company: "A company name and the phrases around it.",
	lorem: "Placeholder prose in every shape.",
	date: "Instants around the test's own start time, as ISO timestamps.",
	string: "Identifiers and character runs.",
	number: "Numbers, in every base.",
	color: "A color, as a name and in each notation.",
	datatype: "A boolean.",
	git: "A branch, a hash, a message, a whole log entry.",
	hacker: "Technical-sounding filler.",
	phone: "A phone number in each format, and an IMEI.",
	system: "File names, paths, types, and machine identifiers.",
};

const DESCRIPTORS: ToolDescriptor[] = [
	...MODULE_TOOLS.map((name) => ({
		name,
		summary: MODULE_SUMMARIES[name],
		kind: "action" as const,
		params: [],
	})),
	{
		name: "email",
		summary: "An email address on a domain reserved for documentation.",
		kind: "action",
		params: [],
	},
	{
		name: "uuid",
		summary: "A version 4 UUID, drawn from the test's stream.",
		kind: "action",
		params: [],
	},
	{
		name: "int",
		summary: "An integer between two bounds, both included.",
		kind: "action",
		params: [
			{ name: "min", kind: "value", required: true, summary: "Lowest value, included." },
			{ name: "max", kind: "value", required: true, summary: "Highest value, included." },
		],
	},
	{
		name: "float",
		summary: "A number between two bounds, with two decimals.",
		kind: "action",
		params: [
			{ name: "min", kind: "value", required: true, summary: "Lowest value, included." },
			{ name: "max", kind: "value", required: true, summary: "Highest value, excluded." },
		],
	},
	{
		name: "words",
		summary: "Placeholder prose of a given number of words.",
		kind: "action",
		params: [
			{ name: "count", kind: "value", required: true, summary: "How many words to return." },
		],
	},
	{
		name: "pick",
		summary: "One element of a list.",
		kind: "action",
		params: [{ name: "list", kind: "value", required: true, summary: "The list to pick from." }],
	},
];

/**
 * Create the built-in `sample` plugin (namespace `"sample"`). Values come from
 * the stream on the call's context, so two runs of one test generate the same
 * data and two tests never draw from each other's stream.
 */
export function createSamplePlugin(): Plugin {
	return {
		namespace: "sample",
		describe() {
			return DESCRIPTORS;
		},
		async call(tool, args, context) {
			if (!isSampleTool(tool)) {
				let available = [...MODULE_TOOLS, ...CALL_TOOLS].join(", ");
				return failure(
					new ToolError(`sample has no tool "${tool}"; available tools: ${available}`),
				);
			}
			return generate(tool, args, context);
		},
	};
}

function isSampleTool(tool: string): tool is SampleTool {
	return (
		(MODULE_TOOLS as readonly string[]).includes(tool) ||
		(CALL_TOOLS as readonly string[]).includes(tool)
	);
}

function isModuleTool(tool: SampleTool): tool is ModuleTool {
	return (MODULE_TOOLS as readonly string[]).includes(tool);
}

/**
 * Run one tool against the test's stream. The generator throws a `RangeError`
 * on a bound it cannot honor; every throw becomes a `ToolError` naming the
 * tool, since a plugin reports failure as a result rather than an exception.
 */
function generate(
	tool: SampleTool,
	args: ToolArg[],
	context: ToolContext,
): Result<Value, SpecError> {
	let sample = createSample({ seed: context.random, now: context.now });
	try {
		if (isModuleTool(tool)) return success(record(tool, sample));
		if (tool === "email") return success(sample.internet.email());
		if (tool === "uuid") return success(sample.string.uuid());
		if (tool === "int") {
			let min = readNumber(args, 0);
			if (min === undefined) return numberError(tool, "min");
			let max = readNumber(args, 1);
			if (max === undefined) return numberError(tool, "max");
			return success(sample.number.int({ min, max }));
		}
		if (tool === "float") {
			let min = readNumber(args, 0);
			if (min === undefined) return numberError(tool, "min");
			let max = readNumber(args, 1);
			if (max === undefined) return numberError(tool, "max");
			return success(sample.number.float({ min, max }));
		}
		if (tool === "words") {
			let count = readNumber(args, 0);
			if (count === undefined) return numberError(tool, "count");
			return success(sample.lorem.words(count));
		}
		let list = args[0];
		if (list === undefined || list.kind !== "value" || !Array.isArray(list.value)) {
			return failure(new ToolError("sample.pick needs a list to pick from."));
		}
		if (list.value.length === 0) {
			return failure(new ToolError("sample.pick needs a list with at least one item."));
		}
		return success(sample.helpers.pick(list.value));
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return failure(new ToolError(`sample.${tool} could not generate a value: ${reason}`));
	}
}

/** Build one module's record, every field named as a spec names things. */
function record(tool: ModuleTool, sample: Sample): ValueObject {
	if (tool === "person") {
		let person = sample.person.record();
		return {
			first_name: person.firstName,
			last_name: person.lastName,
			middle_name: sample.person.middleName(),
			full_name: person.fullName,
			prefix: sample.person.prefix(),
			suffix: sample.person.suffix(),
			sex: person.sex,
			gender: sample.person.gender(),
			zodiac_sign: sample.person.zodiacSign(),
			job_area: sample.person.jobArea(),
			job_descriptor: sample.person.jobDescriptor(),
			job_type: sample.person.jobType(),
			job_title: person.jobTitle,
			bio: sample.person.bio(),
			email: person.email,
			username: person.username,
			phone: person.phone,
		};
	}
	if (tool === "internet") {
		return {
			email: sample.internet.email(),
			username: sample.internet.username(),
			display_name: sample.internet.displayName(),
			domain_name: sample.internet.domainName(),
			domain_suffix: sample.internet.domainSuffix(),
			domain_word: sample.internet.domainWord(),
			url: sample.internet.url(),
			password: sample.internet.password(),
			emoji: sample.internet.emoji(),
			http_method: sample.internet.httpMethod(),
			http_status_code: sample.internet.httpStatusCode(),
			ip: sample.internet.ip(),
			ipv4: sample.internet.ipv4(),
			ipv6: sample.internet.ipv6(),
			mac: sample.internet.mac(),
			port: sample.internet.port(),
			protocol: sample.internet.protocol(),
			jwt: sample.internet.jwt(),
			jwt_algorithm: sample.internet.jwtAlgorithm(),
			user_agent: sample.internet.userAgent(),
		};
	}
	if (tool === "location") {
		/**
		 * Built from one set of parts rather than field by field, so a spec that
		 * reads the country and the postal address off the same record sees one
		 * place rather than two.
		 */
		let country = sample.location.country();
		let city = sample.location.city({ country });
		let streetAddress = sample.location.streetAddress();
		let zipCode = sample.location.zipCode();
		return {
			country,
			city,
			country_code: sample.location.countryCode(),
			continent: sample.location.continent(),
			state: sample.location.state(),
			state_abbreviation: sample.location.state({ abbreviated: true }),
			county: sample.location.county(),
			street: sample.location.street(),
			building_number: sample.location.buildingNumber(),
			street_address: streetAddress,
			secondary_address: sample.location.secondaryAddress(),
			zip_code: zipCode,
			postal_address: `${streetAddress}, ${city} ${zipCode}, ${country}`,
			direction: sample.location.direction(),
			cardinal_direction: sample.location.cardinalDirection(),
			ordinal_direction: sample.location.ordinalDirection(),
			language: sample.location.language(),
			time_zone: sample.location.timeZone(),
			latitude: sample.location.latitude(),
			longitude: sample.location.longitude(),
		};
	}
	if (tool === "company") {
		return {
			name: sample.company.name(),
			catch_phrase: sample.company.catchPhrase(),
			catch_phrase_adjective: sample.company.catchPhraseAdjective(),
			catch_phrase_descriptor: sample.company.catchPhraseDescriptor(),
			catch_phrase_noun: sample.company.catchPhraseNoun(),
			buzz_phrase: sample.company.buzzPhrase(),
			buzz_adjective: sample.company.buzzAdjective(),
			buzz_noun: sample.company.buzzNoun(),
			buzz_verb: sample.company.buzzVerb(),
		};
	}
	if (tool === "lorem") {
		return {
			word: sample.lorem.word(),
			words: sample.lorem.words(5),
			sentence: sample.lorem.sentence(),
			paragraph: sample.lorem.paragraph(),
			lines: sample.lorem.lines(3),
			slug: sample.lorem.slug(),
			text: sample.lorem.text(),
		};
	}
	if (tool === "date") {
		return {
			past: sample.date.past().toISOString(),
			future: sample.date.future().toISOString(),
			recent: sample.date.recent().toISOString(),
			soon: sample.date.soon().toISOString(),
			anytime: sample.date.anytime().toISOString(),
			birthdate: sample.date.birthdate().toISOString(),
			month: sample.date.month(),
			weekday: sample.date.weekday(),
			time_zone: sample.date.timeZone(),
		};
	}
	if (tool === "string") {
		return {
			uuid: sample.string.uuid(),
			ulid: sample.string.ulid(),
			nanoid: sample.string.nanoid(),
			alpha: sample.string.alpha(10),
			alphanumeric: sample.string.alphanumeric(10),
			numeric: sample.string.numeric(10),
			hexadecimal: sample.string.hexadecimal(16),
			binary: sample.string.binary(8),
			octal: sample.string.octal(8),
			symbol: sample.string.symbol(4),
			sample: sample.string.sample(10),
		};
	}
	if (tool === "number") {
		return {
			int: sample.number.int(),
			float: sample.number.float(),
			hex: sample.number.hex(),
			binary: sample.number.binary(),
			octal: sample.number.octal(),
			roman_numeral: sample.number.romanNumeral(),
			big_int: String(sample.number.bigInt()),
		};
	}
	if (tool === "color") {
		return {
			human: sample.color.human(),
			hex: String(sample.color.rgb()),
			rgb: String(sample.color.rgb({ format: "css" })),
			hsl: String(sample.color.hsl({ format: "css" })),
			space: sample.color.space(),
			css_function: sample.color.cssSupportedFunction(),
		};
	}
	if (tool === "datatype") {
		return { boolean: sample.datatype.boolean() };
	}
	if (tool === "git") {
		return {
			branch: sample.git.branch(),
			commit_sha: sample.git.commitSha(),
			short_sha: sample.git.commitSha({ length: 7 }),
			commit_message: sample.git.commitMessage(),
			commit_date: sample.git.commitDate(),
			commit_entry: sample.git.commitEntry(),
		};
	}
	if (tool === "hacker") {
		return {
			abbreviation: sample.hacker.abbreviation(),
			adjective: sample.hacker.adjective(),
			noun: sample.hacker.noun(),
			verb: sample.hacker.verb(),
			ingverb: sample.hacker.ingverb(),
			phrase: sample.hacker.phrase(),
		};
	}
	if (tool === "phone") {
		return {
			number: sample.phone.number(),
			national: sample.phone.number({ style: "national" }),
			international: sample.phone.number({ style: "international" }),
			imei: sample.phone.imei(),
		};
	}
	return {
		file_name: sample.system.fileName(),
		file_ext: sample.system.fileExt(),
		file_type: sample.system.fileType(),
		common_file_name: sample.system.commonFileName(),
		common_file_ext: sample.system.commonFileExt(),
		common_file_type: sample.system.commonFileType(),
		mime_type: sample.system.mimeType(),
		directory_path: sample.system.directoryPath(),
		file_path: sample.system.filePath(),
		network_interface: sample.system.networkInterface(),
		semver: sample.system.semver(),
		cron: sample.system.cron(),
	};
}

/** Read a positional argument as a number, or `undefined` when it is not one. */
function readNumber(args: ToolArg[], index: number): number | undefined {
	let argument = args[index];
	if (argument === undefined || argument.kind !== "value") return undefined;
	return typeof argument.value === "number" ? argument.value : undefined;
}

function numberError(tool: SampleTool, name: string): Result<Value, SpecError> {
	return failure(new ToolError(`sample.${tool} needs a number for "${name}".`));
}
