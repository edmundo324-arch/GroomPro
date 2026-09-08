# GroomPro Modular SaaS + Multi-Location Pricing

## Product architecture

GroomPro is a single multi-tenant SaaS platform. Each business (tenant) has isolated data and configuration. A tenant may have one or many locations.

### Customer visibility

Each tenant can choose whether customers are:

- **Location-specific** — a customer record is available only to selected locations.
- **Shared across locations** — the same customer record can be used by all locations in the tenant.
- **Selective sharing** — a customer can be shared with some locations while remaining unavailable to others.

Customer history remains one customer record when shared; it is not duplicated simply because the customer visits another location.

### Services and packages

Services and packages are defined at the business level and can be made available to one, several, or all locations.

A location may have its own price while still using the same business-level service/package definition.

## Pricing model

The pricing hierarchy is:

**Business base price → Location adjustment → Optional location-specific override**

Example service/package base price:

- Texas: base price $80
- Ohio: 10% lower
- Florida: 15% higher

Effective prices are calculated independently per location.

### Location adjustments

A location adjustment is a percentage relative to the business base price.

- 0% = business base price
- -10% = 10% below base
- +15% = 15% above base

Changing one location's adjustment does not change another location's adjustment.

### Location-specific override

A location can optionally set an exact price rather than using the percentage calculation. This is useful when a location needs an exact local price that should remain independent of the business base-price formula.

## Bulk package/service price increases

Management can apply a percentage increase to a selected group or all business-level packages/services.

Example:

| Package | Current base | +10% | New base |
|---|---:|---:|---:|
| Yorkie Small | $80.00 | $8.00 | $88.00 |
| Yorkie Medium | $86.00 | $8.60 | $94.60 |
| Yorkie Large | $92.00 | $9.20 | $101.20 |

The increase changes the **business base price**. Locations using percentage adjustments automatically calculate from the new base.

Example after the 10% business increase:

- Texas at 0% = $88.00
- Ohio at -10% = $79.20
- Florida at +15% = $101.20

A location with an exact price override remains at its override until that override is changed or removed.

## Independent location price increases

Each location can independently change its pricing without modifying the business base price or other locations.

For example, if Texas changes its local adjustment from 0% to +5%, Texas changes while Ohio and Florida remain unchanged.

This supports both:

1. **Centralized pricing management** — establish standard business prices and apply bulk increases.
2. **Local pricing management** — allow individual locations to adjust pricing for their market.

## Historical pricing

Price changes must not retroactively change completed tickets. A ticket stores the actual price charged at the time of sale. Future appointments use the effective price configuration applicable when the appointment/ticket is priced.

## Future subscription model

GroomPro will eventually be sold as a membership/subscription service. Subscription entitlements will determine which feature modules a business can activate, while the business controls which enabled features are available to each role/job title.

The platform therefore has four configuration layers:

1. **GroomPro platform** — feature catalog and capabilities.
2. **Subscription/entitlement** — which capabilities a business is licensed to use.
3. **Business/tenant** — which licensed modules are activated and how the business operates.
4. **Location + role** — local pricing, customer visibility, and employee permissions.

Customization such as colors, emojis, labels, workflows, reminder timing, and other operational preferences belongs to the business/location configuration layer rather than being hard-coded for Rubber Doggies.
