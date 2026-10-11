# DVPS30 — PRD Addendum & Completeness Check

## Purpose

This addendum is intended to be attached to the existing **CivicPulse — AI Civic Issue Intake & Resolution Assistant** PRD.

It closes implementation and product gaps that should be resolved before the 4-hour hackathon build is frozen. It does not replace the previous PRD; it extends it.

The original DVPS30 statement requires a community application for reporting **broken streetlights, garbage overflow, and water leakages** to municipal authorities with photo proof. This addendum preserves those required categories while strengthening the end-to-end workflow. 

---

# 1. Completeness Check

The previous PRD already covered the major product flow:

```text
Citizen Report
    ↓
Issue Analysis
    ↓
Location
    ↓
Duplicate Detection
    ↓
Incident Fusion
    ↓
Priority
    ↓
Department Routing
    ↓
Action Plan
    ↓
Email Notification
    ↓
Dashboard
    ↓
Status / Resolution
```

The following areas needed additional precision:

1. Exact separation between a **raw report** and a **fused incident**.
2. A formal confidence/evidence model.
3. Explicit handling of uncertain classifications.
4. A clear rule for when reports are merged versus merely linked.
5. A defined action/notification state machine.
6. Email idempotency and retry behavior.
7. A clear location fallback mechanism.
8. A defined minimum test dataset and ground truth.
9. Operational metrics beyond model accuracy.
10. Human-review behavior for ambiguous cases.
11. Evidence retention and auditability.
12. Clear MVP cut-lines for the 4-hour build.
13. Demo-safe failure behavior.
14. Explicit distinction between recommendations and confirmed municipal actions.

---

# 2. Product Boundary

## 2.1 Supported issue categories

The MVP should support exactly these four categories:

```text
POTHOLE / ROAD DEFECT
GARBAGE OVERFLOW
WATER LEAKAGE
BROKEN STREETLIGHT
```

`Pothole / Road Defect` is an implementation extension added to make the vision pipeline and Telangana road-defect dataset useful; the original DVPS30 wording explicitly names broken streetlights, garbage overflow, and water leakages.

The architecture may support more categories later, but the MVP classifier should not attempt a large open-ended taxonomy.

## 2.2 Report vs Incident

These are different objects.

### Report

A single citizen submission.

```text
Report ID
Citizen input
Image / voice / text
Latitude / longitude
Timestamp
Detected issue
Evidence confidence
```

### Incident

A probable real-world civic event formed from one or more reports.

```text
Incident ID
Issue
Representative location
Related reports
Aggregated evidence
Priority
Department
Action plan
Notification status
Current status
```

This distinction is mandatory because the central product value is:

> **Many citizen reports → one probable real-world incident.**

---

# 3. Revised End-to-End Architecture

```text
                         CITIZEN
                            |
               +------------+------------+
               |            |            |
             IMAGE         TEXT         VOICE
               |            |            |
               v            |            v
          Vision Model      |       Speech-to-Text
               |            |            |
               +------------+------------+
                            |
                            v
                    REPORT NORMALIZER
                            |
                  +---------+---------+
                  |         |         |
                  v         v         v
                ISSUE     LOCATION   TIMESTAMP
              EVIDENCE
                  |         |         |
                  +---------+---------+
                            |
                            v
                   DUPLICATE ENGINE
                  /       |       \
              TEXT       GEO      TIME
              SIM       DIST     WINDOW
                  \       |       /
                   \      |      /
                    v     v     v
                    RELATEDNESS
                         |
            +------------+------------+
            |                         |
       HIGH RELATEDNESS          LOW RELATEDNESS
            |                         |
            v                         v
     MERGE INTO INCIDENT       CREATE NEW INCIDENT
            |                         |
            +------------+------------+
                         |
                         v
                EVIDENCE AGGREGATOR
                         |
                         v
                  PRIORITY ENGINE
                         |
                         v
                ACTION PLANNER
                         |
                         v
                DEPARTMENT ROUTER
                         |
                +--------+--------+
                |        |        |
                v        v        v
              ROAD   SANITATION  WATER/
             MAINT.             DRAINAGE
                |        |        |
                +--------+--------+
                         |
                         v
                  EMAIL NOTIFIER
                         |
                         v
                    DASHBOARD
                         |
                    STATUS UPDATE
```

---

# 4. Evidence Model

Every report should retain evidence separately.

## Evidence types

```text
TEXT
IMAGE
VOICE_TRANSCRIPT
LOCATION
TIMESTAMP
```

## Example

```json
{
  "reportId": "REP-00421",
  "evidence": {
    "text": {
      "present": true,
      "confidence": 0.91
    },
    "image": {
      "present": true,
      "issue": "pothole",
      "confidence": 0.94
    },
    "voice": {
      "present": false
    },
    "location": {
      "latitude": 17.4948,
      "longitude": 78.3996,
      "accuracyMeters": 12
    }
  }
}
```

The incident should aggregate these signals without overwriting the underlying reports.

---

# 5. Classification Confidence Rules

The application must distinguish between:

### High confidence

The system can automatically classify the issue.

### Medium confidence

The system may classify it but should visibly mark it as uncertain.

### Low confidence

The system should avoid pretending certainty.

Recommended behavior:

```text
confidence >= 0.80
    → automatic classification

0.60–0.79
    → classification + "needs review"

< 0.60
    → "issue unclear" / request additional evidence
```

These thresholds are initial engineering thresholds and must be calibrated on the validation set.

The UI must never present an uncertain prediction as a confirmed fact.

---

# 6. Improved Duplicate Engine

The previous PRD defines a duplicate score. The following merge policy should be added.

## Step 1 — Candidate filtering

Only compare a new report with reports satisfying:

```text
same / compatible issue class
AND
time difference <= 48 hours
AND
distance <= 500 metres
```

This avoids comparing every report against every other report.

## Step 2 — Semantic similarity

Generate a multilingual embedding from:

```text
normalized complaint text
```

Calculate cosine similarity.

## Step 3 — Geographic similarity

Calculate distance between coordinates using the Haversine formula.

## Step 4 — Temporal similarity

Recent reports receive a higher similarity score.

## Step 5 — Final relatedness score

```text
relatedness =
    0.55 * semantic_similarity
  + 0.25 * geographic_score
  + 0.10 * issue_match
  + 0.10 * temporal_score
```

## Merge policy

```text
>= 0.85
    MERGE

0.65–0.849
    KEEP SEPARATE + MARK AS RELATED

< 0.65
    CREATE NEW INCIDENT
```

The middle state is important.

Do not force every uncertain pair into either "duplicate" or "not duplicate."

---

# 7. Incident Fusion Rules

When reports are merged:

### Representative location

Use the weighted centroid of the reports, or the report with the best location accuracy if available.

### Issue

Use the highest-confidence compatible classification.

### Evidence count

Aggregate:

```text
number of reports
number of images
number of voice reports
number of independent locations
```

### Incident confidence

Incident confidence should increase when multiple independent reports provide compatible evidence, but it must remain bounded and explainable.

Example:

```text
Incident confidence: HIGH

Evidence:
✓ 4 reports
✓ 2 images
✓ same 180 m area
✓ same issue class
✓ within 9 hours
```

Do not simply average model confidences.

---

# 8. Priority Engine — Revised

Priority must be an explainable score rather than an LLM-generated label.

Recommended MVP formula:

```text
priority =
    35% severity
  + 25% report repetition
  + 20% visible affected area / evidence severity
  + 10% location importance
  + 10% age
```

However, the system should also expose the individual components:

```json
{
  "score": 87,
  "level": "HIGH",
  "breakdown": {
    "severity": 31,
    "reportRepetition": 24,
    "affectedArea": 15,
    "locationImportance": 9,
    "age": 8
  }
}
```

The dashboard must show the breakdown.

---

# 9. Action Plan Generation

The Action Planning Agent should not create arbitrary actions.

It should receive:

```text
issue
priority
evidence
location
department
```

and select/generate actions from a constrained action library.

## Example action library

### Pothole

```text
Inspect location
Assess hazard severity
Apply temporary warning/marking if necessary
Schedule road repair
```

### Garbage overflow

```text
Verify accumulation
Dispatch sanitation vehicle
Inspect collection route
Record clearance
```

### Water leakage

```text
Inspect leakage source
Assess public-road impact
Check drainage/water infrastructure
Schedule repair/isolation if required
```

### Broken streetlight

```text
Inspect pole/light
Verify electrical fault
Schedule maintenance/replacement
```

This makes the action plan predictable and prevents the LLM from inventing operational procedures.

---

# 10. Department Routing

Routing must be deterministic/configuration-driven.

Example configuration:

```json
{
  "pothole": "ROAD_MAINTENANCE",
  "road_crack": "ROAD_MAINTENANCE",
  "speed_breaker": "ROAD_MAINTENANCE",
  "garbage_overflow": "SANITATION",
  "water_leakage": "WATER_DRAINAGE",
  "broken_streetlight": "STREET_LIGHTING"
}
```

The AI may suggest a category, but the routing table determines the destination.

---

# 11. Real Email Action

Email dispatch is part of the MVP, not merely a simulated dashboard event.

## Department accounts

For the hackathon:

```text
ROAD_MAINTENANCE
SANITATION
WATER_DRAINAGE
```

Each may be represented by a dedicated email account logged into one demonstration phone.

## Workflow

```text
Incident created
    ↓
Department determined
    ↓
Action plan created
    ↓
Email generated
    ↓
Email sent
    ↓
Notification timestamp stored
    ↓
Dashboard status → EMAIL_SENT
```

## Email idempotency

The system must prevent duplicate emails for the same incident.

Store:

```text
incidentId
notificationType
recipient
sentAt
messageId
status
```

Before sending:

```text
If SENT already exists
    → do not resend automatically
```

A manual "Retry notification" button may be provided.

---

# 12. Notification State Machine

Use explicit states:

```text
OPEN
  ↓
PRIORITIZED
  ↓
ROUTED
  ↓
EMAIL_PENDING
  ↓
EMAIL_SENT
  ↓
ACKNOWLEDGED
  ↓
IN_PROGRESS
  ↓
RESOLVED
```

Failure path:

```text
EMAIL_PENDING
      ↓
EMAIL_FAILED
      ↓
RETRY
      ↓
EMAIL_SENT
```

The dashboard must distinguish:

```text
Email sent
```

from:

```text
Department acknowledged
```

The system must never imply acknowledgement simply because an email was sent.

---

# 13. Human Review

A useful fallback should exist for uncertain cases.

Example:

```text
Vision confidence: 0.66
Duplicate score: 0.73
```

Dashboard:

```text
⚠ REVIEW RECOMMENDED

Possible issue:
Pothole

Possible related incident:
HYD-RD-0042

[Merge] [Create New Incident]
```

For a four-hour MVP, these can be manual dashboard controls rather than a sophisticated human-in-the-loop service.

This gives the project a credible answer when judges ask:

> "What happens when the AI is unsure?"

---

# 14. Location Architecture

Location acquisition must be independent from map visualization.

## Primary

```text
Mobile device
    ↓
GPS / fused location
    ↓
latitude + longitude + accuracy
```

## Fallback

```text
Manual location selection / label
```

## Important

A map is NOT required for:

- issue detection
- duplicate detection
- priority
- routing
- email

The map is only a dashboard visualization.

---

# 15. Map Requirements

For the dashboard, show incidents as markers:

```text
Critical → red
High     → orange
Medium   → yellow
Low      → green
```

Every marker should open:

```text
Incident ID
Issue
Priority
Report count
Department
Status
```

The map must not become a blocker for the core workflow.

If map rendering fails, the incident table must still function.

---

# 16. Data Storage

For the four-hour prototype, use a simple local database or lightweight persistent store.

Minimum entities:

### reports

```text
id
description
issueType
latitude
longitude
accuracy
timestamp
imagePath / reference
voiceTranscript
visionConfidence
```

### incidents

```text
id
issueType
latitude
longitude
priorityScore
priorityLevel
department
status
createdAt
updatedAt
```

### incident_reports

```text
incidentId
reportId
relatednessScore
relationshipType
```

### notifications

```text
id
incidentId
recipient
status
sentAt
messageId
error
```

This normalized structure prevents duplicated information and makes the status workflow auditable.

---

# 17. Image Evidence Handling

The incident detail page should allow the judge to see:

```text
Original citizen image
↓
Detected issue
↓
Bounding box / segmentation
↓
Confidence
```

Do not replace the original image with only the model output.

The original evidence must remain available.

---

# 18. Demo Dataset

The four-hour team should prepare a small deterministic demonstration set.

Recommended:

```text
12–20 reports
```

Distributed across:

```text
4–6 pothole reports
3–5 garbage reports
3–5 water reports
2–4 streetlight reports
```

Include at least:

```text
3 duplicate/related groups
2 independent reports with similar wording
1 ambiguous report
1 high-priority incident
1 low-priority incident
```

This guarantees that the demo exercises the actual system rather than only its happy path.

---

# 19. Ground-Truth Evaluation Set

Prepare a separate labeled test set.

Minimum:

```text
30 classification samples
50 duplicate/non-duplicate pairs
20 routing cases
20 priority cases
```

For every case, manually define expected output.

This is sufficient for a credible MVP evaluation without creating a huge dataset.

---

# 20. Evaluation Metrics

## Classification

Report:

```text
Precision
Recall
F1
```

Prefer macro-F1 because the four classes may have different sample counts.

## Duplicate Detection

Report:

```text
Precision
Recall
F1
```

This should be evaluated at the pair level.

## Incident Fusion

Report:

```text
Correctly formed incident clusters
/
Expected incident clusters
```

A cluster-level metric can be added later; for the MVP, report the percentage of test reports assigned to the correct incident.

## Routing

```text
Correct department assignments
/
Total routing cases
```

## Email

```text
Successful sends
/
Intended sends
```

## Latency

Measure:

```text
Report submission
→ incident creation
→ email dispatch
```

Report median and p95 where possible.

## Operational metric

Most important product metric:

```text
Reports
    ↓
Unique incidents
```

Example:

```text
100 reports
64 unique incidents

36% duplicate-report consolidation
```

---

# 21. New Product KPI

Add:

## Actionable Incident Conversion Rate

An incident is "actionable" only when all of the following exist:

```text
issue identified
+
location available
+
priority calculated
+
department assigned
+
action plan generated
```

Then:

```text
actionable incidents
/
total submitted reports
```

This measures the entire product instead of one isolated model.

---

# 22. Explainability Requirements

Every final incident must answer four questions:

### What happened?

```text
Pothole detected.
```

### Why do we believe it?

```text
4 reports + image evidence + location agreement.
```

### Why is it this priority?

```text
Priority = 87/100
```

with the breakdown.

### What happens next?

```text
Road Maintenance
→ Field inspection
→ Repair scheduling
```

This is the minimum explanation layer.

---

# 23. Audit Trail

Every incident should retain:

```text
createdAt
source reports
model outputs
duplicate score
priority breakdown
department
action plan
email status
status changes
```

This allows the team to demonstrate:

> "We can trace how the system moved from citizen input to action."

For a hackathon prototype, a simple incident JSON or database record is sufficient.

---

# 24. Failure Handling

The system must never silently fail.

## Image model failure

```text
IMAGE ANALYSIS UNAVAILABLE
```

Continue with text/location.

## Speech failure

Hide/disable voice and continue with text.

## Location failure

Allow manual location.

## Duplicate engine failure

Create a new incident instead of blocking submission.

## Email failure

Keep incident visible and show:

```text
EMAIL_FAILED — RETRY
```

## Map failure

Fall back to incident table.

## AI API failure

Use deterministic classification/routing or demo data where applicable.

---

# 25. Four-Hour Scope Lock

## P0 — Must ship

```text
Citizen report
Text + image
Location
Issue classification
Duplicate engine
Incident fusion
Priority
Department routing
Action plan
Real email
Dashboard
Incident detail
Status lifecycle
Basic evaluation metrics
```

## P1 — Only after P0 works

```text
Voice input
Telugu support
Map
Advanced visual overlays
Human-review controls
```

## P2 — Do not build during the 4-hour MVP

```text
WhatsApp
Real municipal API integration
Automatic worker dispatch
Live government authentication
Large-scale geospatial analytics
Full OCR pipeline
Complex notification channels
```

At approximately **3:15**, stop adding features and stabilize the system.

---

# 26. Revised Four-Hour Timeline

## 00:00–00:20

Freeze:

- schemas
- issue taxonomy
- routing table
- priority formula
- demo reports

## 00:20–01:00

Build:

- report creation
- database
- basic dashboard

## 01:00–02:00

Build:

- image classification
- normalization
- duplicate engine
- incident fusion

Checkpoint:

```text
Reports → Incident
```

## 02:00–02:45

Build:

- priority
- routing
- action plans

Checkpoint:

```text
Incident → Department + Action
```

## 02:45–03:15

Build:

- email dispatch
- notification status
- dashboard integration

Checkpoint:

```text
Incident → Email → Phone
```

## 03:15–03:45

Only now add:

- map
- voice
- Telugu
- visual overlays

Cut these immediately if P0 is unstable.

## 03:45–04:00

Freeze code.

Run:

```text
classification tests
duplicate tests
routing tests
email test
full demo
```

---

# 27. Three-Person Ownership — Final

## Person 1 — AI / Evidence

Own:

```text
Vision model
Voice
Text normalization
Evidence confidence
```

Primary output:

```text
Raw report
→ structured evidence
```

## Person 2 — Intelligence / Backend

Own:

```text
Duplicate engine
Incident fusion
Priority
Routing
Action planning
Data model
```

Primary output:

```text
Reports
→ actionable incident
```

## Person 3 — Product / Full Stack

Own:

```text
Citizen UI
Dashboard
Map
Email service
Status controls
Demo experience
```

Primary output:

```text
Incident
→ visible + routed + trackable
```

---

# 28. Final Demo Script

## Scene 1 — Citizen

Submit a pothole image + text + location.

System:

```text
POTHOLE DETECTED
Confidence: 94%
```

## Scene 2 — Second reports

Submit three semantically different reports describing the same area.

System:

```text
3 related reports detected
```

## Scene 3 — Incident fusion

Dashboard becomes:

```text
INCIDENT HYD-RD-0042

4 reports
1 probable incident
```

## Scene 4 — Priority

Show:

```text
87 / 100 — HIGH
```

Then open:

```text
Why?
```

and show the breakdown.

## Scene 5 — Action

System generates:

```text
Department:
Road Maintenance

Action:
Inspect
Assess
Temporarily mark if necessary
Schedule repair
```

## Scene 6 — Real-world effect

Click:

```text
SEND TO DEPARTMENT
```

The Road Maintenance account receives the email on Phone 1.

## Scene 7 — Dashboard

Show:

```text
✓ Incident created
✓ Consolidated
✓ Prioritized
✓ Routed
✓ Email sent
```

Then demonstrate:

```text
Garbage → Phone 2
Water → Phone 3
```

This proves that the system is not merely classifying images; it completes the report-to-action loop.

---

# 29. Final Product Definition

The final MVP should be described as:

> **CivicPulse is an AI-assisted civic incident fusion system that converts multimodal citizen reports into prioritized, department-routed incidents and automatically sends actionable notifications to the responsible department.**

The core differentiator is:

```text
Many reports
     ↓
One probable incident
     ↓
Evidence
     ↓
Priority
     ↓
Action
     ↓
Department notification
```

The system does not claim that a municipal authority has completed an action unless a department user actually marks the incident as resolved.

---

# 30. Definition of Done

The MVP is complete when a clean test can demonstrate:

```text
1. Citizen submits report
2. Image/text is analyzed
3. Location is attached
4. Issue is identified
5. Related reports are detected
6. Reports are fused correctly
7. Priority is calculated
8. Priority reasoning is visible
9. Department is selected
10. Action plan is generated
11. Real email is sent
12. Correct demonstration phone receives it
13. Incident appears on dashboard
14. Status can be updated
15. Evaluation metrics can be shown
```

---

# 31. Final Engineering Principle

The system should follow:

> **AI interprets evidence. Deterministic logic makes operational decisions. Human authorities retain final control.**

This keeps the architecture:

- fast enough for the hackathon
- explainable
- testable
- resilient to model/API failure
- demonstrable end-to-end
- extensible after the hackathon
