use fs

# A fixture defined beside the test that consumes it: a one-off arrangement
# kept local. It is still registered suite-globally, so its name is unique
# across the whole suite even though only this file uses it.
fixture composition_inline_manifest {
	# A fixture's value is whatever it returns — here a computed object a test
	# asserts on field by field.
	return { name: "spec", version: "1.0.0", stable: true }
}

# A command defined in the same file: a reusable setup step. What a test
# asserts about a command is its EFFECT — here a file left in the workspace —
# not a returned value, since this command returns nothing.
command composition_write_inline_marker(path) {
	# Box the parameter so a dotted reference hands the real value to the tool;
	# a bare identifier in tool-argument position is always a symbolic word.
	let target = { path: path }
	write target.path "inline-marker"
}

test "an in-file fixture returns a value and an in-file command has an effect" {
	given {
		# The command runs for its effect: it writes the marker file.
		composition_write_inline_marker "marker.txt"
	}
	when {
		# The fixture runs for its value: the object it returns.
		let manifest = fixture composition_inline_manifest
	}
	then {
		# The fixture's returned value, asserted directly.
		expect manifest.name "spec"
		expect manifest.version "1.0.0"
		expect manifest.stable true
		# The command's effect on the workspace.
		expect file "marker.txt" exists
		expect file "marker.txt" contains "inline-marker"
	}
}

test "a command composes a cross-file fixture and another command" {
	given {
		# composition_load_catalog (from spec/commands/) internally calls the
		# fixture (from spec/fixtures/) and a second command — all resolved by
		# name across files. The caller sees only the returned text.
		let returned = composition_load_catalog "catalog.json"
	}
	when {
		let reread = read "catalog.json"
	}
	then {
		# The composed command left the seed on disk...
		expect file "catalog.json" exists
		expect file "catalog.json" contains "Herbert"
		# ...and returned exactly the text it read back from that same file.
		expect returned reread
	}
}

test "a cross-file fixture is resolvable by name, order-independent" {
	when {
		# The fixture is defined in spec/fixtures/; this test uses it with no
		# import and no path. Definitions load before any test, so it resolves
		# regardless of the order files happen to load in.
		let seed = fixture composition_catalog_seed
	}
	then {
		expect seed.title "Dune"
		expect seed.author "Herbert"
		expect seed.year 1965
	}
}
