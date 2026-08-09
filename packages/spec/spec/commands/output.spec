use fs

# The runtime compares whole values only, so substring assertions on captured
# CLI output go through a scratch file and the fs `contains` observable.
command output_contains(output, needle) {
	let probe = { text: output, needle: needle }
	write ".probe.txt" probe.text
	expect file ".probe.txt" contains probe.needle
}
