# A suite-global fixture living in the conventional fixtures/ directory. It is
# defined here and consumed from other files — commands and tests alike — by
# name only. The loader registers every definition before any test runs, so
# this cross-file resolution never depends on which file loads first.
fixture composition_catalog_seed {
	# The canonical catalog every composition test starts from, named once in a
	# single place. A fixture's value is whatever it returns; this one returns a
	# computed object with no side effects, so it needs no `use` and no grant.
	return { title: "Dune", author: "Herbert", year: 1965 }
}
