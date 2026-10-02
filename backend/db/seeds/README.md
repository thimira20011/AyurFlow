# Synthetic development seeds

Reference roles are populated by migration 000002. No login account is created by the scaffold. Add an explicit seed command after Argon2id handling and patient fields have been implemented and reviewed.

Synthetic patient examples live in `tests/fixtures/patients.json`. They are not imported into the database yet. Seed commands must be repeatable and refuse accidental real-data production use. Do not commit real patient records or default administrator passwords.
