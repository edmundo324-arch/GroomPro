-- Customer credit applied to a ticket is stored separately from the customer's remaining credit.
ALTER TABLE `Ticket`
  ADD COLUMN `accountCreditCents` INT NOT NULL DEFAULT 0;
