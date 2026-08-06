# Delta for Engineering Baseline

## MODIFIED Requirements

### Requirement: Money Is Integer Minor Units With Currency

Every monetary amount MUST be an integer minor-unit value paired with an ISO currency code. No monetary field MAY use a floating-point type. The minor unit MUST be the currency's smallest **practical** unit, as resolved by `Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits` — NOT the literal ISO 4217 exponent. COP resolves to 0 fraction digits (the practical minor unit is one peso); USD resolves to 2 (the practical minor unit is one cent).
(Previously: stated integer-minor-unit-plus-currency without pinning which fraction-digit source defines "minor unit," leaving COP's practical 0-digit unit ambiguous against a literal ISO-4217 exponent reading.)

#### Scenario: Money construction rejects non-integer amount or missing currency

- GIVEN the `Money` value object
- WHEN constructed with a non-integer amount, or without a currency code
- THEN construction MUST fail

#### Scenario: COP and USD resolve to different practical fraction digits

- GIVEN a `Money` value of 150000 minor units in `COP` and a `Money` value of 150000 minor units in `USD`
- WHEN each is formatted via `formatMoney` for its locale
- THEN the COP amount formats as 150,000 whole pesos (0 fraction digits) and the USD amount formats as 1,500.00 dollars (2 fraction digits)
- AND the two formatted outputs MUST be numerically distinguishable, not both reducible to the same digit sequence
