# Sentence Prediction API

Public API documentation for clients integrating with the sentence prediction service.

## Endpoints

```http
POST /api/sentence-predictions
POST /api/similar-cases
```

The endpoints are publicly accessible and do not require a login or API key.

Requests may be rate limited. Do not include personal information, case documents, or other sensitive data in the request.

## Headers

```http
Content-Type: application/json
Accept: application/json
```

## Request

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
    "Multiple Drugs",
    "On bail"
  ],
  "mitigatingFactors": [
    "Assistance - useful",
    "Rehabilitation programme"
  ]
}
```

### Request fields

| Field | Required | Description |
| --- | --- | --- |
| `drugs` | Yes | One or more drug entries. |
| `drugs[].type` | Yes | Drug type listed below. |
| `drugs[].quantity` | Yes | Quantity in grams. Must be greater than zero. |
<!-- | `drugs[].variant` | Conditional | Required only for `Midazolam`. | -->
| `defendantRole` | No | One defendant role, or `null`. |
| `additionalCircumstances` | No | Additional circumstance list. |
| `guiltyPlea` | Yes | One guilty-plea option. |
| `aggravatingFactors` | No | Aggravating-factor list. |
| `mitigatingFactors` | No | Mitigating-factor list. |

If omitted, `additionalCircumstances`, `aggravatingFactors`, and `mitigatingFactors` are treated as empty lists.

## Drug types

Accepted values for `drugs[].type` are:

- `Cocaine`
- `Ketamine`
- `Fluorodeschloroketamine`
- `Methamphetamine`
- `Heroin`
- `Cannabis/THC`
- `Ecstasy`
- `Midazolam`
- `Nimetazepam`

`Fluorodeschloroketamine` is accepted as a Ketamine-equivalent type.

<!-- For `Midazolam`, `variant` is required and must be `powder`:

```json
{
  "type": "Midazolam",
  "quantity": 2,
  "variant": "powder"
}
```

`tablet` is not accepted. Midazolam quantities are sent in grams of narcotic weight and follow the powder guidelines.

No `variant` field is required for other drug types. -->

## Starting point model

The drug-based starting point uses the bucketed sentencing-guideline interpolation. Each drug family has a series of quantity bands (in grams) with a sentence range; a quantity is mapped to its band and interpolated linearly across the band's sentence range. Open-ended top bands predict the band floor, and the "at the sentencer's discretion" band predicts the previous band's ceiling.

For a request with several drugs the starting point uses the notional-quantity method: for each drug, take the sentence the *total* quantity would attract in that drug's family, weight it by that drug's share of the total quantity, and sum the contributions. The other drugs remain eligible for the `Multiple Drugs` aggravating factor.

## Defendant roles

Accepted values for `defendantRole` are:

- `Courier / Storekeeper`
- `Actual trafficker`
- `Manager / Organiser`
- `Operator / Financial Controller`

Only one role may be selected.

The only accepted value for `additionalCircumstances` is:

- `Cross-border trafficking`

`Divan keeping` and `Manufacturing` are not accepted values.

## Guilty plea options

`guiltyPlea` must be one of:

- `Plead not guilty`
- `Plead guilty (earliest opportunity)`
- `Plead guilty (before trial dates are set)`
- `Plead guilty (before trial starts)`
- `Plead guilty (first day of trial)`
- `Plead guilty (during the trial)`

## Aggravating factors

Accepted values for `aggravatingFactors` are:

- `Multiple Drugs`
- `Persistent offender`
- `On bail`
- `Refugee/Asylum`
- `Use of minors`
## Mitigating factors

Accepted values for `mitigatingFactors` are:

- `Self-consumption`
- `Assistance - limited`
- `Assistance - useful`
- `Assistance - testify`
- `Assistance - risk`
- `Young offender`
- `Medical conditions` (To be Removed)
- `Family illness` (To be Removed)
- `Rehabilitation programme`

Only one assistance option may be selected. `Extreme youth` is not accepted.

## Response
### Successful response

Status: `200 OK`

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
      "factor": "Plead guilty (earliest opportunity)",
      "category": "guiltyPlea",
      "direction": "decrease",
      "percentage": 33.3,
      "baseMonths": 63,
      "months": 20.98,
      "years": 1.75
    }
  ],
  "finalSentenceMonths": 42.02,
  "finalSentenceYears": 3.5
}
```

### Response fields

| Field | Description |
| --- | --- |
| `status` | `supported` when a prediction is returned. |
| `startingPointMonths` | Starting point in months. |
| `startingPointYears` | Starting point in years. |
| `adjustments` | Adjustments for selected roles and factors. |
| `adjustments[].factor` | Role, factor, or plea option applied. |
| `adjustments[].category` | `defendantRole`, `aggravating`, `mitigating`, or `guiltyPlea`. |
| `adjustments[].direction` | `increase` or `decrease`. |
| `adjustments[].percentage` | Percentage used by the model. |
| `adjustments[].baseMonths` | Sentence amount to which the adjustment was applied. |
| `adjustments[].months` | Adjustment amount in months. |
| `adjustments[].years` | Adjustment amount in years. |
| `finalSentenceMonths` | Final predicted sentence in months. |
| `finalSentenceYears` | Final predicted sentence in years. |

Adjustment amounts are returned as positive values. Use `direction` to determine whether an amount is added or reduced.

Reductions (mitigating factors and the guilty plea) are non-compounding: each is calculated against the notional sentence (the sentence after role and aggravating adjustments only) and the reduction amounts are summed before being subtracted once.

## Example request

```bash
curl -X POST https://example.com/api/sentence-predictions \
  -H 'Content-Type: application/json' \
  -d '{
    "drugs": [
      {"type": "Ketamine", "quantity": 20}
    ],
    "defendantRole": "Courier / Storekeeper",
    "additionalCircumstances": ["Cross-border trafficking"],
    "guiltyPlea": "Plead not guilty",
    "aggravatingFactors": [],
    "mitigatingFactors": []
  }'
```

## Similar cases

Recommendations for cases similar to the submitted facts.

```http
POST /api/similar-cases
```

The request body is identical to the sentence-prediction request above. All request fields, drug types, roles, plea options, and factor rules apply unchanged.

### Successful response

Status: `200 OK`

```json
[
  {
    "neutralCitation": "[2024] HKDC 1502",
    "title": "HKSAR v Chan Kwok Ming",
    "url": "https://www.hklii.hk/en/cases/hkdc/2024/1502",
    "score": 1
  },
  {
    "neutralCitation": "[2023] HKDC 536",
    "title": "HKSAR v Wong Wai Shing",
    "url": "https://www.hklii.hk/en/cases/hkdc/2023/536",
    "score": 0.9955
  }
]
```

### Response fields

The response is a JSON array of case objects.

| Field | Description |
| --- | --- |
| `neutralCitation` | Neutral citation of the judgment. |
| `title` | Case title. |
| `url` | Link to the English or Chinese version of the judgment. |
| `score` | Similarity to the submitted facts, between 0 and 1. |

Up to 10 cases are returned, sorted by `score` in descending order. Cases with a `score` below 0.6 are excluded.

### Errors

- `400 Bad Request` — the request body is invalid, with the same `VALIDATION_ERROR` shape as above.
- `500 Internal Server Error` — the service could not complete the lookup.

## Errors

### `400 Bad Request`

The request is malformed or contains invalid values.

```json
{
  "error": "VALIDATION_ERROR",
  "message": "The request body is invalid",
  "fields": {
    "drugs[0].quantity": "Quantity must be greater than zero"
  }
}
```

### `422 Unprocessable Entity`

The request is valid, but a prediction cannot be provided for the submitted drug type or Midazolam variant.

```json
{
  "error": "MODEL_INPUT_UNAVAILABLE",
  "message": "A prediction is not currently available for this drug type",
  "drug": {
    "type": "Nimetazepam"
  }
}
```

### `429 Too Many Requests`

The client has exceeded the permitted request rate.

```json
{
  "error": "RATE_LIMITED",
  "message": "Too many prediction requests"
}
```

### `500 Internal Server Error`

The service could not complete the request.

```json
{
  "error": "INTERNAL_ERROR",
  "message": "The request could not be processed"
}
```

## Client guidance

- Send quantities in grams.
- Use the exact enum spelling and capitalization documented above.
- Do not send duplicate factor values.
- Do not send `variant` for non-Midazolam drugs.
- Treat `422` as an unavailable prediction, not as a client retry condition.
- Treat `429` as temporary and retry only after applying backoff.

