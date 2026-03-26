# TODO

## Annotation Features
- [x] `place_of_offence.nature`: add `Unknown` option
- [x] `place_of_offence.sub-district`: make non-mandatory
- [x] `defendants_of_charge.trafficking_mode`: allow multiple entries
- [x] `benefits_received.received`: add `Unknown` option
- [x] `benefits_received.amount`: allow ranges
- [x] `benefits_received.amount_currency`: new field under `amount` for textual input (non-HKD)
- [x] `monthly_wage.wage_currency`: new field under `wage` for textual input
- [x] `positive_habits_after_arrest.habit`: add `Religion` option
- [ ] `starting_point`: add `Not given` checkbox
- [x] `defendants_of_charge.roles`: add `Packager` option after `storekeeper` with description: "Handles the preparation of drugs for sale by dividing bulk quantities into smaller units and repackaging them for concealment or distribution. Unlike couriers or storekeepers, the packager's role is focused on making the product market-ready."
- [x] `health_conditions`: rearrange fields so `type` comes before `name` (if compatible with existing data)
- [x] `drugs.drug_type`: add `Fluorodeschloroketamine` option after `Ketamine`
- [x] `mitigating_factors`: add `Charity` option with description: "the defendant has made constant donations to charities, and/or has active participation in charitable activities"
- [x] `guilty_plea.high_court_stage` and `guilty_plea.district_court_stage`: add `Other` option

## Workflow / Admin
- [x] Users page: assigned case count reflects actual assignments
- [x] Add `Verified / Unverified` filter alongside existing filters
- [x] Add language filter to distinguish English vs Chinese judgments
- [x] Allow Super.Admin to view all users' work without reassignment
- [ ] Allow admin to save changes when reviewing other users' work (currently must reassign case to self to edit)
