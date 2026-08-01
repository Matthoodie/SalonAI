# Development Philosophy

---

## Engineering Before Code

SalonAI is not built by writing as much code as possible.

It is built by making deliberate engineering decisions.

Every component, function, architectural change, and refactoring step must exist for a reason.

The goal is not rapid implementation.

The goal is sustainable development.

---

# Core Engineering Principles

## 1. Build for Production

Every feature should be developed as if it could remain in the production application.

Prototype-quality solutions are acceptable only when they are intentionally temporary and clearly documented.

Temporary decisions must never become permanent through neglect.

---

## 2. Solve One Problem at a Time

Large systems are built through small, verifiable improvements.

Each development session should have one primary objective.

Before moving forward, the current objective must be fully functional and tested.

Progress is measured by completed, stable features—not by the number of lines of code written.

---

## 3. Refactor Before Chaos

Code quality deteriorates gradually.

Small structural improvements performed early are significantly cheaper than large rewrites performed later.

Whenever architecture begins to feel inconsistent, refactoring takes priority over adding new features.

A clean foundation accelerates future development.

---

## 4. Test Every Milestone

No feature is considered complete until it has been tested.

Testing includes:

* functional testing,
* visual verification,
* regression testing,
* production build verification,
* user workflow validation.

Every milestone concludes with a successful production build.

---

## 5. Documentation Is Development

Documentation is not written after development.

Documentation is part of development.

Every significant architectural decision must be recorded while the reasoning is still fresh.

The Engineering Blueprint evolves together with the codebase.

---

## 6. Version Control Is a Safety System

Git is not merely a backup mechanism.

Git represents the project's engineering history.

Every meaningful change should be accompanied by:

* a logical commit,
* a descriptive commit message,
* a stable checkpoint.

Development should always allow safe recovery to a previously verified state.

---

## 7. Clarity Over Cleverness

Readable code is preferred over clever code.

Every future maintainer—including the original developer months later—should understand the implementation without unnecessary complexity.

Consistency is more valuable than novelty.

---

## 8. Single Responsibility

Every component should have one clear purpose.

When a component begins solving multiple unrelated problems, it should be divided into smaller components.

The same principle applies to CSS, utilities, hooks, and business logic.

---

## 9. Build the Foundation First

New features should never compensate for weak architecture.

Before introducing complexity, the underlying structure must be capable of supporting future growth.

Strong foundations reduce future development costs.

---

## 10. Think Beyond the Current Milestone

Every engineering decision should consider future expansion.

Current implementation should never unnecessarily limit future functionality.

Examples include:

* replacing localStorage with a database,
* introducing authentication,
* supporting multiple employees,
* supporting multiple businesses,
* adding AI assistants,
* scaling to SaaS infrastructure.

Today's code should anticipate tomorrow's architecture.

---

# Engineering Standards

The following standards apply throughout the entire project.

## Language

The engineering language is English.

This applies to:

* documentation,
* code,
* commit messages,
* architecture discussions,
* technical terminology.

The application interface may support multiple languages.

The engineering process does not.

---

## Project Structure

Every major component should own its implementation.

Example:

```text
ComponentName/
├── ComponentName.jsx
└── ComponentName.css
```

Features are organized according to responsibility rather than file type whenever practical.

---

## Small, Safe Steps

Large rewrites increase project risk.

Instead, development follows an incremental approach:

Design

↓

Implement

↓

Test

↓

Refactor

↓

Verify

↓

Commit

↓

Document

Every completed step becomes the foundation for the next.

---

## Failures Are Documentation

Engineering mistakes are valuable.

Whenever an implementation fails, the following should be documented:

* the original approach,
* why it failed,
* how the issue was identified,
* how it was resolved,
* what was learned.

The objective is continuous improvement rather than avoiding mistakes.

---

# Definition of Done

A feature is considered complete only when all of the following conditions are satisfied:

* functionality works correctly,
* code structure is consistent,
* production build succeeds,
* Git checkpoint is created,
* Engineering Blueprint is updated.

Until then, the feature remains in development.

---

# Engineering Values

The SalonAI Engineering Team values:

* clarity over complexity,
* consistency over speed,
* maintainability over shortcuts,
* quality over quantity,
* documentation as an engineering responsibility,
* continuous improvement,
* thoughtful design,
* long-term thinking.

---

# Final Principle

The objective of SalonAI is not simply to build software.

The objective is to build software that remains understandable, maintainable, scalable, and valuable long after its first release.

Every engineering decision should contribute to that objective.
