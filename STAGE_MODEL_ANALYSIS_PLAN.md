# Stage model analysis plan

## Purpose

This analysis builds an interpretable, data-driven sentencing estimator from
verified court-judgment annotations. It predicts the sentencing path in order:

1. starting point;
2. sentence after the defendant's role is considered;
3. notional sentence after aggravation;
4. non-plea mitigation reduction;
5. guilty-plea reduction; and
6. derived final sentence.

The work is exploratory and read-only. It does not change annotations,
schemas, verification UI behaviour, or MongoDB documents.

## Canonical factor names

Canonicalisation happens only in the modelling dataset.

| Stored factor label | Model factor |
| --- | --- |
| `Import`, `Export` | `Cross-border trafficking` |
| `Refugee/Asylum` | `Refugee claimant` |
| `Illegal immigrant` | `Illegal immigrant` (separate) |

`Suspended sentence` and `On bail` remain separate while their effects are
compared. The analysis also includes Multiple drugs, Role of the defendant,
Use of minors, Young offender, Rehabilitation programme, Medical conditions,
and Family illness, together with currently represented factors when direct
adjustment evidence is available.

## Dataset and split

- Use only `verified-features` documents where `is_verified` is `true` and
  `exclude` is not `true`.
- Cache the pulled document snapshot in `notebooks/.cache/` with a companion
  metadata JSON file. The notebook reads that snapshot by default when it
  exists; set `REFRESH_CACHE = True` to deliberately replace it from MongoDB.
- A modelling row represents one trial/charge/defendant combination.
- Preserve raw drug quantities in the exported row, but treat a negative,
  non-numeric, missing, or non-finite quantity as invalid and replace it with
  zero in the model feature matrix. Export those rows in a dedicated data-quality
  sheet so they can be corrected in the verification data.
- Keep neutral citation, charge number, defendant ID, all original labels,
  canonical labels, source text, inferred flags, drug quantities, factor-level
  adjustments, and sentence stages.
- Split entire judgments, rather than individual trials: 80% train and 20%
  test, with a fixed random seed of `42`. A neutral citation can occur in only
  one partition.

## Eligibility and calculations

The starting-point model uses trials with an explicit, non-inferred starting
point. It fits a ridge regression over spline transforms of per-drug
`log1p(quantity)` features.

Factor effects are learned only from training rows with a direct, non-inferred
individual adjustment and a positive incoming stage. Rows that only provide a
combined sentence difference are never used to infer a single factor's effect.

| Stage | Incoming sentence | Direct signal | Learned effect |
| --- | --- | --- | --- |
| Role | starting point | aggravating `enhancement_months` | enhancement / starting point |
| Aggravation | sentence after role | aggravating `enhancement_months` | enhancement / sentence after role |
| Mitigation | notional sentence | mitigating `reduction_months` | reduction / notional sentence |
| Guilty plea | notional less non-plea mitigation | guilty-plea reduction | reduction / incoming sentence |

For every factor with at least one eligible direct training adjustment, the
estimator uses the median proportional effect and median months. Only factors
with no direct training adjustment are reported as unsupported and contribute
zero in predictions. Effects are summed
within a stage, calculations retain full precision, displayed stages are
rounded to whole months, and predicted sentence values cannot be negative.

The test prediction sequence is:

```text
predicted starting point
  + predicted role enhancement
= predicted after-role sentence
  + predicted aggravating enhancements
= predicted notional sentence
  - predicted non-plea mitigation reductions
= pre-plea sentence
  - predicted guilty-plea reduction
= predicted final sentence
```

## Suspended sentence and on-bail review

The notebook estimates these factors separately. It bootstraps factor effects
at the judgment level to produce 95% confidence intervals. It marks them as a
review candidate, but does not merge them automatically, only if all of the
following are true:

1. both effects have the same direction;
2. the bootstrap confidence interval of their difference includes zero; and
3. their effects at the median incoming sentence differ by no more than two
   months.

## Outputs and validation

The notebook exports `notebooks/stage_model_analysis.xlsx` with the split
membership, modelling rows, factor support, learned effects, confidence
intervals, Suspended sentence/On bail comparison, held-out metrics, and
per-trial predictions.

It asserts that canonical mappings are correct, Import and Export never create
two cross-border contributions, split citations do not overlap, sentence stages
remain non-negative and arithmetically consistent, factor support is respected,
and exported split membership matches the in-memory split. It reports held-out
MAE and median absolute error for every stage and the final derived sentence.

## Running the analysis

```bash
cd featureExtraction
uv sync
cd ../notebooks
uv run --project ../featureExtraction --with jupyter jupyter notebook stage_model_analysis.ipynb
```

The environment must have `DB_MONGODB_URI` and, optionally, `DB_NAME` set in
`featureExtraction/.env`, `featureVerification/.env.local`, or the repository
root `.env` only when no cache is available or `REFRESH_CACHE` is enabled.
Running the notebook only reads MongoDB and writes local cache/Excel artifacts.
