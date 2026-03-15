# The 130-Point OpenAPI Validation Checklist

62 checks are automated in swagger-sentinel (marked ✅). 68 require human judgment (marked 👁).

## Structure & Metadata (12 checks)

| # | ID | Check | Auto | Severity |
|---|-----|-------|------|----------|
| 1 | S01 | Info block includes contact | ✅ | Error |
| 2 | S02 | Version follows semver | ✅ | Error |
| 3 | S03 | Servers array defined | ✅ | Warning |
| 4 | S04 | At least one path defined | ✅ | Error |
| 5 | S05 | OpenAPI version 3.0.x or 3.1.x | ✅ | Error |
| 6 | S06 | Info has description | ✅ | Warning |
| 7 | S07 | License specified | ✅ | Suggestion |
| 8 | S08 | Title is descriptive | ✅ | Warning |
| 9 | S09 | External docs link provided | ✅ | Suggestion |
| 10 | S10 | Components exist when $ref used | ✅ | Error |
| 11 | — | API categorization is appropriate | 👁 | — |
| 12 | — | Terms of service for public APIs | 👁 | — |

## Path Design (18 checks)

| # | ID | Check | Auto | Severity |
|---|-----|-------|------|----------|
| 13 | P15 | Paths use kebab-case | ✅ | Warning |
| 14 | P16 | No trailing slashes | ✅ | Error |
| 15 | P17 | Plural resource naming | ✅ | Warning |
| 16 | P18 | Nesting ≤ 3 levels | ✅ | Warning |
| 17 | P19 | Versioning present | ✅ | Suggestion |
| 18 | P20 | No file extensions | ✅ | Warning |
| 19 | P21 | Consistent prefix | ✅ | Suggestion |
| 20 | P22 | No empty segments | ✅ | Error |
| 21 | P23 | Path params documented | ✅ | Error |
| 22-30 | — | Resource abstraction, naming semantics, HATEOAS links, etc. | 👁 | — |

## Operations (22 checks)

| # | ID | Check | Auto | Severity |
|---|-----|-------|------|----------|
| 31 | O31 | operationId on every operation | ✅ | Error |
| 32 | O31b | operationIds are unique | ✅ | Error |
| 33 | O32 | POST returns 201/202 not 200 | ✅ | Warning |
| 34 | O33 | DELETE returns 204 | ✅ | Warning |
| 35 | O34 | All operations tagged | ✅ | Warning |
| 36 | O35 | List operations paginated | ✅ | Warning |
| 37 | O36 | Operations have summary/description | ✅ | Warning |
| 38 | O37 | PUT/PATCH have request body | ✅ | Warning |
| 39 | O38 | Body preferred over query for mutations | ✅ | Suggestion |
| 40-52 | — | Idempotency, caching headers, ETags, CORS preflight, etc. | 👁 | — |

## Request Validation (16 checks)

| # | ID | Check | Auto | Severity |
|---|-----|-------|------|----------|
| 53 | R50 | Strings have maxLength | ✅ | Warning |
| 54 | R51 | Numbers have min/max | ✅ | Warning |
| 55 | R52 | Arrays have maxItems | ✅ | Warning |
| 56 | R53 | Request bodies have required | ✅ | Warning |
| 57 | R54 | Content type specified | ✅ | Error |
| 58 | R55 | Enums use consistent casing | ✅ | Warning |
| 59 | R56 | Parameters have descriptions | ✅ | Warning |
| 60-68 | — | Pattern validation, date formats, file size limits, etc. | 👁 | — |

## Response Design (20 checks)

| # | ID | Check | Auto | Severity |
|---|-----|-------|------|----------|
| 69 | R70 | Consistent error schema | ✅ | Warning |
| 70 | R71 | 4xx have response body | ✅ | Warning |
| 71 | R72 | 5xx defined | ✅ | Suggestion |
| 72 | R73 | All ops have responses | ✅ | Error |
| 73 | R74 | Success responses have content | ✅ | Warning |
| 74 | R75 | 429 has rate-limit headers | ✅ | Warning |
| 75 | R76 | Schemas define required | ✅ | Warning |
| 76-88 | — | Total count on lists, link headers, content negotiation, etc. | 👁 | — |

## Security (14 checks)

| # | ID | Check | Auto | Severity |
|---|-----|-------|------|----------|
| 89 | SEC90 | Security schemes defined | ✅ | Warning |
| 90 | SEC91 | No API keys in query | ✅ | Error |
| 91 | SEC93 | Sensitive fields writeOnly | ✅ | Warning |
| 92 | SEC94 | Security applied | ✅ | Suggestion |
| 93-102 | — | CORS, HTTPS enforcement, OAuth scopes, token expiry, etc. | 👁 | — |

## Documentation (10 checks)

| # | ID | Check | Auto | Severity |
|---|-----|-------|------|----------|
| 103 | DOC110 | Parameters have descriptions | ✅ | Warning |
| 104 | DOC112 | Schemas have examples | ✅ | Warning |
| 105 | DOC115 | Deprecated ops have sunset date | ✅ | Warning |
| 106 | DOC116 | Tags have descriptions | ✅ | Suggestion |
| 107-112 | — | Changelog, migration guide, SDK examples, webhook docs, etc. | 👁 | — |

---

Total: **130 checks** | Automated: **62** | Manual: **68**
