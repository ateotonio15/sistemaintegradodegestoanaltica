# Uber import architecture
- Business CSV parsing is read-only and allowlisted; confirmation uses an atomic insert-only RPC with a unique trip ID so retries never overwrite rides.
- Import undo is owner/admin authorized and deletes only rows bearing the immutable batch ID; historical manual and Excel rides remain untouched.
- Payment options are shared with the existing ride form; imported pending rides use the same collaborator requirement as that form.