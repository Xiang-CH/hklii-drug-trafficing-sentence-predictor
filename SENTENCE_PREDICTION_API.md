# Sentence Prediction API

## Overview

The Sentence Prediction API calculates a predicted drug-trafficking sentence from drug quantities, defendant role, plea stage, aggravating factors, and mitigating factors.

The response reports:

- the starting point in months;
- each role, aggravating, mitigating, and guilty-plea adjustment;
- the amount added or reduced by every selected factor in months and years; and
- the final predicted sentence in months and years.

The API must not apply a sentencing guideline when the submitted drug type is unsupported or has not yet been modelled.

## Endpoint

```http
POST /api/sentence-predictions
```

### Authentication

The calculation contract is independent of authentication. In production, the endpoint should be protected by the application's standard API authentication mechanism, such as a session or bearer token.

Unauthenticated requests should receive `401 Unauthorized`.

### Headers

```http
Content-Type: application/json
Accept: application/json
```

## Request body

```json
{
  "drugs": [
    {
      "type": "Cocaine",
      "quantity": 10
    }
  ],
  "defendantRole": "Actual trafficker",
  "additionalCircumstances": [
    "Cross-border trafficking"
  ],
  "guiltyPlea": "Plead guilty (earliest opportunity)",
  "aggravatingFactors": [
    "Multiple Drugs"
  ],
  "mitigatingFactors": [
    "Assistance - useful"
  ]
}
```

### Request schema

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `drugs` | array | Yes | One or more drug quantity records. |
| `drugs[].type` | string | Yes | Drug category from the supported drug list. |
| `drugs[].quantity` | number | Yes | Positive quantity in grams. |
| `drugs[].variant` | string | Conditional | Required only for `Midazolam`; must be `powder`. |
| `defendantRole` | string or `null` | No | One mutually exclusive defendant role. `null` means no role adjustment. |
| `additionalCircumstances` | array | No | Additional circumstances associated with the selected role. |
| `guiltyPlea` | string or `null` | No | One guilty-plea option, or `null` when the plea is unknown. `null` applies no plea reduction. |
| `aggravatingFactors` | array | No | Selected aggravating factors. |
| `mitigatingFactors` | array | No | Selected mitigating factors. |

If omitted, `additionalCircumstances`, `aggravatingFactors`, and `mitigatingFactors` default to empty arrays, and `guiltyPlea` defaults to `null`. Duplicate values in any array are invalid.

## Drug types

The accepted drug types are:

- `Cocaine`
- `Ketamine`
- `Fluorodeschloroketamine`
- `Methamphetamine`
- `Heroin`
- `Cannabis/THC`
- `Ecstasy`
- `Midazolam`
- `Nimetazepam`

### Fluorodeschloroketamine

`Fluorodeschloroketamine` must use the same canonical retrieval category and sentencing guideline as `Ketamine`.

The alias is normalized internally; the request still contains only `type` and `quantity`.

### Cannabis and THC/CBD

The previous distinction between cannabis resin and herbal cannabis is no longer applicable. Both are represented by the `Cannabis/THC` type.

`THC` and `CBD` must not be treated as interchangeable because different sentencing guidelines apply. The current API nevertheless accepts the single `Cannabis/THC` type. No additional drug property is required:

```json
{
  "type": "Cannabis/THC",
  "quantity": 12
}
```

The model must document which guideline is applied to this combined category. Once the THC/CBD review is complete, separate drug types can be introduced in a later API version without changing the request shape.

### Midazolam

Different sentencing standards apply to Midazolam powder and tablets. The current API accepts `Midazolam` as one drug type with a required `variant` field:

```json
{
  "type": "Midazolam",
  "quantity": 2,
  "variant": "powder"
}
```

The allowed value for `variant` is:

- `powder`

`tablet` is not accepted; Midazolam quantities are sent in grams of narcotic weight and follow the powder guidelines.

The model/data layer must apply the Midazolam powder data. The API must not silently map Midazolam to a generic `Other` category.

## Defendant roles

Only one role may be selected:

- `Courier / Storekeeper`
- `Actual trafficker`
- `Manager / Organiser`
- `Operator / Financial Controller`

The role is supplied as a single value, not an array. This makes the role options mutually exclusive at the schema level.

### Role rules

#### Courier / Storekeeper

There is no role-based sentence adjustment for `Courier / Storekeeper`.

Without cross-border trafficking, the sentence is calculated using the other selected inputs only.

With `Cross-border trafficking`, the adjustment is based on the Import/Export aggravating-factor data.

#### Actual trafficker, Manager / Organiser, and Operator / Financial Controller

These roles use the role-specific sentence adjustment data.

When `Cross-border trafficking` is selected, the API must use the matching role plus cross-border cases from the Role Sentence Adjustments data.

The generic cross-border aggravating-factor adjustment must not be applied a second time to these severe-role combinations.

### Additional circumstances

The only accepted additional circumstance is:

- `Cross-border trafficking`

`Divan keeping` and `Manufacturing` are not accepted and must not contribute to the prediction.

An additional circumstance may not be submitted without a `defendantRole`.

## Guilty plea

The field is optional. A single option may be submitted, or `null` may be sent when the plea is unknown:

- `null`
- `Plead not guilty`
- `Plead guilty (earliest opportunity)`
- `Plead guilty (before trial dates are set)`
- `Plead guilty (before trial starts)`
- `Plead guilty (first day of trial)`
- `Plead guilty (during the trial)`

When `guiltyPlea` is `null` or `Plead not guilty`, no guilty-plea reduction is applied.

The guilty-plea reduction percentage is controlled by the server-side sentencing-guideline configuration. Clients must not submit their own percentage.

The configured values should reflect the usual reductions:

| Plea option | Guideline |
| --- | --- |
| `Plead not guilty` | No reduction |
| `Plead guilty (earliest opportunity)` | Normally 33.3% |
| `Plead guilty (before trial dates are set)` | Normally about 25% |
| `Plead guilty (before trial starts)` | Normally 20%–25% |
| `Plead guilty (first day of trial)` | Normally about 20% |
| `Plead guilty (during the trial)` | Normally less than 20% |

The response must report the actual configured percentage used for the calculation.

## Aggravating factors

The accepted aggravating factors are:

- `Multiple Drugs`
- `Persistent offender`
- `On bail`
- `Refugee/Asylum`
- `Use of minors`

`Use of minors` must be represented as an ordinary selected factor and must be included in the returned adjustment list.

`On bail` and `Suspended sentence` should remain separate factors in the API. Their statistical similarity may be reviewed independently before any future consolidation.

## Mitigating factors

The accepted mitigating factors are:

- `Self-consumption`
- `Assistance - limited`
- `Assistance - useful`
- `Assistance - testify`
- `Assistance - risk`
- `Young offender`
- `Medical conditions`
- `Family illness`
- `Rehabilitation programme`

`Extreme youth` is intentionally excluded from this API and must not be used as a substitute for `Young offender`.

The assistance options are mutually exclusive sentencing classifications. If more than one assistance classification is supplied, the API must return a validation error.

The configured assistance reductions are:

| Assistance option | Reduction |
| --- | --- |
| `Assistance - limited` | 6.67% |
| `Assistance - useful` | 9.17% |
| `Assistance - testify` | 16.67% |
| `Assistance - risk` | 32.5% |

These are the assistance portion only: each guideline total discount (up to 40%, 40–45%, usually 50%, up to 2/3) is reduced by the one-third guilty-plea discount, which is credited separately.

## Calculation order

The calculation must be performed in this order:

1. Calculate the drug-based starting point.
2. Apply the defendant-role increase as a percentage of the starting point, forming the post-role sentence.
3. Apply aggravating-factor increases as percentages of the post-role sentence, forming the notional sentence.
4. Calculate every mitigating-factor reduction (including any single assistance classification) and the guilty-plea reduction as a percentage of the notional sentence.
5. Subtract the sum of all reductions from the notional sentence.
6. Clamp the final sentence to zero months or greater.

Adjustments are non-compounding within each stage: role increases are each computed against the unchanged starting point and summed once; aggravating increases are each computed against the unchanged post-role sentence and summed once; reductions are each computed against the unchanged notional sentence and summed once. No adjustment is applied to the result of another adjustment within the same stage, so the order of adjustments in a stage does not change the result. The stages are sequential, so aggravating increases do build on the post-role sentence, and reductions build on the notional sentence.

The starting point uses the bucketed sentencing-guideline interpolation. Each drug family has a series of quantity bands with a sentence range; a quantity is mapped to its band and interpolated linearly across the band's sentence range (`t = u`). Open-ended top bands predict the band floor, and the "at the sentencer's discretion" band predicts the previous band's ceiling. For a request with several drugs the starting point uses the notional-quantity method: for each drug, take the sentence the *total* quantity would attract in that drug's family, weight it by that drug's share of the total quantity, and sum the contributions.

The base used by each adjustment must be returned so that consumers can reproduce the calculation.

For a factor with a percentage adjustment:

```text
adjustmentMonths = adjustmentBaseMonths × percentage / 100
```

For a reduction, `months` is returned as a positive magnitude and `direction` is set to `decrease`.

## Successful response

### Status

`200 OK`

### Response body

```json
{
  "status": "supported",
  "startingPointMonths": 60,
  "startingPointYears": 5,
  "adjustments": [
    {
      "factor": "Actual trafficker",
      "category": "defendantRole",
      "direction": "increase",
      "percentage": 5,
      "baseMonths": 60,
      "months": 3,
      "years": 0.25
    },
    {
      "factor": "Multiple Drugs",
      "category": "aggravating",
      "direction": "increase",
      "percentage": 4,
      "baseMonths": 63,
      "months": 2.52,
      "years": 0.21
    },
    {
      "factor": "Plead guilty (earliest opportunity)",
      "category": "guiltyPlea",
      "direction": "decrease",
      "percentage": 33.3,
      "baseMonths": 65.52,
      "months": 21.82,
      "years": 1.82
    },
    {
      "factor": "Assistance - useful",
      "category": "mitigating",
      "direction": "decrease",
      "percentage": 9.17,
      "baseMonths": 65.52,
      "months": 6.01,
      "years": 0.5
    }
  ],
  "finalSentenceMonths": 37.69,
  "finalSentenceYears": 3.14
}
```

### Response fields

| Field | Type | Description |
| --- | --- | --- |
| `status` | string | `supported` for a completed prediction. |
| `startingPointMonths` | number | Drug-based starting point. |
| `startingPointYears` | number | Starting point divided by 12. |
| `adjustments` | array | One entry for every applied role, factor, or plea adjustment. |
| `adjustments[].factor` | string | Selected factor or role. |
| `adjustments[].category` | string | `defendantRole`, `aggravating`, `mitigating`, or `guiltyPlea`. |
| `adjustments[].direction` | string | `increase` or `decrease`. |
| `adjustments[].percentage` | number | Percentage used by the model. |
| `adjustments[].baseMonths` | number | Sentence amount to which the adjustment was applied. |
| `adjustments[].months` | number | Absolute adjustment amount in months. |
| `adjustments[].years` | number | Absolute adjustment amount divided by 12. |
| `finalSentenceMonths` | number | Final predicted sentence in months. |
| `finalSentenceYears` | number | Final predicted sentence divided by 12. |

The server should retain calculation precision internally. The response may round display values, but it should use a documented policy, such as two decimal places for months and years.

## Validation errors

### Invalid JSON or schema — `400 Bad Request`

```json
{
  "error": "VALIDATION_ERROR",
  "message": "The request body is invalid",
  "fields": {
    "drugs[0].quantity": "Quantity must be greater than zero"
  }
}
```

Examples include:

- missing `drugs`;
- an empty drug list;
- zero, negative, non-numeric, or non-finite quantities;
- a missing or invalid `variant` for `Midazolam` (`powder` is the only accepted value);
- duplicate factors;
- more than one defendant role;
- an invalid plea option;
- `Extreme youth`, `Divan keeping`, or `Manufacturing` being submitted;
- a circumstance being submitted without a role;
- multiple assistance classifications.

### Ambiguous or unavailable model input — `422 Unprocessable Entity`

```json
{
  "error": "MODEL_INPUT_UNAVAILABLE",
  "message": "A sentencing model is not available for Midazolam",
  "drug": {
    "type": "Midazolam"
  }
}
```

This status must be used when:

- the combined `Cannabis/THC` type has no supported model;
- the requested drug type has no supported model;
- Nimetazepam has no supported sentencing curve;
- a requested drug category has insufficient reviewed data; or
- a required role/cross-border adjustment has not been fitted.

The API must not silently fall back to `Other`, `Cannabis`, or another drug category.

### Unauthenticated — `401 Unauthorized`

```json
{
  "error": "UNAUTHENTICATED",
  "message": "Authentication is required"
}
```

### Rate limited — `429 Too Many Requests`

```json
{
  "error": "RATE_LIMITED",
  "message": "Too many prediction requests"
}
```

### Internal error — `500 Internal Server Error`

```json
{
  "error": "INTERNAL_ERROR",
  "message": "The prediction could not be calculated"
}
```

Internal model details, stack traces, database errors, and credentials must not be returned to the client.

## Request examples

### Courier with cross-border trafficking

```json
{
  "drugs": [
    {
      "type": "Ketamine",
      "quantity": 20
    }
  ],
  "defendantRole": "Courier / Storekeeper",
  "additionalCircumstances": [
    "Cross-border trafficking"
  ],
  "guiltyPlea": "Plead not guilty",
  "aggravatingFactors": [],
  "mitigatingFactors": []
}
```

The role adjustment is zero. The cross-border increase is calculated from the Import/Export adjustment data.

### Severe role with cross-border trafficking

```json
{
  "drugs": [
    {
      "type": "Heroin",
      "quantity": 5
    }
  ],
  "defendantRole": "Manager / Organiser",
  "additionalCircumstances": [
    "Cross-border trafficking"
  ],
  "guiltyPlea": "Plead guilty (before trial starts)",
  "aggravatingFactors": [],
  "mitigatingFactors": []
}
```

The role-specific cross-border adjustment is applied once. A second generic cross-border aggravation must not be added.

### Multiple drugs

```json
{
  "drugs": [
    {
      "type": "Cocaine",
      "quantity": 10
    },
    {
      "type": "Cannabis/THC",
      "quantity": 25
    }
  ],
  "defendantRole": null,
  "additionalCircumstances": [],
  "guiltyPlea": "Plead guilty (earliest opportunity)",
  "aggravatingFactors": [
    "Multiple Drugs"
  ],
  "mitigatingFactors": []
}
```

### Midazolam

```json
{
  "drugs": [
    {
      "type": "Midazolam",
      "quantity": 1.5,
      "variant": "powder"
    }
  ],
  "defendantRole": null,
  "additionalCircumstances": [],
  "guiltyPlea": "Plead guilty (earliest opportunity)",
  "aggravatingFactors": [],
  "mitigatingFactors": []
}
```

## Data and model responsibilities

The endpoint consumes reviewed model data. The following data requests are separate reporting or data-quality tasks and are not prediction inputs:

- all `THC/CBD` charges, including charge number and defendant number;
- all `Other: Midazolam` charges, including charge number and defendant number;
- all Import/Export aggravating-factor charges;
- all `Use of minors` charges;
- young-offender, medical-condition, and family-illness charges; and
- guilty-plea, assistance, and other sentencing outlier cases.

Excluded charges must remain available for overall model development. The exclusion flag only controls whether a charge contributes to defendant-role sentence adjustments.

## Versioning and compatibility

The endpoint is versioned under `/api/v1`. Changes to accepted enum values, calculation order, adjustment semantics, or response fields should require a new API version or an explicitly documented backward-compatible change.

The response should include a model version once model artefacts are available:

```json
{
  "status": "supported",
  "modelVersion": "2026-08-05",
  "startingPointMonths": 60,
  "adjustments": [],
  "finalSentenceMonths": 60
}
```
