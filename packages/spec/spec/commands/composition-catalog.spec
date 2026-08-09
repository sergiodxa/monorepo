use fs

# A command that calls a FIXTURE. This is composition inside the spec language:
# a setup step reuses arranged data instead of restating the literal. The
# fixture lives in spec/fixtures/composition-catalog-seed.spec; suite-global
# loading makes it resolvable here by name. `use fs` is file-scoped, so this
# body's bare `write` resolves against THIS file's imports, never the caller's.
command composition_write_catalog(path) {
	let seed = fixture composition_catalog_seed
	# The path and the seed are bound values, and a bare identifier handed to a
	# tool is a symbolic word — so box both and pass dotted references, the way
	# any command feeds its parameters to a tool.
	let entry = { path: path, content: seed }
	write entry.path entry.content
}

# A command that calls ANOTHER command. Composition never escapes the spec
# language: steps build on steps, all resolved by name. This one seeds the
# catalog through the command above, then reads the file back and returns its
# text so a test can assert the round-trip.
command composition_load_catalog(path) {
	# A bare identifier in a command's argument position reads the caller's
	# binding, so `path` forwards this command's parameter to the next command.
	composition_write_catalog path
	let source = { path: path }
	return read source.path
}
