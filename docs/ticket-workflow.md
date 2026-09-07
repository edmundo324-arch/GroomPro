# GroomPro Ticket / Check-In Workflow

## Ticket structure

A ticket is one customer transaction and can contain any number of dogs.

Each dog is displayed as its own contiguous group:

- Dog 1
  - Prepping
  - Bathing
  - Grooming
  - Additional services / add-ons
  - Empty add-on row always available
- Dog 2
  - Prepping
  - Bathing
  - Grooming
  - Additional services / add-ons
  - Empty add-on row always available
- Dog 3
  - same pattern

A solid visual separator separates one dog from the next.

## Base package workflow

Every package has exactly three workflow services:

1. Prepping -> Prepared By
2. Bathing -> Washed By
3. Grooming -> Groomed By

These are workflow lines, not optional add-ons. They remain on the ticket and cannot be removed through normal line editing.

The employee assigned to each workflow line is recorded at the line level so multiple dogs on the same ticket can have different employees and commission can be calculated accurately.

## Add-ons

A dog can have any number of additional services/products.

Examples:

- All three dogs: Anal Situation, moisturizing paw massage, toothbrushing
- Dog 1 only: Furminator
- Dog 2 only: Dying paw colors
- Dog 3 only: Silvet Shampoo

The UI should make adding an item to the correct dog faster than navigating to a separate screen. The persistent empty add-on row is the primary fast-entry affordance.

## Dog-level operational fields

The ticket stores appointment-specific dog information separately from the permanent pet record, including:

- Weight at this visit
- Anal Situation:
  - DONE — REQUESTED
  - DONE — NOT REQUESTED
  - NOT NEEDED
- VIP Availability:
  - Available
  - Not Available
  - Needs a few more grooming sessions to qualify

## Whiteboard priority

The Whiteboard is touch-only. Employees choose priority from touch controls/dropdowns rather than typing numbers.

The working order is stable after the day's Whiteboard is prepared. A Sales Associate may intentionally change priority. Priority changes are attributable to the employee and are part of the operational history.

## Design principle

Minimize clicks. Surface the information needed for the current step and keep direct actions immediately available. Do not require staff to navigate away from the ticket to add ordinary services or change dog-level workflow information.
