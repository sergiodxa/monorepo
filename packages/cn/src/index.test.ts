import { describe, expect, test } from "bun:test";
import { cn, type ClassName, type ClassNameRecord, type StyleRecord } from "./index";

describe("cn", () => {
	describe("basic usage", () => {
		test("merges multiple class strings", () => {
			expect(cn("foo", "bar")).toBe("foo bar");
		});

		test("handles single class", () => {
			expect(cn("foo")).toBe("foo");
		});

		test("handles empty input", () => {
			expect(cn()).toBe("");
		});
	});

	describe("conditional classes", () => {
		test("handles boolean conditions with &&", () => {
			// oxlint-disable-next-line no-constant-binary-expression -- testing constant for demonstration
			expect(cn("base", true && "included")).toBe("base included");
			// oxlint-disable-next-line no-constant-binary-expression -- testing constant for demonstration
			expect(cn("base", false && "excluded")).toBe("base");
		});

		test("handles object syntax", () => {
			expect(cn("base", { active: true, disabled: false })).toBe("base active");
		});

		test("handles ternary expressions", () => {
			// oxlint-disable-next-line no-constant-condition -- testing constant for demonstration
			expect(cn("base", true ? "yes" : "no")).toBe("base yes");
			// oxlint-disable-next-line no-constant-condition -- testing constant for demonstration
			expect(cn("base", false ? "yes" : "no")).toBe("base no");
		});
	});

	describe("falsy values", () => {
		test("ignores undefined", () => {
			expect(cn("foo", undefined, "bar")).toBe("foo bar");
		});

		test("ignores null", () => {
			expect(cn("foo", null, "bar")).toBe("foo bar");
		});

		test("ignores false", () => {
			expect(cn("foo", false, "bar")).toBe("foo bar");
		});

		test("ignores empty string", () => {
			expect(cn("foo", "", "bar")).toBe("foo bar");
		});

		test("ignores 0", () => {
			expect(cn("foo", 0, "bar")).toBe("foo bar");
		});
	});

	describe("arrays", () => {
		test("handles arrays of classes", () => {
			expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
		});

		test("handles nested arrays", () => {
			expect(cn(["foo", ["bar", "baz"]])).toBe("foo bar baz");
		});
	});

	describe("tailwind merge", () => {
		test("merges conflicting padding classes", () => {
			expect(cn("p-4", "p-8")).toBe("p-8");
		});

		test("merges conflicting margin classes", () => {
			expect(cn("m-2", "m-4")).toBe("m-4");
		});

		test("merges conflicting text color classes", () => {
			expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
		});

		test("merges conflicting background classes", () => {
			expect(cn("bg-white", "bg-black")).toBe("bg-black");
		});

		test("preserves non-conflicting classes", () => {
			expect(cn("p-4", "m-2", "text-red-500")).toBe("p-4 m-2 text-red-500");
		});

		test("external className overrides base (last wins)", () => {
			let baseClasses = "p-4 text-sm bg-white";
			let externalClassName = "p-8 bg-black";
			expect(cn(baseClasses, externalClassName)).toBe("text-sm p-8 bg-black");
		});
	});

	describe("real-world component patterns", () => {
		test("button with variants", () => {
			function getButtonClasses(variant: "primary" | "secondary") {
				return cn("px-4 py-2 rounded", {
					"bg-blue-500 text-white": variant === "primary",
					"bg-gray-200 text-gray-800": variant === "secondary",
				});
			}
			expect(getButtonClasses("primary")).toBe("px-4 py-2 rounded bg-blue-500 text-white");
			expect(getButtonClasses("secondary")).toBe("px-4 py-2 rounded bg-gray-200 text-gray-800");
		});

		test("component with external className override", () => {
			function getButtonClasses(className?: string) {
				return cn("px-4 py-2 bg-blue-500", className);
			}

			expect(getButtonClasses()).toBe("px-4 py-2 bg-blue-500");
			expect(getButtonClasses("px-8")).toBe("py-2 bg-blue-500 px-8");
			expect(getButtonClasses("bg-red-500")).toBe("px-4 py-2 bg-red-500");
		});
	});
});

describe("types", () => {
	describe("ClassName type", () => {
		test("accepts string", () => {
			let value: ClassName = "foo";
			expect(cn(value)).toBe("foo");
		});

		test("accepts undefined", () => {
			let value: ClassName = undefined;
			expect(cn(value)).toBe("");
		});

		test("accepts boolean", () => {
			let value: ClassName = false;
			expect(cn(value)).toBe("");
		});

		test("accepts object", () => {
			let value: ClassName = { foo: true, bar: false };
			expect(cn(value)).toBe("foo");
		});

		test("accepts array", () => {
			let value: ClassName = ["foo", "bar"];
			expect(cn(value)).toBe("foo bar");
		});
	});

	describe("ClassNameRecord type", () => {
		test("creates typed record with optional ClassName values", () => {
			type ButtonSlots = "root" | "icon" | "label";
			let classNames: ClassNameRecord<ButtonSlots> = {
				root: "flex items-center",
				icon: ["w-4", "h-4"],
				// label is optional, can be omitted
			};

			expect(cn(classNames.root)).toBe("flex items-center");
			expect(cn(classNames.icon)).toBe("w-4 h-4");
			expect(cn(classNames.label)).toBe("");
		});
	});

	describe("StyleRecord type", () => {
		test("creates typed record with CSS properties", () => {
			type ButtonSlots = "root" | "icon";
			let styles: StyleRecord<ButtonSlots> = {
				root: { display: "flex", "--custom-var": "value" },
			};

			expect(styles.root?.display).toBe("flex");
			expect(styles.root?.["--custom-var"]).toBe("value");
		});
	});

	// Type-level tests using @ts-expect-error
	// These verify that invalid usage produces type errors
	test("type errors for invalid ClassNameRecord keys", () => {
		type Slots = "a" | "b";
		let record: ClassNameRecord<Slots> = { a: "foo" };

		// @ts-expect-error - 'c' is not a valid key
		record.c = "invalid";

		expect(record.a).toBe("foo");
	});

	test("type errors for invalid StyleRecord keys", () => {
		type Slots = "root";
		let styles: StyleRecord<Slots> = {};

		// @ts-expect-error - 'invalid' is not a valid key
		styles.invalid = { display: "flex" };

		expect(styles.root).toBeUndefined();
	});
});
