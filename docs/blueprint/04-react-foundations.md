# React Foundations

---

# Introduction

SalonAI is built using React's component-based architecture.

Rather than treating React as a collection of isolated concepts, this project uses React as an engineering tool for building scalable software.

Every concept introduced in this chapter originates from a real implementation inside the application.

The objective is to understand not only how React works, but why each feature was introduced during development.

---

# Component-Based Architecture

The entire application is divided into independent components.

Each component has a single responsibility and should remain as self-contained as possible.

Examples include:

* Header
* Sidebar
* Layout
* DashboardCard
* ClientCard
* ClientForm
* AppointmentCard
* AppointmentForm

As the project grows, additional components can be introduced without affecting unrelated parts of the application.

This modular approach improves maintainability and encourages code reuse.

---

# Pages vs Components

SalonAI separates application views from reusable interface elements.

Pages represent complete screens:

```text
pages/
├── Dashboard/
├── Clients/
└── Appointments/
```

Components represent reusable UI building blocks:

```text
components/
├── ClientCard/
├── ClientForm/
├── AppointmentCard/
├── AppointmentForm/
├── DashboardCard/
├── Header/
├── Sidebar/
└── Layout/
```

A page coordinates business logic.

Components display or collect information.

This separation keeps responsibilities clear.

---

# Props

Props are used whenever a parent component provides information to one of its children.

Examples include:

* passing client data into ClientCard,
* passing appointment data into AppointmentCard,
* passing callback functions into forms,
* passing children into the Layout component.

Props allow components to remain reusable while avoiding duplicated logic.

---

# State Management

React state stores information that changes during application execution.

Current examples include:

* client list,
* appointment list,
* form inputs,
* editing state,
* validation messages.

State allows the interface to update automatically whenever data changes.

No manual page refresh is required.

---

# useState

The useState hook became the primary mechanism for managing interactive data.

It is currently responsible for:

* form values,
* lists of clients,
* lists of appointments,
* edit mode,
* validation state,
* summary updates.

State should always represent the current truth of the user interface.

Whenever state changes, React automatically re-renders affected components.

---

# useEffect

SalonAI currently uses useEffect to synchronize application data with Local Storage.

Whenever the client list or appointment list changes, the latest state is automatically persisted.

This approach provides persistent data without introducing a backend during the early development stages.

Future versions will replace Local Storage with API communication while preserving the same component architecture.

---

# Data Flow

SalonAI follows a predictable top-down data flow.

Parent components own application state.

Child components receive only the data they require.

When a child needs to modify data, it requests changes through callback functions provided by the parent.

This pattern keeps state centralized and predictable.

---

# Conditional Rendering

React conditionally renders interface elements based on application state.

Current examples include:

* empty appointment state,
* edit mode,
* validation messages,
* completed appointment status,
* summary counters.

Conditional rendering improves user experience while avoiding unnecessary interface complexity.

---

# Lists

Collections of clients and appointments are rendered using React's list rendering capabilities.

Each item requires a unique identifier.

Stable identifiers improve rendering performance and allow React to correctly update only modified elements.

---

# Routing

Navigation is handled using React Router.

Current application routes include:

* Dashboard
* Clients
* Appointments

Routing allows SalonAI to behave as a single-page application without requiring full page reloads.

The routing structure is expected to expand as new modules are introduced.

---

# Local Storage

During the current development phase, Local Storage functions as the application's persistence layer.

Its responsibilities include:

* storing clients,
* storing appointments,
* restoring application state after refresh.

Local Storage intentionally serves as a temporary solution until backend services become available.

The surrounding React architecture has been designed so that replacing Local Storage with API requests will require minimal changes.

---

# Engineering Decisions

Several engineering decisions define the current React architecture.

The application avoids unnecessary global state management libraries while the project remains relatively small.

State is lifted only when multiple components require access to the same information.

Component responsibilities remain intentionally narrow.

Business logic stays close to the page responsible for coordinating the workflow.

---

# Lessons Learned

Early investment in component organization significantly reduced complexity during later refactoring.

Separating pages from reusable components simplified navigation and future expansion.

Maintaining a predictable data flow made debugging considerably easier.

Most importantly, React's component model proved flexible enough to support continuous architectural improvements without requiring major rewrites.

---

# Outcome

At the completion of this phase, SalonAI established a scalable React architecture capable of supporting future modules such as calendars, employee management, authentication, AI assistants, and backend integration.

The application now possesses a strong frontend foundation while remaining flexible enough to evolve as business requirements grow.

---

# Engineering Decision Records

## EDR-004 — Component-Based Architecture

### Decision

Build the user interface using independent reusable React components.

### Alternatives Considered

* Large page-based components.
* Monolithic UI structure.

### Selected Solution

Modular component architecture.

### Reasoning

Reusable components improve readability, maintenance, testing, and future scalability.

### Trade-offs

More files must be managed.

However, reduced complexity outweighs the additional structure.

### Status

Accepted

---

## EDR-005 — Local State Management

### Decision

Use React's built-in state management during the foundation phase.

### Alternatives Considered

* Redux
* Zustand
* Context API for all application state

### Selected Solution

React state using useState and useEffect.

### Reasoning

The current application size does not justify introducing additional complexity.

Native React state remains sufficient and easier to understand.

### Trade-offs

State lifting becomes more common as the application grows.

Future Reassessment:

Evaluate centralized state management after backend integration if application complexity increases.

### Status

Accepted
