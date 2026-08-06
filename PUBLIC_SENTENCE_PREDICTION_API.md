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
| `drugs[].variant` | Conditional | Required only for `Midazolam`. |
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

For `Midazolam`, `variant` is required and must be one of:

- `powder`
- `tablet`

Example:

```json
{
  "type": "Midazolam",
  "quantity": 2,
  "variant": "tablet"
}
```

No `variant` field is required for other drug types.

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
- `Medical conditions`
- `Family illness`
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
      "months": 3,
      "years": 0.25
    },
    {
      "factor": "Plead guilty (earliest opportunity)",
      "category": "guiltyPlea",
      "direction": "decrease",
      "months": 20.5,
      "years": 1.71
    }
  ],
  "finalSentenceMonths": 42.5,
  "finalSentenceYears": 3.54
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
| `adjustments[].months` | Adjustment amount in months. |
| `adjustments[].years` | Adjustment amount in years. |
| `finalSentenceMonths` | Final predicted sentence in months. |
| `finalSentenceYears` | Final predicted sentence in years. |

Adjustment amounts are returned as positive values. Use `direction` to determine whether an amount is added or reduced.

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
    "neutralCitation": "HKSAR v Chan Kwok Ming [2019] HKCFI 1234",
    "title": "HKSAR v Chan Kwok Ming",
    "url": "https://www.hklii.hk/en/cases/hkcfi/2019/1234"
  },
  {
    "neutralCitation": "HKSAR v Wong Wai Shing [2018] HKCFI 987",
    "title": "HKSAR v Wong Wai Shing",
    "url": "https://www.hklii.hk/en/cases/hkcfi/2018/987"
  }
]
```

### Response fields

The response is a JSON array of case objects.

| Field | Description |
| --- | --- |
| `neutralCitation` | Neutral citation of the judgment. |
| `title` | Case title. |
| `url` | Link to the judgment. |

The number of returned cases is non-deterministic and currently ranges between 4 and 8. The recommendations are a placeholder implementation and do not yet reflect the request contents.

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

