# Architecture rules

- File billing summaries reuse the existing billing Excel parser in a read-only presentation component; never modify uploaded workbooks or persist preview results.