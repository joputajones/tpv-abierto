# Product specification

**Working name:** TPV Abierto — FloCafe Iberia  
**Document status:** Draft 0.1  
**Last updated:** 2026-07-29

## 1. Product statement

An open-source, local-first restaurant POS distribution based on FloCafe for Spanish bars and restaurants that want to reuse existing hardware and avoid mandatory subscriptions.

The restaurant pays for professional installation, migration, hardware configuration, optional training and human support. The core software, public training material and local diagnostics remain usable without a recurring fee.

## 2. Primary user

Independent bars and restaurants in Spain that:

- currently use a legacy POS or an incomplete installation;
- want mobile order taking from ordinary phones;
- need kitchen/bar printing or KDS;
- require normal operation without internet;
- prefer ownership and repairability over a mandatory SaaS contract;
- have limited internal technical capacity.

The first validation environment is one real restaurant currently using VirtuaPOS. Customer-specific data must remain outside the public repository.

## 3. Product principles

1. Local operation must not depend on internet access.
2. Failure recovery is more important than feature count.
3. The system must expose clear diagnostics before asking for human support.
4. Critical actions must be deterministic, auditable and reversible.
5. No mandatory cloud, payment processor or proprietary hardware.
6. Existing restaurant hardware should be reused when it passes a documented health check.
7. Updates must preserve data and support rollback.
8. Migration is a first-class product capability, not an improvised service.
9. Legal and fiscal compliance must be verified externally before being claimed.
10. FloCafe's MIT attribution and all third-party licence obligations must be preserved.

## 4. Initial product boundary

### Included in the pilot scope

- FloCafe baseline installation and build reproducibility.
- Products, categories, modifiers and users.
- Tables and dine-in orders.
- Mobile order-taking over the local network.
- KDS and/or kitchen/bar printing.
- Persistent order and print handling.
- Local backups and restore validation.
- Local diagnostics and guided troubleshooting.
- Operation during loss of internet connectivity.
- VirtuaPOS catalogue import, starting with the formats already obtained.
- Public training and troubleshooting documentation.

### Deliberately deferred

- Spanish fiscal production claims, VeriFactu and TicketBAI.
- Integrated card payments.
- Delivery marketplaces.
- Reservations, CRM and loyalty expansion.
- Advanced inventory and purchasing forecasts.
- Mandatory online AI services.
- Multi-site cloud synchronisation.
- Full rebranding before the baseline audit is complete.

## 5. MVP outcome

The MVP is successful when a restaurant can:

1. Install the system reproducibly on supported hardware.
2. Import a validated product catalogue from VirtuaPOS.
3. Open a table and enter an order from a phone on the local network.
4. Route items to the correct kitchen/bar destination.
5. Survive loss of internet without interrupting local service.
6. Restart the application without losing confirmed orders.
7. Detect and explain common network, printer and backup failures.
8. Restore a verified backup using documented steps.
9. Export its own data in a documented format.
10. Continue using the installed system without an active subscription.

## 6. Quality attributes

### Reliability

- No silent loss of accepted orders.
- Print jobs have persistent state and unique identifiers.
- Database migrations are non-destructive and tested against existing data.
- A failed update must not leave the restaurant without a recoverable version.

### Performance

Targets will be confirmed during the baseline audit. Initial operational goals:

- common order-entry actions feel immediate on the local network;
- a mobile client remains usable on ordinary low-end phones;
- the local server runs on modest x86-64 or ARM64 hardware without a dedicated GPU.

### Security and privacy

- No production default secrets.
- Least-privilege access for diagnostic and repair actions.
- No customer databases or personal data in the public repository.
- Diagnostic bundles must redact credentials and unnecessary transactional content.

### Maintainability

- Prefer small, reversible changes over rewrites.
- Every new database change requires a guarded migration and upgrade-path test.
- New external dependencies require a written justification.
- Architecture decisions with long-term impact require an ADR.

## 7. Business model constraint

The product must remain functional without a mandatory recurring payment.

Permitted revenue sources include:

- installation;
- migration;
- hardware preparation;
- network and printer configuration;
- on-site training;
- optional human support;
- optional managed services;
- custom integrations and development.

## 8. Open questions

- Does FloCafe's current secondary-device flow satisfy mobile waiter requirements?
- Is the current print queue sufficiently persistent and duplicate-safe?
- What changes are required for a low-maintenance appliance deployment?
- Which VirtuaPOS operational data exists in the full `C:\BLATTA` installation?
- Which fiscal architecture is appropriate for Spain without contaminating the non-fiscal pilot?
- Which parts should remain close to upstream and which justify a maintained fork?
