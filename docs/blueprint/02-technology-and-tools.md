# Technology & Engineering Stack

---

# Introduction

Selecting technologies is one of the most important engineering decisions in any software project.

Every technology used in SalonAI has been chosen intentionally.

The objective is not to use the newest tools available, but to build a stable, maintainable, scalable, and production-ready SaaS platform.

Whenever multiple technologies satisfy the same requirement, preference is given to the one that improves long-term maintainability, developer productivity, and ecosystem maturity.

---

# Frontend

## React

React was selected as the primary frontend library because of its mature ecosystem, component-based architecture, and excellent scalability.

The application is expected to grow significantly over time.

A component-driven architecture makes it possible to divide complex interfaces into smaller, reusable building blocks.

Benefits include:

* reusable components,
* predictable UI architecture,
* excellent community support,
* long-term maintainability,
* compatibility with modern tooling.

React is widely adopted across the software industry, making future collaboration significantly easier.

---

## Vite

Vite was selected as the frontend build tool.

Reasons include:

* extremely fast development server,
* instant Hot Module Replacement (HMR),
* minimal configuration,
* optimized production builds,
* excellent React integration.

Fast feedback during development increases productivity and encourages frequent testing.

---

## React Router

React Router provides client-side routing.

Instead of reloading pages, SalonAI behaves like a desktop application where navigation is immediate.

Current application routes include:

* Dashboard
* Clients
* Appointments

Future modules will extend this routing architecture without requiring structural changes.

---

# Styling

The project currently uses modular CSS.

Each major component owns its stylesheet.

Example:

```text
ClientCard/
├── ClientCard.jsx
└── ClientCard.css
```

Advantages include:

* localized styling,
* easier maintenance,
* fewer selector conflicts,
* improved readability.

Styling responsibility remains close to the component that owns it.

---

# Version Control

## Git

Git records every engineering decision throughout the project's lifetime.

Git is treated as an engineering safety system rather than a simple backup solution.

Every significant milestone concludes with:

* testing,
* production build verification,
* descriptive commit,
* Git checkpoint.

This workflow enables safe experimentation while preserving stable recovery points.

---

## GitHub

GitHub serves as:

* remote repository,
* collaboration platform,
* version history,
* project showcase,
* deployment integration.

Every verified milestone is synchronized with GitHub.

---

# Runtime Environment

## Node.js

Node.js provides the runtime environment for both frontend tooling and future backend services.

It powers:

* package management,
* development tooling,
* build process,
* future Express backend.

Using JavaScript across the entire stack simplifies development and reduces context switching.

---

## npm

npm manages project dependencies.

Responsibilities include:

* dependency installation,
* script execution,
* package version management,
* development tooling.

Typical commands include:

* npm install
* npm run dev
* npm run build

---

# Future Backend

## Express.js

Express will provide the REST API powering SalonAI.

Responsibilities include:

* authentication,
* client management,
* appointment management,
* employee management,
* business logic,
* API validation.

Express was selected because of:

* simplicity,
* flexibility,
* large ecosystem,
* seamless integration with Node.js.

---

# Database

## PostgreSQL

PostgreSQL has been selected as the long-term production database.

Current development uses Local Storage only as a temporary persistence layer.

Migration to PostgreSQL is planned after frontend validation.

Reasons for selecting PostgreSQL include:

* relational data support,
* reliability,
* scalability,
* transactional consistency,
* excellent performance,
* strong community support.

The future database will manage:

* clients,
* appointments,
* employees,
* services,
* authentication,
* permissions,
* analytics.

---

# Artificial Intelligence

## OpenAI

Artificial Intelligence is one of the core long-term objectives of SalonAI.

Potential responsibilities include:

* customer communication,
* appointment assistance,
* FAQ responses,
* business recommendations,
* reporting,
* workflow automation.

AI should assist business owners rather than replace them.

---

# Automation

## n8n

n8n will be used to automate repetitive workflows.

Examples include:

* reminders,
* notifications,
* CRM synchronization,
* AI workflows,
* third-party integrations.

Automation reduces manual administrative work and increases operational efficiency.

---

# Communication

## WhatsApp Business API

WhatsApp is expected to become one of the primary communication channels.

Potential features include:

* appointment reminders,
* confirmations,
* AI conversations,
* booking requests,
* customer notifications.

This allows SalonAI to integrate naturally into existing customer workflows.

---

# Deployment Strategy

The planned production architecture includes:

Frontend:

* Vercel

Backend:

* Railway or Render

Database:

* PostgreSQL Cloud

This architecture provides:

* fast deployments,
* low maintenance,
* automatic scaling,
* continuous delivery.

Deployment infrastructure may evolve as product requirements grow.

---

# Engineering Philosophy Behind the Stack

Technology decisions are never based on popularity alone.

Every selected tool must satisfy one or more of the following objectives:

* improve developer productivity,
* simplify maintenance,
* increase scalability,
* reduce future migration costs,
* support long-term product growth.

Whenever these objectives conflict with trends or novelty, engineering stability takes priority.

---

# Future Evolution

The technology stack is expected to evolve.

However, future technologies should integrate into the existing architecture rather than replace it unnecessarily.

Engineering decisions should maximize long-term stability while allowing continuous innovation.

The objective is to build a platform capable of evolving for many years without fundamental architectural rewrites.
