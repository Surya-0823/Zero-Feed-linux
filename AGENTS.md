# AGENTS.md

## 1. PURPOSE

This repository contains a multi-client application consisting of:

* Web application: landing page, Google authentication, onboarding, and user-facing flows.
* Electron desktop application.
* Chrome Extension.
* One centralized backend API.
* PostgreSQL database.

All clients use the same backend as the source of truth for authentication, users, subscriptions, payments, application state, and business rules.

The backend follows this architecture:

```text
Client
  ↓
API Route
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
PostgreSQL
```

The architecture exists to keep responsibilities explicit and easy to maintain.

---

# 2. CORE DEVELOPMENT RULE

## Evidence before assumptions.

Never invent project context.

Before changing code, inspect the repository and verify:

* Existing files
* Existing modules
* Existing routes
* Existing controllers
* Existing services
* Existing repositories
* Existing models
* Existing database schema
* Existing authentication flow
* Existing payment flow
* Existing configuration
* Existing dependencies
* Existing tests

If something cannot be verified, treat it as:

```text
UNKNOWN
```

Never silently convert an assumption into a fact.

---

# 3. USER REQUEST VS IMPLEMENTATION

The user's prompt describes the desired outcome.

It does NOT automatically define the implementation.

Before implementing:

1. Understand the requested behavior.
2. Inspect the existing implementation.
3. Identify the affected area.
4. Identify existing architectural patterns.
5. Identify constraints.
6. Identify unknowns.
7. Choose the smallest implementation that satisfies the request.

Do not immediately start coding after receiving a feature request.

---

# 4. DO NOT HALLUCINATE

Never claim that something exists unless it has been verified.

Do not invent:

* Files
* Functions
* Classes
* Routes
* APIs
* Database tables
* Database columns
* Environment variables
* Authentication behavior
* Payment behavior
* Libraries
* Configuration
* Existing features

Use these classifications when reasoning:

```text
VERIFIED
Confirmed directly from the repository.

USER-STATED
Explicitly provided by the user.

INFERRED
Reasonably derived from verified information.

UNKNOWN
Not established yet.
```

If an UNKNOWN item is important to implementation, investigate it.

If it cannot be discovered from the repository, ask the user.

---

# 5. INSPECT BEFORE MODIFYING

Before modifying a file:

1. Read the relevant implementation.
2. Read the callers/dependencies that matter.
3. Understand the data flow.
4. Check related configuration.
5. Check relevant tests.
6. Check whether an existing pattern already solves the problem.

Never modify a file based only on its filename or assumption about what it contains.

---

# 6. DISCOVER BEFORE ASKING

Do not ask the user for information that can be discovered from the repository.

Bad:

> Where is the authentication code?

First search the repository.

Ask the user only when:

* The repository cannot resolve the ambiguity.
* Two valid interpretations exist.
* A business decision is required.
* The requested behavior conflicts with an existing requirement.
* A destructive or irreversible decision requires explicit approval.

Ask the minimum necessary question.

---

# 7. ARCHITECTURE

The standard backend architecture is:

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
Database
```

## Controller

Controllers handle:

* HTTP requests
* Request validation
* Authentication context
* Calling services
* HTTP responses
* HTTP status codes

Controllers must NOT contain significant business logic.

---

## Service

Services contain:

* Business rules
* Application workflows
* Decisions
* Validation that depends on business rules
* Coordination between repositories and external services

Business decisions belong here.

Example:

```text
Can this user access the application?
Can this subscription be cancelled?
Should payment activate the subscription?
Should a trial expire?
```

---

## Repository

Repositories handle:

* Database queries
* Creating records
* Reading records
* Updating records
* Deleting records
* Database-specific operations

Repositories must NOT make business decisions.

A repository should answer:

> How do I access the data?

It should not answer:

> Should this operation be allowed?

---

## Model / Schema

Models define the application's data structure and database representation.

Do not duplicate or invent models when an existing model already represents the required data.

---

# 8. DATABASE

PostgreSQL is the source of truth for persistent application state.

Clients must NEVER connect directly to PostgreSQL.

The correct flow is:

```text
Electron
Chrome Extension
Web
      ↓
   Backend API
      ↓
   Repository
      ↓
 PostgreSQL
```

Never expose database credentials to:

* Browser code
* Chrome Extension code
* Electron renderer code
* Public frontend code

Database credentials belong only on the server.

---

# 9. SINGLE BACKEND

The Web application, Electron application, and Chrome Extension must use the same backend unless there is an explicit architectural reason not to.

Do not create duplicate business logic in individual clients.

For example, subscription status must be determined by the backend.

Correct:

```text
Chrome Extension
      ↓
GET /subscription
      ↓
Backend
      ↓
SubscriptionService
      ↓
Database
```

Incorrect:

```text
Chrome Extension
      ↓
Direct database access
```

---

# 10. AUTHENTICATION

The application uses Google authentication.

Do NOT implement username/password authentication unless explicitly requested.

Do NOT:

* Create password fields
* Store passwords
* Hash passwords
* Create password-reset systems
* Invent a local password database

Google is responsible for proving the user's identity.

The application backend is responsible for identifying the application user and managing application access.

Think of the responsibilities as:

```text
Google
  ↓
WHO IS THE USER?

Backend
  ↓
WHAT ACCOUNT DOES THIS USER HAVE?

Subscription
  ↓
HAS THE USER PAID?

Backend
  ↓
IS THE USER ALLOWED TO ACCESS THE PRODUCT?
```

Authentication and authorization must remain separate concepts.

---

# 11. USER ACCOUNT FLOW

The expected basic flow is:

```text
User
 ↓
Landing Page
 ↓
Continue with Google
 ↓
Google Authentication
 ↓
Backend
 ↓
Find existing user
      OR
Create user
 ↓
Check subscription
```

If subscription is active:

```text
User
 ↓
Google Login
 ↓
Backend
 ↓
Subscription ACTIVE
 ↓
Access Application
```

If subscription is not active:

```text
User
 ↓
Google Login
 ↓
Backend
 ↓
Subscription NOT ACTIVE
 ↓
Payment
```

Payment determines product access.

Google authentication does not determine whether the user has paid.

---

# 12. PAYMENTS

Supported payment providers may include:

* Razorpay
* Stripe

Payment providers must be treated as external services.

Never trust the frontend's payment-success message as the source of truth.

Correct flow:

```text
User
 ↓
Backend creates payment/order
 ↓
Payment Provider
 ↓
User pays
 ↓
Provider webhook
 ↓
Backend verifies webhook/payment
 ↓
PaymentService
 ↓
SubscriptionRepository
 ↓
Subscription = ACTIVE
```

The backend must verify payment before activating paid access.

Never do:

```text
Frontend says payment succeeded
        ↓
Immediately activate account
```

The frontend is not the authority for payment state.

---

# 13. PAYMENT PROVIDER SEPARATION

Keep provider-specific code isolated.

Do not scatter Razorpay-specific or Stripe-specific logic throughout the application.

Prefer:

```text
PaymentController
       ↓
PaymentService
       ↓
Payment Provider Adapter
       ↓
Razorpay / Stripe
```

The rest of the application should work with application-level concepts such as:

```text
Payment
Subscription
PaymentStatus
SubscriptionStatus
```

rather than depending everywhere on provider-specific objects.

Do not introduce an abstraction merely for theoretical flexibility. Add it when it keeps real provider-specific logic isolated and maintainable.

---

# 14. ACCOUNT ACCESS

The backend is the final authority for access.

Do not trust:

* Client-side flags
* Local storage
* Extension storage
* Electron local state
* Query parameters
* Frontend payment status
* Client-provided subscription status

The backend must determine:

```text
Who is the user?
Is the session valid?
Is the subscription active?
Is access allowed?
```

Clients display the result.

---

# 15. FEATURE IMPLEMENTATION WORKFLOW

For every feature, follow this sequence.

## Phase 1 — Understand

Determine:

```text
Goal:
What does the user actually want?

Affected area:
Which part of the system changes?

Expected behavior:
What should happen?

Unknowns:
What is not yet known?
```

Do not code yet.

---

## Phase 2 — Inspect

Inspect:

* Relevant source files
* Existing architecture
* Related database tables
* Related APIs
* Related services
* Related repositories
* Existing tests

Do not inspect the entire repository unnecessarily.

Investigate proportionally to the feature.

---

## Phase 3 — Plan

Before implementation, identify:

```text
Current behavior:
...

Required behavior:
...

Files to change:
...

Files to create:
...

Database changes:
...

API changes:
...

Business logic:
...

Risks:
...

Unknowns:
...
```

The plan must be based on verified repository evidence.

---

## Phase 4 — Implement

Implement only the requested feature.

Use the existing architecture.

Prefer:

```text
Existing pattern
    ↓
Extend it
```

over:

```text
New pattern
    ↓
Duplicate architecture
```

---

## Phase 5 — Verify

After implementation:

1. Inspect the changed files.
2. Inspect the final diff.
3. Run relevant tests.
4. Run relevant build/type/lint checks if available.
5. Verify the requested behavior.
6. Check for unintended changes.

Do not claim completion before verification.

---

# 16. MINIMAL CHANGE RULE

Make the smallest safe change that solves the requested problem.

Do NOT:

* Refactor unrelated code
* Rename unrelated files
* Replace frameworks
* Replace libraries
* Redesign the architecture
* Rewrite working systems
* Add unnecessary abstractions
* Add unnecessary dependencies
* Change unrelated UI
* "Improve" unrelated code

unless explicitly required.

If you identify a useful unrelated improvement:

```text
Do not implement it.

Mention it separately as a suggestion.
```

---

# 17. EXISTING PATTERN FIRST

Before creating a new:

* Controller
* Service
* Repository
* Model
* Utility
* API pattern
* Authentication pattern
* Payment pattern

search for an existing equivalent.

If one exists, follow it unless there is a clear reason not to.

Consistency is more important than introducing a theoretically better pattern for one feature.

---

# 18. NO SCOPE CREEP

The requested feature defines the scope.

Do not silently expand:

```text
Feature A
```

into:

```text
Feature A
+ architecture rewrite
+ UI redesign
+ database refactor
+ authentication rewrite
+ dependency upgrade
```

If another change is genuinely required, explain why before proceeding.

---

# 19. STOP CONDITIONS

STOP and ask instead of guessing when:

* Requirements are critically ambiguous.
* Existing implementations contradict each other.
* A required business rule is unknown.
* Payment behavior is unclear.
* Authentication behavior is unclear.
* A database migration could destroy data.
* A security-sensitive decision is unclear.
* The requested change conflicts with an existing product rule.
* The correct implementation cannot be determined from available evidence.

When stopping, report:

```text
Problem:
...

Evidence:
...

What is unknown:
...

Why guessing would be unsafe:
...

Question:
...
```

---

# 20. SECURITY

Never:

* Hardcode secrets.
* Commit API keys.
* Commit passwords.
* Expose database credentials.
* Put payment secrets in frontend code.
* Put Google client secrets in public client code.
* Trust client-provided authorization.
* Trust client-provided payment status.
* Log sensitive authentication/payment information unnecessarily.

Use environment variables or the project's established secret-management mechanism.

Never print secrets while debugging.

---

# 21. DATABASE SAFETY

Before modifying the database:

1. Inspect the current schema.
2. Understand existing relationships.
3. Check whether existing data is affected.
4. Use the project's migration mechanism.
5. Avoid destructive migrations unless explicitly required and approved.

Never casually:

```text
DROP DATABASE
DROP TABLE
DELETE production data
```

Never use destructive commands merely to "fix" development state without understanding their consequences.

---

# 22. EXTERNAL SERVICES

For external APIs such as:

* Google
* Razorpay
* Stripe
* Chrome APIs
* Electron APIs

verify the current project implementation and current official documentation when syntax or behavior matters.

Do not invent API fields, webhook events, endpoints, or SDK behavior.

---

# 23. CLIENT RESPONSIBILITIES

## Web

Responsible for:

* Landing page
* Google sign-in initiation
* Onboarding UI
* Payment UI
* User-facing application UI

The Web client must not contain authoritative business rules.

---

## Electron

Responsible for:

* Desktop UI
* Desktop-specific functionality
* Calling the backend API
* Presenting backend-controlled account state

Electron must not directly access the production database.

---

## Chrome Extension

Responsible for:

* Browser-specific functionality
* Extension UI
* Browser APIs
* Calling the backend API
* Enforcing client-side behavior based on backend state where appropriate

The extension must not contain secrets or directly access the production database.

---

# 24. SHARED BUSINESS TRUTH

The following must have one authoritative implementation in the backend:

* User identity
* Account state
* Subscription state
* Payment state
* Plan information
* Access permissions
* Product business rules

Do not duplicate these rules independently in:

* Web
* Electron
* Chrome Extension

Clients may cache or display state, but the backend remains authoritative.

---

# 25. ERROR HANDLING

Never hide errors merely to make a feature appear successful.

Do not use broad error handling such as:

```text
catch everything
ignore error
return success
```

Errors should be handled intentionally.

If an operation fails:

1. Identify the real cause.
2. Fix the cause when it is clear.
3. If the cause is unclear, report it.
4. Do not pretend the operation succeeded.

---

# 26. DEPENDENCIES

Before adding a dependency:

1. Check whether the repository already provides the capability.
2. Check whether an existing dependency can solve the problem.
3. Add a new dependency only when it provides meaningful value.

Do not add libraries merely because they are popular.

---

# 27. TESTING

Testing must match the risk of the change.

For business-critical features, prioritize tests around:

* Authentication
* Authorization
* Payments
* Subscription state
* Database operations
* API behavior
* Important business rules

Do not claim a feature is verified if the relevant behavior was not actually tested or inspected.

If tests cannot run because of missing infrastructure, state that clearly.

---

# 28. COMPLETION STANDARD

Never finish with only:

```text
Done.
```

Before declaring completion, confirm:

```text
[ ] Requested feature implemented
[ ] Existing architecture preserved
[ ] No unnecessary files changed
[ ] No unrelated refactoring
[ ] Database changes reviewed
[ ] Security implications reviewed
[ ] Relevant tests/checks executed
[ ] Final diff inspected
[ ] No known critical errors remain
```

---

# 29. FINAL RESPONSE FORMAT

Keep responses short and precise.

Use:

```text
Implemented:
- ...

Changed:
- ...

Verified:
- ...

Not verified:
- ...

Notes:
- ...
```

Do not provide long explanations unless the user asks.

Do not repeat the user's entire request.

Do not claim something was tested if it was not tested.

Do not claim something was verified if it was only inferred.

---

# 30. PRIORITY ORDER

When instructions conflict, use this priority:

1. Security and data safety
2. Explicit user requirements
3. Existing repository behavior
4. Existing project architecture
5. Existing tests and contracts
6. Project documentation
7. Engineering best practices
8. Agent assumptions

Agent assumptions are never stronger than verified repository evidence.

---

# 31. FINAL PRINCIPLE

The agent's job is NOT:

> "Write as much code as possible."

The agent's job is:

> "Understand the existing system, make the smallest correct change, and provide evidence that the change works."

When uncertain:

```text
Inspect → Verify → Decide
```

Never:

```text
Assume → Implement → Hope
```
