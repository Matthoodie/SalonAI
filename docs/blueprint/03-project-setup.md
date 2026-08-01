# Project Setup

---

# Introduction

Every software project begins long before the first feature is implemented.

A stable development environment, a clear repository structure, and a predictable workflow are essential foundations for sustainable engineering.

SalonAI was intentionally built from the ground up using modern development practices.

The objective of this phase was not to build business functionality, but to establish a development environment capable of supporting long-term growth.

---

# Initial Objectives

Before writing application logic, the project established the following objectives:

* create a stable frontend foundation,
* introduce version control from day one,
* define a scalable folder structure,
* separate development from production thinking,
* ensure every future milestone could be built on a reliable base.

This approach reduces technical debt during the earliest stages of development.

---

# Repository Structure

The project repository was created before any significant implementation work began.

The top-level repository contains:

```text
SalonAI/
├── docs/
├── frontend/
└── README.md
```

The repository is intentionally divided into independent areas.

The frontend contains the application itself.

The documentation directory contains the Engineering Blueprint and supporting technical documentation.

Keeping documentation inside the repository ensures that engineering knowledge evolves together with the source code.

---

# Frontend Initialization

The frontend application was created using React and Vite.

The initial goal was to establish:

* fast local development,
* hot module replacement,
* production-ready build tooling,
* minimal configuration,
* predictable project structure.

At this stage, no business functionality existed.

The application served only as a technical starting point.

---

# Git Workflow

Version control was introduced immediately.

Rather than treating Git as a backup mechanism, the project adopted Git as an engineering workflow.

The repository follows a simple branching strategy:

```text
main
└── development
```

The `main` branch represents verified, stable versions.

The `development` branch is used for active implementation and refactoring.

Every completed milestone concludes with:

* testing,
* production build verification,
* Git commit,
* GitHub synchronization.

---

# Development Environment

The project currently relies on:

* Node.js
* npm
* Git
* GitHub
* Visual Studio Code

Development is performed locally while GitHub serves as the remote repository and long-term project history.

---

# Running the Project

The frontend application is located inside the `frontend` directory.

Development commands are executed from that directory.

Typical workflow:

```bash
cd frontend
npm install
npm run dev
```

Production verification:

```bash
npm run build
```

A successful production build is considered mandatory before completing any milestone.

---

# Folder Organization

As the project evolved, folder organization became increasingly important.

The application follows a responsibility-based structure.

Pages represent complete application views.

Components represent reusable UI building blocks.

Data, assets, and documentation remain separated.

This separation improves readability and simplifies future expansion.

---

# Engineering Decisions

Several important engineering decisions were established during project setup.

## Documentation Lives Inside the Repository

Documentation should never exist separately from the project.

Keeping the Engineering Blueprint inside the repository ensures that implementation and documentation remain synchronized.

---

## Production Thinking From Day One

Although SalonAI is currently under development, engineering decisions are made with production deployment in mind.

Temporary solutions are clearly identified.

Future migration paths are considered before implementation.

---

## Small Iterations

Large development jumps increase risk.

The project favors incremental implementation.

Each completed step becomes a stable foundation for the next.

---

# Lessons Learned

Several important lessons emerged during the setup phase.

A clean project structure established early saves considerable effort later.

Version control becomes significantly more valuable when used consistently from the beginning.

Production build verification provides confidence that development changes have not introduced hidden issues.

Finally, documentation written during development is substantially more accurate than documentation written after implementation has been completed.

---

# Outcome

At the conclusion of the Project Setup phase, SalonAI possessed:

* a working React application,
* modern build tooling,
* version control,
* remote repository synchronization,
* a scalable repository structure,
* a documented engineering process,
* a clear foundation for future milestones.

This completed the technical foundation upon which every subsequent feature would be built.


---

# Engineering Decision Records

## EDR-001 — Repository Structure

### Decision

Separate the repository into dedicated areas for application code and engineering documentation.

### Alternatives Considered

- Store documentation outside the repository.
- Keep all files in a single project directory.

### Selected Solution

Keep the Engineering Blueprint inside the repository under the `docs/` directory.

### Reasoning

Documentation should evolve together with the source code.

Version control should preserve both implementation history and engineering knowledge.

Keeping documentation inside the repository ensures that architectural decisions remain synchronized with the project's evolution.

### Trade-offs

The repository becomes larger over time.

However, the benefits of centralized documentation significantly outweigh the additional repository size.

### Status

Accepted

---

## EDR-002 — Frontend Framework

### Decision

Use React with Vite for frontend development.

### Alternatives Considered

- Vue
- Angular
- Next.js

### Selected Solution

React + Vite

### Reasoning

The selected stack provides excellent developer experience, rapid iteration, a mature ecosystem, and long-term maintainability while remaining lightweight enough for the project's current stage.

### Trade-offs

React requires additional libraries for routing and state management.

These trade-offs are acceptable considering the flexibility gained.

### Status

Accepted

---

## EDR-003 — Version Control Workflow

### Decision

Introduce Git from the very beginning of the project.

### Alternatives Considered

Delay version control until the project becomes larger.

### Selected Solution

Git with dedicated `main` and `development` branches.

### Reasoning

Early version control enables safe experimentation, reliable recovery points, and a complete engineering history.

### Trade-offs

Slightly slower development due to disciplined commits.

The long-term benefits greatly outweigh the additional effort.

### Status

Accepted