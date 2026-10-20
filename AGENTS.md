# Architecture rules
- Public CNPJ lookup runs through an authenticated read-only edge proxy with a fixed upstream URL; results stay in a separate consultation dialog and never mutate company form state or persist records, preserving existing edit permissions.
- Company addresses use an optional structured object with one principal and secondary array on the company row, inheriting existing company RLS and edit permissions; retain legacy text for existing readers, isolate individual draft edits, protect the principal against silent clearing on client and server, and reuse a read-only collapsed detail view for consultation.
- Reajuste display resolves saved age bands through a read-only presentation helper; summaries use the lowest-age band per modality and history lists all stored bands, avoiding changes to billing calculations or persisted totals.
- Complaint filters use session-scoped state; duplication copies an allowlist without IDs or resolutions, and AI classification is read-only, RLS-scoped to the selected company, with human confirmation before saving.
- The complaint AI function owns a mirrored classification catalog; keep it aligned with the client catalog so suggestions cannot bypass dependent dropdown options.

- Billing totals are computed only via `src/lib/faturamento-totais.ts` (single source of truth); retroactive amounts are a subset of inclusions and must never be added again, and zero from a parsed source is a valid value, never treated as missing.
- Pagador matching never accepts a valid diverging CNPJ via name similarity; name fallback applies only when the row's CNPJ is missing/invalid, and ambiguous multi-CNPJ name matches must be flagged, not merged.


- RH PowerPoint exports use a read-only six-slide builder from the dashboard snapshot; relative performance labels compare with the displayed global mean, and strategic recommendations remain explicitly proposed, avoiding new business thresholds or persisted data.

- File billing summaries reuse the existing billing Excel parser in a read-only presentation component; never modify uploaded workbooks or persist preview results.
- Financial analysis presentation derives ordering and monthly retroactive rows from parsed results; individual history previews select the original result index without overwriting aggregate saved histories.
- The shift detail modal owns the recurrence sidebar; its inline demand form reports CPF changes while other form placements retain their embedded sidebar, preserving independent scrolling and primary content.
- Routed movement attachments retain the originating movement in their storage path while attachment rows identify the destination; reuse the same date synchronization on upload and movement save to fill only empty destination dates in the same month.