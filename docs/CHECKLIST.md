# The 130-Point OpenAPI Validation Checklist

83 checks are automated in swagger-sentinel (marked ✅). 47 require human judgment (marked 👁).

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
| 11 | S11 | Terms of service URL specified | ✅ | Suggestion |
| 12 | — | API categorization is appropriate | 👁 | — |

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
| 22 | P24 | No HTTP verb names in path segments | ✅ | Warning |
| 23 | P25 | Path param names use consistent casing | ✅ | Suggestion |
| 24-30 | — | Resource abstraction, naming semantics, HATEOAS links, etc. | 👁 | — |

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
| 40 | O39 | HEAD defined wherever GET is defined | ✅ | Suggestion |
| 41 | O40 | PATCH uses merge-patch or json-patch content type | ✅ | Suggestion |
| 42 | O41 | operationIds don't redundantly prefix the HTTP method | ✅ | Suggestion |
| 43-52 | — | Idempotency, CORS preflight, rate-limit retry headers, etc. | 👁 | — |

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
| 60 | R57 | Fields with semantic names carry matching format | ✅ | Suggestion |
| 61 | R58 | Binary/file fields use multipart/form-data | ✅ | Warning |
| 62-68 | — | Complex pattern validation, custom validators, etc. | 👁 | — |

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
| 76 | R77 | 201 Created includes Location header | ✅ | Suggestion |
| 77 | R78 | List responses include total count | ✅ | Suggestion |
| 78 | R79 | Single-resource GETs define ETag or Last-Modified | ✅ | Suggestion |
| 79-88 | — | Content negotiation, link headers, partial content, etc. | 👁 | — |

## Security (14 checks)

| # | ID | Check | Auto | Severity |
|---|-----|-------|------|----------|
| 89 | SEC90 | Security schemes defined | ✅ | Warning |
| 90 | SEC91 | No API keys in query | ✅ | Error |
| 91 | SEC93 | Sensitive fields writeOnly | ✅ | Warning |
| 92 | SEC94 | Security applied globally or per-operation | ✅ | Suggestion |
| 93 | SEC95 | Production servers use HTTPS | ✅ | Error |
| 94 | SEC96 | OAuth2 flows define scopes | ✅ | Warning |
| 95 | SEC97 | Secured operations define 401 response | ✅ | Warning |
| 96 | SEC98 | Secured operations define 403 response | ✅ | Suggestion |
| 97 | SEC99 | No credentials embedded in server URLs | ✅ | Error |
| 98 | SEC100 | HTTP Basic auth is not used | ✅ | Warning |
| 99-102 | — | CORS headers, token expiry, mTLS, etc. | 👁 | — |

## Documentation (10 checks)

| # | ID | Check | Auto | Severity |
|---|-----|-------|------|----------|
| 103 | DOC110 | Parameters have descriptions | ✅ | Warning |
| 104 | DOC112 | Schemas have examples | ✅ | Warning |
| 105 | DOC115 | Deprecated ops have sunset date | ✅ | Warning |
| 106 | DOC116 | Tags have descriptions | ✅ | Suggestion |
| 107 | DOC117 | Operations include at least one response example | ✅ | Suggestion |
| 108 | DOC118 | Request bodies include an example | ✅ | Suggestion |
| 109-112 | — | Changelog, migration guide, webhook docs, etc. | 👁 | — |

---

Total: **130 checks** | Automated: **83** | Manual: **47**
