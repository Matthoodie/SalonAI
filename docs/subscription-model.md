# SalonAI Subscription Model

## Overview

SalonAI is designed as a SaaS platform with multiple subscription tiers.

The goal is to provide a simple entry-level solution for small salons and allow gradual upgrades as the business grows.

The application will use a feature-based access model where users receive different capabilities depending on their subscription plan.

---

# Subscription Plans

## Basic Plan

Target users:
Small salons that need organization and basic business overview.

Estimated price:
19 €/month

Features:

- Client database
- Appointment management
- Employee overview
- Basic dashboard
- Daily revenue overview
- Basic statistics
- Appointment history

---

# Professional Plan

Target users:
Growing salons that want automation and business insights.

Estimated price:
49 €/month

Includes everything from Basic plus:

- AI business assistant
- Client behavior analysis
- Automated client reminders
- Revenue suggestions
- Business improvement recommendations
- AI generated customer messages

---

# Premium AI Plan

Target users:
Salons that want AI-powered marketing and automation.

Estimated price:
99 €/month

Includes everything from Professional plus:

- AI marketing assistant
- Social media post generation
- Advertisement copy generation
- Campaign ideas
- Newsletter creation
- Advanced business analytics
- AI growth recommendations

---

# Technical Implementation

The application will not be built as separate products.

Instead, SalonAI will use one application with different feature permissions.

Example:

User account:

subscription: "basic"

Available:

- Dashboard
- Clients
- Appointments

Locked:

- AI Marketing
- Advanced Analytics

---

User account:

subscription: "premium"

Available:

- All Basic features
- All Professional features
- AI Marketing
- Advanced AI tools

---

# Future Expansion

The SalonAI Core architecture can later be adapted for other industries:

- AutoAI
- DentalAI
- RestaurantAI
- FitnessAI

Each product would share:

- authentication system
- AI assistant architecture
- subscription model
- database principles

while having industry-specific modules.

---

# MVP Strategy

Initial MVP focuses on proving value.

First version:

- Dashboard
- Clients
- Appointments
- Employees
- Basic AI assistant foundation

Advanced AI features will be added after validating user demand.