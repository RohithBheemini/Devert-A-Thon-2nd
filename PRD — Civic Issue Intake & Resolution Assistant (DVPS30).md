# Product Requirements Document

## Product Name

**CivicPulse — AI Civic Issue Intake & Resolution Assistant**

### Problem Statement

**DVPS30 — Community Civic Issue Reporting**

The source problem statement calls for a community application that allows citizens to report **broken streetlights, garbage overflow, and water leakages** directly to municipal authorities, using **photo proof**.

### Hackathon MVP Constraint

**Team:** 3 people  
**Build window:** 4 hours  
**Primary objective:** Deliver a functional end-to-end prototype that converts citizen reports into actionable municipal incidents.

---

# 1. Product Vision

CivicPulse transforms fragmented citizen complaints into **verified, consolidated, prioritized, and department-routed civic incidents**.

Instead of treating every citizen report as an isolated ticket, the system attempts to determine whether multiple reports describe the **same underlying physical problem**.

The intended flow is:

```text
Citizen Report
      ↓
Issue & Evidence Analysis
      ↓
Location Capture
      ↓
Duplicate / Related-Report Detection
      ↓
Incident Fusion
      ↓
Priority Assessment
      ↓
Department Routing
      ↓
Action Plan
      ↓
Email Notification
      ↓
Municipal Dashboard
      ↓
Status / Resolution
```

The dashboard is therefore not the endpoint. It is the operational control center for incidents that have already been processed and routed.

---

# 2. Problem

Civic complaints can arrive through multiple channels and often contain incomplete or inconsistent information.

For example, four citizens may separately report:

> "There is a huge pothole near the metro."

> "Road is badly damaged beside the station."

> A Telugu voice complaint describing the same location.

> A photograph showing the road defect.

A conventional complaint system may create four separate tickets.

CivicPulse attempts to determine:

> **Are these four reports describing one real-world incident?**

If so, they are consolidated into one incident with multiple pieces of evidence.

The problem is therefore broader than simple complaint registration:

### Convert fragmented reports into actionable civic incidents.

---

# 3. Goals

## Primary goals

### G1 — Capture a civic issue

Allow a citizen to submit:

- text
- image
- optional voice
- current location

### G2 — Identify the reported issue

Recognize supported civic issue categories.

MVP categories:

```text
Pothole / road defect
Garbage overflow
Water leakage
Broken streetlight
```

The original DVPS30 explicitly names broken streetlights, garbage overflow, and water leakages; the pothole/road-defect extension is an MVP design addition to increase technical demonstration value.

### G3 — Consolidate related reports

Identify potentially duplicate reports based on:

- semantic similarity
- geographic proximity
- issue category
- time proximity

### G4 — Create actionable incidents

Aggregate all related reports and evidence into one incident record.

### G5 — Prioritize incidents

Calculate an explainable priority score based on evidence and impact.

### G6 — Route to the responsible department

Automatically map the incident to a target department.

### G7 — Trigger a real action

Send an email containing the incident and recommended action to the relevant department account.

### G8 — Provide measurable operational insights

Show:

- total reports
- unique incidents
- duplicate reports consolidated
- high-priority incidents
- department distribution
- notification status
- incident status

---

# 4. Non-Goals

The four-hour MVP will NOT attempt to:

- directly control municipal infrastructure
- automatically dispatch physical workers
- submit complaints into real government internal systems
- perform legal/administrative decision-making
- provide guaranteed emergency response
- train large foundation models
- depend on live municipal APIs
- require a live government account
- guarantee that a predicted incident is physically correct

The system produces **AI-assisted recommendations and routing**, not official municipal decisions.

---

# 5. Target Users

## Citizen

A person reporting a civic problem.

Primary needs:

- extremely simple reporting
- minimal typing
- photo evidence
- current-location attachment
- visible confirmation that the report was received

## Municipal / Department Representative

For the hackathon, represented by three department accounts/devices.

Needs:

- structured incident
- evidence
- location
- priority
- recommended action
- notification

## Administrator / Operations View

Uses the dashboard to understand:

- incident volume
- geographic concentration
- issue distribution
- unresolved high-priority incidents
- notification and status progression

---

# 6. MVP User Journey

```text
1. Citizen opens CivicPulse
          ↓
2. Selects issue / submits description
          ↓
3. Adds photo
          ↓
4. Shares current location
          ↓
5. Optional voice input
          ↓
6. System analyzes complaint
          ↓
7. System searches existing reports
          ↓
8. Related reports are fused
          ↓
9. Priority is calculated
          ↓
10. Department is selected
          ↓
11. Action plan is generated
          ↓
12. Email is sent
          ↓
13. Incident appears on dashboard
```

---

# 7. Functional Requirements

## FR-1 — Complaint Submission

The system must allow a citizen to create a report using:

- text description
- image upload
- location

Voice is an optional enhancement.

### Required output

A normalized complaint object:

```json
{
  "reportId": "REP-00421",
  "description": "...",
  "issueType": "pothole",
  "latitude": 17.4948,
  "longitude": 78.3996,
  "timestamp": "...",
  "imageEvidence": true
}
```

---

# 8. FR-2 — Image Analysis

The vision component analyzes uploaded photographs.

For the road-defect branch, the recommended MVP model is a small YOLO segmentation model fine-tuned on the Telangana-related RoadDefects-ISeg dataset.

The output should include:

```json
{
  "detections": [
    {
      "type": "pothole",
      "confidence": 0.94,
      "boundingBox": [...],
      "mask": [...]
    }
  ]
}
```

The system should retain:

- object/category
- confidence
- bounding box
- optional segmentation mask

The segmentation mask can additionally support an estimate of visible affected-area proportion.

---

# 9. FR-3 — Voice Input

Voice input is optional and must never be a critical dependency.

Architecture:

```text
Voice
  ↓
Speech-to-text
  ↓
Text complaint
  ↓
Existing text pipeline
```

The voice path must ultimately produce the same normalized complaint structure as typed input.

For Telugu, an Indic speech-recognition model may be used where available, but the system must still function if speech recognition is unavailable.

---

# 10. FR-4 — Location Acquisition

The system must capture the citizen's current latitude and longitude.

Primary method:

```text
Mobile device
    ↓
Location permission
    ↓
GPS / fused location
    ↓
latitude + longitude
```

A map is NOT required for location acquisition.

Maps are a visualization feature only.

The system must support a fallback manual location option in case:

- permission is denied
- GPS is unavailable
- browser/device location fails

Example:

```json
{
  "latitude": 17.4948,
  "longitude": 78.3996,
  "locationLabel": "Kukatpally Metro"
}
```

---

# 11. FR-5 — Duplicate / Related Report Engine

This is a central intelligence component.

The system must not determine duplicates from text alone.

It must combine:

### Signal A — Semantic similarity

Convert report descriptions into embeddings.

Example:

```text
"There is a huge pothole near the metro"

        ≈

"Large road hole beside the metro station"
```

### Signal B — Geographic proximity

Calculate distance between report coordinates.

### Signal C — Issue compatibility

Pothole should be compared primarily with pothole/road-defect reports.

### Signal D — Temporal proximity

Reports created close together are more likely to describe the same event.

---

## Proposed scoring

```text
Duplicate Score =
    55% semantic similarity
  + 25% geographic similarity
  + 10% issue compatibility
  + 10% temporal proximity
```

Example:

```text
Semantic similarity      0.92
Geo similarity           0.96
Issue match              1.00
Time similarity          0.90
```

Result:

```text
Duplicate score ≈ 0.94
```

Recommended initial decision bands:

```text
≥ 0.85      Same incident
0.65–0.84   Possible relation
< 0.65      Independent report
```

These thresholds must be calibrated against the MVP test set rather than treated as universal values.

---

# 12. FR-6 — Incident Fusion

When several reports are judged to describe the same physical problem, they become one incident.

Example:

```text
Report 101 ─┐
Report 107 ─┤
Report 113 ─┼──→ INCIDENT HYD-RD-0042
Report 118 ─┘
```

The incident stores aggregated evidence.

Example:

```json
{
  "incidentId": "HYD-RD-0042",
  "type": "pothole",
  "reports": 4,
  "latitude": 17.4948,
  "longitude": 78.3996,
  "imageEvidence": 1,
  "voiceReports": 1,
  "confidence": 0.94
}
```

The objective is:

> **Many citizen reports → one probable real-world incident**

---

# 13. FR-7 — Priority Engine

Priority must be deterministic and explainable.

Recommended MVP formula:

```text
Priority =
    35% visual severity
  + 25% report repetition
  + 20% affected-area estimate
  + 10% location importance
  + 10% incident age
```

Example:

```text
Visual severity       0.88
Repeated reports      1.00
Affected area         0.74
Location importance   0.90
Age                   0.65
```

Output:

```text
Priority = 86/100
Level = HIGH
```

The dashboard must show why.

Example:

```text
WHY HIGH PRIORITY?

+31  High visual severity
+25  Four related citizen reports
+15  Significant visible road impact
+09  Important location
+06  Incident age
```

The system must never present a black-box priority number without an explanation.

---

# 14. FR-8 — Action Planning Agent

After priority calculation, the system generates an actionable recommendation.

Example:

```json
{
  "department": "Road Maintenance",
  "priority": "HIGH",
  "actions": [
    "Inspect the reported location",
    "Assess hazard severity",
    "Apply temporary hazard marking if necessary",
    "Schedule repair"
  ]
}
```

The action plan is advisory.

It must not imply that a municipal action has actually been completed unless a department user updates the status.

---

# 15. FR-9 — Department Routing

The system maps issue type to the appropriate demonstration department.

Example:

```text
Pothole             → Road Maintenance
Road crack          → Road Maintenance
Speed breaker       → Road Maintenance

Garbage overflow    → Sanitation

Water leakage       → Water / Drainage

Broken streetlight  → Electrical / Street Lighting
```

The routing mapping must be configuration-driven so it can be changed without modifying the AI pipeline.

---

# 16. FR-10 — Real Email Notification

This is a key MVP feature.

Instead of merely placing the incident in the dashboard, the system sends an email to the corresponding department.

For the hackathon:

```text
PHONE 1
Road Maintenance email

PHONE 2
Sanitation email

PHONE 3
Water/Drainage email
```

Each phone remains logged into its respective demonstration email account.

### Example

For a pothole:

```text
Incident
 ↓
Department Router
 ↓
Road Maintenance
 ↓
road@demo...
 ↓
Email
 ↓
Phone 1 notification
```

---

# 17. Email Content

### Subject

```text
HIGH PRIORITY CIVIC INCIDENT — Pothole — Kukatpally — HYD-RD-0042
```

### Body

```text
CivicPulse — Action Required

Incident:
HYD-RD-0042

Issue:
Pothole

Location:
Kukatpally Metro

Priority:
87/100 — HIGH

Reports consolidated:
4

Evidence:
✓ Citizen reports
✓ Image evidence
✓ Location agreement

Recommended action:

1. Inspect reported location
2. Assess hazard severity
3. Apply temporary warning/marking if required
4. Schedule repair

System assessment:
Pothole confidence — 94%

This notification is an AI-assisted recommendation.
Final action remains with the responsible authority.
```

---

# 18. FR-11 — Dashboard

The dashboard is the operational control center.

## Summary cards

```text
Active incidents
High priority
Reports received
Reports consolidated
Emails dispatched
Acknowledged
In progress
Resolved
```

## Incident table

Each incident should show:

```text
Incident ID
Issue
Location
Priority
Reports
Confidence
Department
Email status
Current status
```

## Incident detail

Clicking an incident should reveal:

```text
Evidence
Citizen reports
Image
Location
Priority breakdown
Duplicate reasoning
Action plan
Department
Email timestamp
Status history
```

---

# 19. Status Lifecycle

The MVP should support:

```text
OPEN
  ↓
ROUTED
  ↓
EMAIL SENT
  ↓
ACKNOWLEDGED
  ↓
IN PROGRESS
  ↓
RESOLVED
```

The first four can be automatically generated.

The final states can initially be updated manually from the dashboard.

---

# 20. Recommended Data Model

## Report

```ts
interface Report {
  id: string;
  description: string;
  issueType?: IssueType;
  latitude: number;
  longitude: number;
  timestamp: string;
  imageUrl?: string;
  voiceTranscript?: string;
  visionConfidence?: number;
}
```

## Incident

```ts
interface Incident {
  id: string;
  issueType: IssueType;
  latitude: number;
  longitude: number;
  reports: string[];
  duplicateScore?: number;
  priorityScore: number;
  priorityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  department: string;
  actionPlan: string[];
  notificationStatus: string;
  status: IncidentStatus;
}
```

---

# 21. Technical Architecture

```text
                         CITIZEN APP
                              │
              ┌───────────────┼───────────────┐
              │               │               │
             TEXT           IMAGE           VOICE
              │               │               │
              │               ▼               │
              │         Vision Model         │
              │               │               │
              │               └──────┐        │
              │                      │        ▼
              │                      │     Speech
              │                      │     → Text
              └──────────────┬───────┴────────┘
                             ▼
                    CASE NORMALIZER
                             │
                             ▼
                    STRUCTURED REPORT
                             │
                  ┌──────────┼──────────┐
                  ▼          ▼          ▼
                ISSUE      LOCATION    TIME
                  │          │          │
                  └──────────┼──────────┘
                             ▼
                    DUPLICATE ENGINE
                   ┌─────────┼─────────┐
                   ▼         ▼         ▼
                Semantic    Geo       Time
                Similarity  Distance  Window
                   └─────────┼─────────┘
                             ▼
                     INCIDENT FUSION
                             │
                             ▼
                     PRIORITY ENGINE
                             │
                             ▼
                    ACTION PLANNER
                             │
                             ▼
                  DEPARTMENT ROUTER
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
          ROAD EMAIL     SANITATION       WATER
              │              │              │
              ▼              ▼              ▼
           PHONE 1        PHONE 2        PHONE 3
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                         DASHBOARD
```

---

# 22. AI Components

The MVP should use AI selectively.

## Vision Model

Purpose:

- detect supported civic/road issues
- provide confidence
- optionally provide segmentation

## Embedding Model

Purpose:

- semantic complaint similarity
- duplicate detection
- incident clustering

## Speech Model

Purpose:

- convert Telugu/English voice to text

## LLM / Agent Layer

Purpose:

- normalize citizen descriptions
- generate action-plan wording
- explain incidents
- assist with multilingual interaction

The LLM must not directly determine the final priority or duplicate status without the supporting deterministic signals.

---

# 23. Agent Responsibilities

## Intake Agent

Transforms multimodal citizen input into a normalized report.

## Evidence Agent

Combines text/image/voice evidence.

## Duplicate Agent

Uses semantic, geographic, issue and temporal signals to determine relatedness.

## Priority Agent

Transforms evidence and incident characteristics into an explainable priority recommendation.

## Action Planning Agent

Generates an operationally useful recommended response.

## Routing Agent

Maps the incident to the configured department.

A lightweight supervisor/orchestrator coordinates these stages.

---

# 24. Location & Map Requirements

### Core requirement

GPS coordinates must be stored.

### Map requirement

The map is **optional for the core functionality** but strongly recommended for the dashboard.

Use the map to visualize:

```text
🔴 Critical
🟠 High
🟡 Medium
🟢 Low
```

The map must never be a dependency for:

- duplicate detection
- priority calculation
- department routing
- email dispatch

---

# 25. Privacy Requirements

The system should collect only what is necessary for the MVP.

Do not collect:

- Aadhaar
- government ID
- personal identity documents
- unnecessary names
- unnecessary contact information

A report should use an anonymous incident/report ID.

The system should clearly state that location is being captured as part of the civic report.

---

# 26. Reliability Requirements

The application must continue functioning if an optional component fails.

### If voice fails

Text/image submission remains available.

### If image analysis fails

Text + location can still create a report.

### If map fails

Incident processing and email routing continue.

### If AI API fails

Use deterministic/rule-based fallbacks where possible.

### If email fails

Incident remains visible in the dashboard with:

```text
EMAIL FAILED — RETRY
```

The system must not silently report successful dispatch when delivery failed.

---

# 27. Measurable Success Metrics

The MVP should be evaluated using real test cases.

## Metric 1 — Issue detection

For a labeled test set:

```text
Precision
Recall
F1
mAP
```

## Metric 2 — Duplicate detection

Create known duplicate/non-duplicate pairs.

Measure:

```text
Precision
Recall
F1
```

## Metric 3 — Incident consolidation

```text
Raw reports
        ↓
Unique incident clusters
```

Report:

```text
Redundancy reduction =
1 - unique incidents / total reports
```

Example:

```text
100 reports
64 incidents

36% report redundancy consolidated
```

## Metric 4 — Routing accuracy

```text
Correct department assignments
/
Total test incidents
```

## Metric 5 — Notification success

```text
Emails successfully dispatched
/
Emails intended
```

## Metric 6 — Processing latency

Measure:

```text
Report submitted
        ↓
Incident created
        ↓
Email dispatched
```

Report the observed median time.

---

# 28. Primary Product KPI

The central KPI should be:

## **Actionable Incident Conversion Rate**

Percentage of raw reports that become valid, routed incidents with:

- issue identified
- location attached
- priority calculated
- responsible department selected
- action plan generated

Example:

```text
100 reports
↓
82 valid incidents/actions
↓
82%
Actionable Incident Conversion
```

This measures the whole product, rather than just one ML model.

---

# 29. Four-Hour Implementation Plan

## Hour 0–1 — Core

### Person 1

Vision/input pipeline.

### Person 2

Report schema + duplicate engine.

### Person 3

Dashboard + database/storage.

Target:

```text
Report
 ↓
Structured JSON
 ↓
Dashboard
```

---

## Hour 1–2 — Intelligence

Add:

- image classification/detection
- semantic similarity
- geographic distance
- incident clustering
- priority score

Target:

```text
4 reports
 ↓
1 incident
 ↓
priority 87
```

---

## Hour 2–3 — Action

Add:

- department routing
- action planner
- email notification
- status tracking

Target:

```text
Incident
 ↓
Road Maintenance
 ↓
real email
 ↓
phone notification
```

---

## Hour 3–4 — Demo & reliability

Add:

- map
- evidence visualization
- priority explanation
- polished incident detail
- failure states
- demo dataset
- rehearsal

At **3:15**, new architecture/features should stop.

Final 45 minutes are for stabilization.

---

# 30. Three-Person Ownership

## Person 1 — AI / Vision

Owns:

- image pipeline
- issue classification
- optional segmentation
- voice integration
- AI confidence

Deliverable:

```text
Raw input
→ evidence
```

## Person 2 — Intelligence / Backend

Owns:

- normalized report schema
- embeddings
- duplicate engine
- incident fusion
- priority engine
- routing
- action planning

Deliverable:

```text
Reports
→ Incident
→ Priority
→ Department
```

## Person 3 — Full Stack / UX

Owns:

- citizen interface
- dashboard
- map
- incident details
- email integration
- status controls

Deliverable:

```text
Incident
→ Visible
→ Actionable
→ Trackable
```

---

# 31. Primary Demo Scenario

### Input 1

Citizen submits:

> "There is a huge pothole near Kukatpally Metro."

with a road photograph and location.

### Input 2

Second citizen reports:

> "Large road hole beside the metro station."

### Input 3

Third citizen submits a Telugu voice complaint describing the same issue.

### Input 4

Fourth citizen submits another photograph.

System produces:

```text
4 reports
       ↓
1 incident

HYD-RD-0042
Pothole
Kukatpally Metro
Priority: 87 — HIGH
```

Then:

```text
Duplicate reports consolidated
        ↓
Action plan generated
        ↓
Department = Road Maintenance
        ↓
Email dispatched
        ↓
Phone 1 receives notification
```

Then open the dashboard:

```text
✓ Detected
✓ Consolidated
✓ Prioritized
✓ Routed
✓ Email Sent
```

This demonstrates the complete product in one scenario.

---

# 32. Secondary Demo Scenario

Submit a garbage photograph.

The system creates:

```text
GARBAGE OVERFLOW
        ↓
SANITATION
        ↓
Email → Phone 2
```

Then water leakage:

```text
WATER LEAKAGE
        ↓
WATER / DRAINAGE
        ↓
Email → Phone 3
```

This visibly proves that department routing is actually functioning.

---

# 33. Acceptance Criteria

The MVP is complete when:

- A citizen can submit a report.
- Image evidence can be processed.
- Location can be attached.
- A report receives an issue classification.
- Related reports can be identified.
- Multiple reports can form a single incident.
- Incident priority is calculated.
- Priority has an explanation.
- A department is selected.
- An action plan is generated.
- A real email is sent to the configured department account.
- The email is visible on the corresponding demonstration phone.
- The incident appears in the dashboard.
- Incident status can be changed.
- Failure of optional voice/map functionality does not break the core flow.
- Test metrics can be displayed for the core AI components.

---

# 34. Final Product Principle

CivicPulse should not be presented as:

> "An AI app for submitting civic complaints."

It should be presented as:

> **"An AI system that turns fragmented citizen complaints into verified, consolidated, prioritized, and department-routed civic incidents."**

### The product loop

```text
REPORT
  ↓
UNDERSTAND
  ↓
VERIFY
  ↓
FUSE
  ↓
PRIORITIZE
  ↓
ROUTE
  ↓
ACT
  ↓
TRACK
```

The defining feature is therefore not the complaint form or dashboard.

It is:

> **Many reports → one probable incident → one prioritized action.**

That is the core value proposition of the MVP.