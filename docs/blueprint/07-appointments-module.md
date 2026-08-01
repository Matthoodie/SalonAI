# Appointments Module

## Part I — Business Domain

---

# Executive Summary

The Appointments module represents the first complete business workflow implemented within SalonAI.

While the Clients module introduced persistent business entities, the Appointments module transforms those entities into actionable business operations.

This milestone marks the transition from storing information to managing real business processes.

For the first time, the application becomes responsible for coordinating user interaction, validating business rules, maintaining application state, updating persistence, and reflecting changes throughout the interface.

The module establishes the operational core of SalonAI.

Nearly every future capability—including employee scheduling, AI recommendations, reporting, customer history, reminders, revenue tracking, and calendar visualization—depends on the architectural decisions introduced during this milestone.

For this reason, the Appointments module should be viewed as the operational engine of the platform rather than a standalone feature.

---

# Business Context

Appointments represent the primary activity of every service-based business.

A salon may offer dozens of services, employ multiple professionals, and serve hundreds of customers, yet almost every daily operation revolves around scheduled appointments.

An appointment connects multiple business entities into a single workflow.

It answers questions such as:

* Who is the customer?
* Which service has been requested?
* When will the service be performed?
* What is the current status?
* Which employee is responsible?
* Has the service already been completed?

Without appointments, customer records become static information.

Appointments transform data into business activity.

---

# Problem Statement

Prior to implementing this module, SalonAI could successfully store customer information but could not coordinate the actual operation of a salon.

There was no mechanism for planning work.

No representation of scheduled services existed.

No workflow could progress from creation to completion.

The application lacked a business process capable of modelling the daily operation of a real salon.

The objective of this milestone was therefore much broader than introducing another collection of components.

The objective was to establish the first complete operational workflow.

---

# Engineering Context

At the time this module was implemented, the application intentionally remained frontend-only.

The engineering team deliberately postponed backend development in order to validate business workflows before introducing network communication and database infrastructure.

Several constraints existed:

* no REST API,
* no authentication,
* no server-side validation,
* no relational database,
* no concurrent users.

Despite these limitations, the architecture was designed to resemble a production environment as closely as possible.

Business logic remained independent from the persistence mechanism.

Application state remained centralized.

Future backend migration was considered throughout the implementation.

---

# Engineering Objectives

The Appointments module was designed around several independent engineering objectives.

---

## Objective 1 — Introduce the First Complete Workflow

Unlike previous modules, appointments involve an entire lifecycle.

Users should be able to:

* create appointments,
* review appointments,
* modify appointments,
* complete appointments,
* remove appointments when necessary,
* preserve appointments between browser sessions.

The workflow should remain predictable regardless of the number of appointments stored.

---

## Objective 2 — Establish Business State

Not every appointment exists in the same condition.

Some appointments are upcoming.

Others are completed.

Future versions may also introduce cancelled, confirmed, or rescheduled appointments.

The module therefore introduces the concept of business state rather than treating every record identically.

This decision becomes fundamental for future analytics and reporting.

---

## Objective 3 — Separate Workflow from Presentation

Creating appointments should not be coupled directly to rendering appointment cards.

Business coordination belongs to the page.

Presentation belongs to reusable components.

Validation belongs to the form.

This separation minimizes coupling while improving maintainability.

---

## Objective 4 — Prepare for Calendar Integration

Although the current interface displays appointments as cards, the underlying architecture anticipates future calendar-based visualization.

The appointment model therefore focuses on business information rather than presentation format.

Whether appointments are displayed as cards, calendar events, timeline entries, or AI summaries should not require modifications to the underlying domain model.

---

## Objective 5 — Prepare for Multi-Employee Scheduling

The initial implementation intentionally postpones employee assignment.

Nevertheless, the architecture avoids assumptions that would prevent future scheduling across multiple employees.

Appointments are treated as independent business objects capable of evolving without architectural redesign.

---

# Functional Requirements

The first production-ready implementation of the Appointments module should support the following operations.

### Create Appointment

Users must be able to create a new appointment using a structured form.

---

### Display Appointment

Every stored appointment should be presented consistently using reusable presentation components.

---

### Update Appointment

Existing appointments should support editing without requiring deletion and recreation.

---

### Complete Appointment

Appointments should transition into a completed state while preserving historical information.

---

### Delete Appointment

Appointments should be removable when they are no longer relevant.

Deletion should update both application state and persistence.

---

### Restore Application State

Refreshing the application should restore all previously stored appointments automatically.

Persistence should remain transparent to the user.

---

# Domain Model

At this stage of development, every appointment contains the information required to support the current workflow while remaining intentionally extensible.

The model represents one scheduled business activity.

Although relatively compact, it has been designed with future expansion in mind.

Planned additions include:

* employee assignment,
* service duration,
* pricing,
* payment status,
* notes,
* reminders,
* recurrence,
* AI recommendations,
* customer history,
* synchronization metadata.

The existing architecture anticipates these extensions without requiring structural redesign.

---

# Design Philosophy

The Appointments module follows one central engineering principle:

**A business workflow should remain independent from the way it is presented.**

Cards are simply one visualization.

The underlying appointment remains the true business object.

This distinction becomes increasingly important as the application grows.

Future interfaces—including calendars, dashboards, AI assistants, and reporting modules—should all consume the same appointment data while presenting it differently according to user needs.

This philosophy significantly reduces duplication and preserves architectural consistency.

---

# End of Part I

The following section documents the internal architecture of the Appointments module, including component hierarchy, state ownership, persistence strategy, data flow, engineering rationale, and implementation decisions that transform the domain model into a functioning business workflow.


# Part II — Architecture & Workflow Architecture

---

# Architectural Overview

Unlike the Clients module, which primarily introduced persistent business entities, the Appointments module coordinates an entire business workflow.

An appointment is not simply a stored record.

It represents an activity that progresses through multiple stages during its lifetime.

For this reason, the architecture was designed around workflow orchestration rather than static data presentation.

The page coordinates business operations.

Specialized components manage interaction and presentation.

Persistence remains isolated from user interface logic.

This separation ensures that future business rules can evolve without requiring large-scale interface redesign.

---

# Module Structure

The Appointments module consists of three primary components.

```text
Appointments/
├── Appointments.jsx
└── Appointments.css

AppointmentForm/
├── AppointmentForm.jsx
└── AppointmentForm.css

AppointmentCard/
├── AppointmentCard.jsx
└── AppointmentCard.css
```

Each component owns both its implementation and visual presentation.

This organization minimizes coupling and improves long-term maintainability.

---

# Component Responsibilities

## Appointments Page

The Appointments page serves as the orchestration layer.

Its responsibilities include:

* owning appointment state,
* coordinating business workflows,
* communicating with Local Storage,
* managing editing state,
* updating summary information,
* passing callbacks into child components,
* rendering collections of appointments.

The page intentionally avoids detailed presentation logic.

Its primary purpose is coordination.

---

## AppointmentForm

The AppointmentForm component collects and validates user input.

Responsibilities include:

* displaying appointment fields,
* validating required information,
* creating appointments,
* editing appointments,
* resetting the form,
* cancelling edit mode.

The form never owns the appointment collection.

Instead, it communicates requested changes back to the parent component through callback functions.

---

## AppointmentCard

AppointmentCard represents one business transaction.

Its responsibilities include:

* presenting appointment information,
* displaying current appointment status,
* exposing available user actions,
* requesting edit operations,
* requesting deletion,
* requesting completion.

The component deliberately avoids business ownership.

It informs the parent what the user requested without directly modifying application state.

---

# Separation of Responsibilities

The module intentionally separates four independent concerns.

| Responsibility    | Owner               |
| ----------------- | ------------------- |
| Business workflow | Appointments        |
| User input        | AppointmentForm     |
| Presentation      | AppointmentCard     |
| Persistence       | Local Storage layer |

This separation significantly reduces hidden dependencies between unrelated parts of the module.

Future modifications remain localized.

---

# Data Ownership

Appointments are owned exclusively by the parent page.

Child components never duplicate appointment collections.

Instead, data follows a predictable one-directional flow.

```text
Appointments

↓

AppointmentForm

↓

User Action

↓

Appointments

↓

React State

↓

AppointmentCard

↓

Rendered Interface
```

Every interface update originates from state.

The rendered UI is always a consequence of application data.

---

# State Management

The Appointments module introduces several independent categories of state.

These include:

* appointment collection,
* currently edited appointment,
* form values,
* validation messages,
* completion status.

Each category exists for a specific purpose.

State duplication is intentionally avoided.

Whenever multiple components require identical information, ownership remains with the parent page.

---

# Appointment Lifecycle

One of the defining architectural characteristics of this module is the appointment lifecycle.

Unlike static entities, appointments continuously evolve.

The lifecycle currently follows this sequence.

```text
Appointment Created

↓

Validated

↓

Added to React State

↓

Persisted to Local Storage

↓

Rendered

↓

Edited (optional)

↓

Updated

↓

Completed

↓

Persisted Again

↓

Restored After Browser Refresh
```

This lifecycle became the reference workflow for future business entities inside SalonAI.

---

# Persistence Layer

Although Local Storage currently acts as the persistence mechanism, the surrounding architecture deliberately avoids coupling application logic to browser storage.

Business operations update application state.

Persistence reacts to those updates.

This distinction allows Local Storage to be replaced later by REST API requests without changing the user workflow.

From the user's perspective, persistence remains invisible.

---

# Validation Strategy

Validation is intentionally performed before business state changes.

This guarantees that invalid appointments never enter the application state.

Current validation focuses on:

* required fields,
* empty values,
* consistent submission flow.

More advanced business validation will be introduced after backend integration.

Examples include:

* overlapping appointments,
* employee availability,
* working hours,
* duplicate bookings.

---

# Design Rationale

Several implementation strategies were considered during development.

### Option A

Allow each AppointmentCard to modify itself.

Advantages:

* fewer callbacks,
* smaller parent component.

Disadvantages:

* duplicated logic,
* inconsistent state,
* synchronization problems,
* difficult debugging.

---

### Option B

Centralize every business operation inside the parent page.

Advantages:

* predictable state,
* easier debugging,
* reusable presentation,
* cleaner architecture,
* future backend compatibility.

Selected.

Although this approach introduces additional callback functions, the resulting architecture remains considerably easier to maintain.

---

# Engineering Discussion

The Appointments module became the first part of SalonAI where engineering architecture directly mirrored a real business workflow.

Rather than thinking in terms of interface components, development shifted toward modelling business operations.

This change represented an important evolution in the project.

The application was no longer rendering information.

It was coordinating business processes.

That distinction significantly influenced every architectural decision introduced during this milestone.

---

# Engineering Pattern

## Pattern Name

Parent-Orchestrated Workflow

### Problem

Multiple interface components require access to the same business process.

### Solution

A single parent component coordinates workflow while child components remain specialized.

### Benefits

* centralized business logic,
* reusable presentation,
* predictable state,
* simplified testing,
* backend-ready architecture.

### Used In

* Clients Module
* Appointments Module

Future modules should adopt the same pattern whenever business workflows involve multiple reusable components.

---

# End of Part II

The next section documents the complete operational lifecycle of an appointment, including creation, editing, completion, deletion, Local Storage synchronization, manual validation strategy, implementation details, and engineering decisions that transformed the workflow into a production-oriented architecture.


# Part III — Business Workflow & Implementation

---

# Workflow Overview

The implementation of the Appointments module revolves around a single business object: the appointment.

Although the user perceives appointment management as a simple interaction with forms and cards, the application internally coordinates a sequence of independent engineering responsibilities.

Each responsibility performs one specific task before handing control to the next stage of the workflow.

This layered execution model minimizes coupling, simplifies debugging, and ensures predictable application behaviour.

---

# Complete Appointment Lifecycle

Every appointment progresses through a well-defined lifecycle.

```text
User Interaction

↓

Input Collection

↓

Validation

↓

Business Object Creation

↓

React State Update

↓

Component Re-render

↓

Persistence Synchronization

↓

User Interaction Continues

↓

Editing / Completion / Deletion

↓

Persistence Update

↓

Application Restoration
```

Each stage represents a separate engineering responsibility rather than a single implementation step.

---

# Stage 1 — User Interaction

The workflow begins when the user decides to schedule a new appointment.

At this point, no business object exists.

The application simply exposes an interface through which information can be collected.

The AppointmentForm component becomes responsible for initiating the workflow.

Its only purpose during this stage is to collect information.

No persistence occurs.

No state changes occur.

No business logic has yet been executed.

---

# Stage 2 — Input Collection

The user gradually provides appointment information.

Typical fields include:

* client,
* service,
* appointment date,
* appointment time.

Each input immediately updates the component's internal form state.

At this stage, information remains temporary.

The appointment does not yet exist inside the application.

---

# Stage 3 — Validation

Before creating an appointment, the application verifies that all required information has been provided.

Validation intentionally occurs before modifying business state.

Invalid information never reaches the application's primary appointment collection.

Current validation remains intentionally lightweight.

Its primary objective is protecting data consistency during early development.

Future backend validation will significantly extend these rules.

---

# Stage 4 — Business Object Creation

Once validation succeeds, the temporary form information becomes a genuine business object.

The application creates a complete appointment containing all required properties.

From this point onward, the appointment becomes part of SalonAI's business domain rather than temporary interface state.

This transition represents one of the most important conceptual boundaries inside the module.

---

# Stage 5 — State Synchronization

The newly created appointment is inserted into the application's primary state.

React immediately recognizes the state update.

Rather than manipulating the user interface directly, React recalculates the virtual component tree and updates only the elements affected by the modification.

This behaviour guarantees consistency between business data and presentation.

The rendered interface never becomes the source of truth.

State remains the only authoritative representation of the application's current condition.

---

# Stage 6 — Automatic Rendering

Following the state update, the application automatically renders the latest appointment collection.

Each AppointmentCard receives only the information necessary to display one business object.

Rendering remains completely independent from storage.

Presentation components neither understand nor influence persistence.

Their responsibility begins and ends with visual representation.

---

# Stage 7 — Persistence Synchronization

The application's persistence layer observes changes made to appointment state.

Whenever the appointment collection changes, the latest version is automatically synchronized with Local Storage.

Importantly, persistence does not initiate business operations.

Persistence merely reflects them.

This distinction significantly simplifies future migration toward backend services.

Replacing Local Storage with REST API communication should require changes only within the persistence layer while leaving business workflows largely unchanged.

---

# Stage 8 — Editing Workflow

Appointments rarely remain unchanged throughout their lifetime.

Customers reschedule.

Services change.

Times require adjustment.

Rather than deleting existing appointments, the module supports modification of previously created records.

Editing follows the same architectural philosophy as creation.

The existing business object becomes the source of editable information.

The AppointmentForm temporarily enters edit mode while preserving centralized ownership of appointment state.

After successful validation, the updated business object replaces its previous version.

The workflow therefore remains consistent regardless of whether the appointment is being created or modified.

---

# Stage 9 — Completion Workflow

Completing an appointment represents a business transition rather than a visual effect.

The appointment changes its business status.

Presentation reacts automatically.

Future analytics, reporting, customer history, employee statistics, and AI recommendations will all depend upon this status transition.

For this reason, completion is treated as a meaningful business event rather than a cosmetic interface change.

---

# Stage 10 — Deletion Workflow

Deletion permanently removes an appointment from the application's primary state.

Immediately afterwards:

* React re-renders the appointment collection,
* Local Storage synchronizes,
* summary information updates,
* the interface reflects the latest business state.

Deletion therefore affects multiple parts of the application while remaining coordinated by a single business workflow.

---

# Stage 11 — Application Restoration

When the application starts, previously stored appointments are restored automatically.

Users experience a continuous workflow despite browser refreshes.

Although Local Storage currently provides persistence, the restoration process intentionally resembles future backend behaviour.

From the user's perspective, appointments simply remain available.

The implementation detail remains invisible.

---

# Business Workflow Analysis

The operational lifecycle of an appointment extends beyond technical implementation.

From a business perspective, the workflow currently follows this sequence.

```text
Customer Requests Service

↓

Appointment Created

↓

Stored

↓

Displayed

↓

Modified (if required)

↓

Completed

↓

Stored Again

↓

Available For Future History
```

Future versions of SalonAI will extend this workflow to include:

```text
Customer Request

↓

Availability Verification

↓

Employee Assignment

↓

Appointment Confirmation

↓

Reminder Automation

↓

Service Execution

↓

Payment Processing

↓

Business Analytics

↓

AI Recommendation Engine
```

The current implementation intentionally establishes a workflow capable of evolving into these future stages without fundamental architectural redesign.

---

# Engineering Discussion

One of the most significant engineering achievements of this module lies in the distinction between business workflows and user interface components.

The AppointmentForm does not create appointments.

It requests creation.

The AppointmentCard does not modify appointments.

It requests modification.

The Appointments page alone coordinates business operations.

This architectural discipline dramatically reduces hidden dependencies while preserving predictable behaviour throughout the application.

As the project continues to grow, this orchestration model will remain one of the defining characteristics of SalonAI's engineering architecture.

---

# End of Part III

The final section evaluates the Appointments module through testing strategy, engineering review, technical debt analysis, future evolution, lessons learned, and formal Engineering Decision Records.


# Part IV — Validation, Engineering Review & Future Evolution

---

# Validation Strategy

The Appointments module was developed using an incremental validation approach.

Each business capability was implemented and verified independently before introducing the next layer of complexity.

Rather than validating only the final outcome, every transition within the appointment lifecycle was tested individually.

This methodology reduced debugging complexity while increasing confidence in the stability of each completed workflow.

The objective was not simply to verify functionality.

The objective was to verify the correctness of the underlying business process.

---

## Appointment Creation

Creating an appointment represents the entry point of the business workflow.

Validation confirmed that:

* all required fields are accepted,
* invalid submissions are rejected,
* successful submissions create a complete appointment object,
* the user interface updates immediately,
* newly created appointments become part of the primary application state.

The workflow must complete without requiring a browser refresh.

---

## Appointment Editing

Editing existing appointments required validation of several independent behaviours.

The application must:

* correctly load the selected appointment into the form,
* preserve existing information,
* update only the selected appointment,
* replace outdated information without duplication,
* exit edit mode after successful completion.

The editing workflow intentionally mirrors the creation workflow to minimize behavioural inconsistencies.

---

## Appointment Completion

Completing an appointment represents a business transition rather than a visual interaction.

Validation confirmed that:

* the appointment status changes successfully,
* completed appointments remain available,
* subsequent interface updates remain consistent,
* future analytical information can rely on the recorded completion state.

Completion therefore preserves historical business information rather than removing it.

---

## Appointment Deletion

Deletion permanently removes an appointment from the application's primary state.

Validation confirms that:

* the selected appointment disappears,
* remaining appointments remain unaffected,
* Local Storage updates correctly,
* summary information remains synchronized.

Deletion affects several parts of the application while remaining coordinated through a single workflow.

---

## Persistence Validation

Local Storage synchronization was verified throughout every business operation.

The following scenarios were tested:

* creating appointments,
* editing appointments,
* completing appointments,
* deleting appointments,
* refreshing the browser.

Successful restoration after refresh demonstrates that persistence accurately reflects application state.

---

# Common Engineering Mistakes

Several architectural problems commonly appear in appointment management systems.

The implementation intentionally avoids these issues.

---

## State Duplication

Business data should exist only once.

Duplicated appointment collections increase synchronization complexity and frequently introduce inconsistent behaviour.

SalonAI maintains a single authoritative appointment collection.

---

## Direct Component Communication

Presentation components should never communicate directly with one another.

Every interaction remains coordinated through the parent page.

This architecture preserves predictable state transitions.

---

## Coupling Workflow to Presentation

Business workflows should never depend upon the current interface layout.

Whether appointments appear as cards, calendar entries, tables, or AI summaries should not influence the underlying workflow.

This separation significantly improves long-term scalability.

---

## Storage-Driven Business Logic

Business decisions should never originate from Local Storage.

Persistence reflects business state.

It does not define business state.

This distinction becomes critical during backend migration.

---

## Premature Enterprise Features

The current implementation intentionally postpones advanced scheduling functionality.

Examples include:

* recurring appointments,
* employee conflict detection,
* working hours,
* online booking,
* calendar synchronization,
* automated reminders.

These capabilities remain future engineering objectives rather than immediate implementation priorities.

---

# Future Evolution

The Appointments module has been designed for continuous expansion.

Future milestones are expected to introduce:

* calendar visualization,
* employee scheduling,
* drag-and-drop rescheduling,
* reminder automation,
* online booking,
* customer confirmations,
* payment tracking,
* service duration management,
* recurring appointments,
* appointment templates,
* AI scheduling recommendations,
* predictive availability,
* conflict detection,
* synchronization with external calendar providers.

The existing architecture deliberately anticipates these additions.

No fundamental redesign should be required.

---

# Engineering Review

## Strengths

The module successfully models an authentic business workflow.

Responsibilities remain clearly separated.

State ownership remains predictable.

Business operations remain centralized.

Presentation components remain reusable.

Persistence remains isolated.

The architecture provides an excellent foundation for future backend integration.

---

## Weaknesses

Current validation remains intentionally lightweight.

Business rules remain relatively simple.

Employee scheduling has not yet been introduced.

Calendar visualization does not yet exist.

Persistence remains browser-dependent.

These limitations were consciously accepted during the current phase of development.

---

## Technical Debt

Several temporary engineering decisions remain outstanding.

Current persistence relies on Local Storage.

Identifiers remain locally generated.

Business validation remains frontend-only.

Conflict detection has not yet been implemented.

Authentication is not yet available.

These decisions are documented and scheduled for replacement during future milestones.

---

## Readiness Assessment

Architecture:

★★★★★

Maintainability:

★★★★★

Scalability:

★★★★★

Business Workflow:

★★★★★

Production Readiness:

★★★☆☆

Overall Engineering Readiness:

**9.4 / 10**

The module establishes a production-quality architectural foundation while intentionally postponing infrastructure-dependent functionality.

---

# Lessons Learned

The Appointments module demonstrated that modelling business workflows is fundamentally different from rendering user interface components.

The most valuable engineering lesson was recognizing that application state should represent business reality rather than interface behaviour.

Separating orchestration from presentation significantly simplified development and reduced long-term architectural complexity.

Designing workflows before introducing backend infrastructure also proved highly beneficial.

By validating business processes first, future backend implementation becomes substantially more straightforward.

---

# Outcome

The completion of the Appointments module transformed SalonAI into a functional operational platform.

The application now supports a complete business workflow from creation through persistence, modification, completion, and restoration.

The engineering patterns established throughout this milestone now serve as reference architecture for future business domains.

With the introduction of appointments, SalonAI evolved from managing information to coordinating real operational processes.

---

# Engineering Decision Records

## EDR-011 — Appointment Lifecycle Architecture

### Decision

Model appointments as business objects progressing through a defined lifecycle.

### Alternatives Considered

Treat appointments as simple static records.

### Selected Solution

Lifecycle-based workflow architecture.

### Reasoning

Business workflows evolve over time.

Representing appointments as lifecycle-driven entities better reflects real operational processes while supporting future reporting, analytics, and AI functionality.

### Trade-offs

Slightly greater architectural complexity during early development.

The resulting flexibility significantly outweighs the additional implementation effort.

### Status

Accepted

---

## EDR-012 — Parent Workflow Orchestration

### Decision

Centralize every appointment operation within the Appointments page.

### Alternatives Considered

Allow child components to modify business state independently.

### Selected Solution

Parent-controlled workflow orchestration.

### Reasoning

Centralized orchestration guarantees predictable behaviour, consistent state management, simplified debugging, and improved backend compatibility.

### Trade-offs

Additional callback functions between components.

The architectural clarity justifies the increased communication.

### Status

Accepted

---

## EDR-013 — Temporary Browser Persistence

### Decision

Use Local Storage as the temporary persistence layer during frontend development.

### Alternatives Considered

Immediate backend implementation.

No persistence.

IndexedDB.

### Selected Solution

Local Storage.

### Reasoning

Frontend workflows should mature before introducing backend infrastructure.

This approach accelerates iteration while preserving realistic user behaviour.

### Trade-offs

Data remains browser-specific.

Multi-device synchronization is unavailable.

### Future Reassessment

Replace Local Storage with PostgreSQL after completion of the backend architecture.

### Status

Accepted

---

## EDR-014 — Workflow Before Infrastructure

### Decision

Validate complete business workflows before implementing backend services.

### Alternatives Considered

Develop frontend and backend simultaneously.

### Selected Solution

Workflow-first development.

### Reasoning

Business processes should be fully understood before infrastructure is introduced.

This reduces unnecessary backend redesign and encourages cleaner domain modelling.

### Trade-offs

Temporary frontend-only persistence.

Backend implementation occurs later in the project timeline.

### Status

Accepted
