use fs
use sample

# The sample capability generates a suite's input — a name, an address, an
# identifier — instead of a literal typed into the file. Every tool is pure
# computation over the test's own stream, so like url.spec these cases run and
# PASS with no grants at all.
#
# What a case asserts is deliberate: the drawn values are never written down,
# because a spec that pinned "the email is marta.ibanez42@example.com" would
# fail the day a name list grows, for a reason it does not care about. Each
# case asserts instead what must hold for every draw — a bound honored exactly,
# a count honored exactly, a field that arrived at all — and the last one puts
# a generated value to work as input to another capability, which is the whole
# point of the namespace.

test "sample.int honors a range that leaves exactly one answer" {
	when {
		# The bounds include both ends, so a single-value range is the one case
		# whose result a spec can state outright.
		let only = sample.int 7 7
	}
	then {
		expect only 7
	}
}

test "sample.int stays inside its bounds over many draws" {
	when {
		# Each call advances the test's stream, so these are four independent
		# draws from the same one-value range rather than one value read back.
		let first = sample.int 3 3
		let second = sample.int 3 3
		let third = sample.int 3 3
		let fourth = sample.int 3 3
	}
	then {
		expect first 3
		expect second 3
		expect third 3
		expect fourth 3
	}
}

test "sample.words honors a count of none" {
	when {
		let nothing = sample.words 0
	}
	then {
		expect nothing ""
	}
}

test "sample.person arrives whole" {
	given {
		# A zero-argument tool binds straight onto a let, so the person is one
		# value with every field on it rather than five separate draws.
		let person = sample.person
	}
	then {
		expect person.first_name
		expect person.last_name
		expect person.full_name
		expect person.email
		expect person.username
	}
}

test "sample.email and sample.uuid draw a value every time" {
	when {
		let address = sample.email
		let id = sample.uuid
	}
	then {
		expect address
		expect id
	}
}

test "a generated identifier names a file" {
	given {
		# Boxing the identifier is what lets a tool read it: a bare name in
		# argument position is a symbolic word, while a dotted reference is a
		# binding read.
		let id = sample.uuid
		let target = { path: id }
	}
	when {
		write target.path "generated"
	}
	then {
		expect file target.path contains "generated"
	}
}

test "a module arrives as one record" {
	given {
		# A call target carries at most one dot, so each module is a single
		# zero-argument tool whose record holds every field it generates.
		let place = sample.location
		let files = sample.system
	}
	then {
		expect place.country
		expect place.city
		expect place.street_address
		expect place.zip_code
		expect files.file_name
		expect files.mime_type
		expect files.cron
	}
}
