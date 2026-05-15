# Security Specification for Cronos Trading

## Invariants
- Users can only read and write their own documents under `/users/{userId}` and `/users/{userId}/slots/{slotId}`.
- Admins can read (or act on behalf of, via cloud function, but here we just need to let them read) user configurations.
- `global_settings` can only be updated by admins, but readable by verified users.

## Dirty Dozen Payloads
TBD for eslint.
