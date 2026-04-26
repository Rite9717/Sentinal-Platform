# Sentinal Project Presentation Plan

## Audience
- Faculty, reviewers, demo-day evaluators, and technical stakeholders who need a clear product + architecture overview.

## Objective
- Explain what Sentinal is, why it matters, how it works end to end, and why the current implementation is differentiated.

## Narrative Arc
1. Start with the operational pain: EC2 incidents are noisy, manual, and slow to diagnose.
2. Show Sentinal as a unified control center for monitoring, self-healing, and AI-assisted incident analysis.
3. Walk through onboarding, backend architecture, lifecycle monitoring, and AI snapshot analysis.
4. End with business value, technical strengths, and the roadmap.

## Slide List
1. Title slide: Sentinal overview and positioning.
2. Problem slide: what operators struggle with today.
3. Product slide: what Sentinal delivers.
4. Onboarding slide: account ID, instance ID, region, IAM role/stack, monitoring stack guidance.
5. Recovery flow slide: deterministic state machine from UP to recovery or termination.
6. Architecture slide: React frontend, Spring Boot registry, AWS STS, Prometheus/Grafana, Python AI service.
7. Incident intelligence slide: one lifecycle snapshot per incident and AI analysis flow.
8. Frontend experience slide: instances dashboard, chat workspace, snapshot selection, Grafana metrics.
9. Security + value slide: cross-account IAM, user isolation, explainable diagnostics, reduced MTTR.
10. Roadmap slide: scaling, deeper analytics, automation, enterprise readiness.

## Source Plan
- Primary source: repository `README.md`
- Supporting source: `frontend/src/pages/DashboardPage.jsx`
- Supporting source: `frontend/src/components/ec2/InstanceRegistrationWizard.jsx`
- Supporting source: `frontend/src/services/ec2Service.js`
- Supporting source: `Sentinal AI/sentinel_ai_agent.py`

## Visual System
- Bright, modern, professional slides with white canvas, green primary accent, soft sand secondary accent, and mono micro-labels.
- Typography: serif headlines, sans body, mono technical labels.
- Rounded cards, clean flow panels, dashboard-style information density.

## Asset Plan
- No external images required.
- Visual hierarchy will be created through editable layout geometry, metric cards, flow cards, and architecture blocks.

## Editability Plan
- All visible text will be editable PowerPoint text objects.
- All cards and structure will be editable native PowerPoint shapes.
- Speaker notes will include source references for each slide.
