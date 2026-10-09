# Architecture rules

- File billing summaries reuse the existing billing Excel parser in a read-only presentation component; never modify uploaded workbooks or persist preview results.
- Financial analysis presentation derives ordering and monthly retroactive rows from parsed results; individual history previews select the original result index without overwriting aggregate saved histories.