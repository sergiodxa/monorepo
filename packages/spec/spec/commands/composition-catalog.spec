use fs

# A command that calls ANOTHER command for its value. This is composition
# inside the spec language: a setup step reuses arranged data instead of
# restating the literal. composition_catalog_seed takes no parameters, so its
# bare name is a complete right-hand side. It lives in a sibling file, and
# suite-global loading makes it resolvable here by name. `use fs` is
# file-scoped, so this body's bare `write` resolves against THIS file's
# imports, never the caller's.
command composition_write_catalog(path) {
	let seed = composition_catalog_seed
	# `write` declares two value parameters, so both bare identifiers here read
	# the bindings of those names and hand the tool the real values.
	write path seed
}

# A command that calls another command for its EFFECT. Composition never
# escapes the spec language: steps build on steps, all resolved by name. This
# one seeds the catalog through the command above, then reads the file back and
# returns its text so a test can assert the round-trip.
command composition_load_catalog(path) {
	composition_write_catalog path
	return read path
}
