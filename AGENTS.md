# Architecture rules

- File billing summaries reuse the existing billing Excel parser in a read-only presentation component; never modify uploaded workbooks or persist preview results.
- Financial analysis presentation derives ordering and monthly retroactive rows from parsed results; individual history previews select the original result index without overwriting aggregate saved histories.
- The shift detail modal owns the recurrence sidebar; its inline demand form reports CPF changes while other form placements retain their embedded sidebar, preserving independent scrolling and primary content.
- Routed movement attachments retain the originating movement in their storage path while attachment rows identify the destination; reuse the same date synchronization on upload and movement save to fill only empty destination dates in the same month.