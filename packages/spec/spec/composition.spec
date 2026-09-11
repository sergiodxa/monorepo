use fs

# A command defined beside the test that consumes it: a one-off arrangement
# kept local. It is still registered suite-globally, so its name is unique
# across the whole suite even though only this file uses it.
command composition_inline_manifest {
	# A command's value is whatever it returns — here a computed object a test
	# asserts on field by field. A command that only returns takes no
	# parameters, so a test binds it by name alone.
	return { name: "spec", version: "1.0.0", stable: true }
}

# A command with a parameter, run for its EFFECT — here a file left in the
# workspace — rather than for a value, since this one returns nothing.
command composition_write_inline_marker(path) {
	# `write` declares its first parameter as a value, so the bare `path` reads
	# this command's binding and the tool receives the real string.
	write path "inline-marker"
}

test "one command returns a value and another has an effect" {
	given {
		# The command runs for its effect: it writes the marker file.
		composition_write_inline_marker "marker.txt"
	}
	when {
		# The command runs for its value: the object it returns.
		let manifest = composition_inline_manifest
	}
	then {
		# The returned value, asserted directly.
		expect manifest.name "spec"
		expect manifest.version "1.0.0"
		expect manifest.stable true
		# The other command's effect on the workspace.
		expect file "marker.txt" exists
		expect file "marker.txt" contains "inline-marker"
	}
}

test "a command composes two cross-file commands" {
	given {
		# composition_load_catalog (from spec/commands/) internally calls the
		# seed command and a second command — all resolved by name across
		# files. The caller sees only the returned text.
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

test "a cross-file command is resolvable by name, order-independent" {
	when {
		# The command is defined in spec/commands/; this test uses it with no
		# import and no path. Definitions load before any test, so it resolves
		# regardless of the order files happen to load in.
		let seed = composition_catalog_seed
	}
	then {
		expect seed.title "Dune"
		expect seed.author "Herbert"
		expect seed.year 1965
	}
}
