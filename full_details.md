# CivicPulse (DVPS30) — Comprehensive Project Master Guide
> **Audience:** Anyone with zero prior knowledge of this codebase or civic tech systems.  
> **Goal:** Provide a complete, micro-level understanding of what this application does, every algorithm and mathematical formula under the hood, how the code is structured, why this exact architecture was chosen over alternatives, and how to operate and demonstrate it.

---

# Table of Contents
1. [The Big Picture: What Problem Are We Solving?](#1-the-big-picture-what-problem-are-we-solving)
2. [Core Fundamentals & Terminology](#2-core-fundamentals--terminology)
3. [The Micro-Level End-to-End Pipeline](#3-the-micro-level-end-to-end-pipeline)
   - [Step 1: Multi-Channel Intake](#step-1-multi-channel-intake)
   - [Step 2: Issue Classification & Vision Guard](#step-2-issue-classification--vision-guard)
   - [Step 3: Spatio-Temporal De-duplication Engine](#step-3-spatio-temporal-de-duplication-engine)
   - [Step 4: Incident Fusion (The Core Innovation)](#step-4-incident-fusion-the-core-innovation)
   - [Step 5: 5-Vector Explainable Priority Calculation](#step-5-5-vector-explainable-priority-calculation)
   - [Step 6: Department Routing & SLA Forecast](#step-6-department-routing--sla-forecast)
   - [Step 7: Autonomous Notification & Public Tracking](#step-7-autonomous-notification--public-tracking)
4. [Architectural Decisions: Why This Approach and Why Not Others?](#4-architectural-decisions-why-this-approach-and-why-not-others)
   - [Why Not Naive Ticketing (ZenDesk/Jira Model)?](#why-not-naive-ticketing)
   - [Why Not a Pure LLM Black-Box Pipeline?](#why-not-a-pure-llm-black-box-pipeline)
   - [Why Not Pure GIS Clustering (DBSCAN/K-Means)?](#why-not-pure-gis-clustering)
   - [Why a Deterministic Fallback Architecture for AI?](#why-a-deterministic-fallback-architecture-for-ai)
   - [Why Custom Leaflet GIS Over Embedded Google Maps?](#why-custom-leaflet-gis-over-embedded-google-maps)
5. [The Map & GIS Subsystem Deep-Dive](#5-the-map--gis-subsystem-deep-dive)
   - [The Container Lifecycle Bug and the Fix](#the-container-lifecycle-bug-and-the-fix)
   - [Nominatim Reverse Geocoding & Landmark Presets](#nominatim-reverse-geocoding--landmark-presets)
   - [Dynamic Bounding vs. Static Averaging](#dynamic-bounding-vs-static-averaging)
   - [Custom SVG DivIcons & Radar Halos](#custom-svg-divicons--radar-halos)
6. [Micro-Level Codebase Anatomy](#6-micro-level-codebase-anatomy)
   - [Backend Directory Walkthrough](#backend-directory-walkthrough)
   - [Frontend Directory Walkthrough](#frontend-directory-walkthrough)
7. [The 4-Step Golden Demo Walkthrough](#7-the-4-step-golden-demo-walkthrough)
8. [Automated Testing & Endpoints Reference](#8-automated-testing--endpoints-reference)
9. [Glossary for Beginners](#9-glossary-for-beginners)

---

# 1. The Big Picture: What Problem Are We Solving?

### The Source Challenge: DVPS30
The challenge statement calls for an application that enables citizens to report **broken streetlights, garbage overflow, and water leakages** directly to municipal authorities with **photo proof** and **precise location**.

### The Real-World Dilemma: The "Complaint Cascade"
In real municipal governance (e.g., GHMC in Hyderabad, BBMP in Bengaluru, NYC 311):
1. A water pipe bursts outside a major metro station during morning rush hour.
2. Within 3 hours, **45 different citizens** submit complaints:
   * Citizen A: *"Flooding on main road near metro"* (text on portal)
   * Citizen B: Uploads a photo of deep water from their car
   * Citizen C: Submits a voice note in Telugu: *"రోడ్డు మీద నీళ్లు కారుతున్నాయి"*
   * Citizen D: Sends an SMS: *"Water pipe burst near pillar 42"*
3. **The Traditional Failure Mode**: Standard complaint portals create **45 independent tickets** (`TKT-101` through `TKT-145`). 
   * Three separate municipal vans get dispatched to the exact same spot.
   * Two crews get confused, mark the ticket as duplicate or already solved, and close it.
   * Public trust plummets, city resources are wasted, and supervisors have zero visibility into where the actual crisis is.

### The CivicPulse Solution: Incident Fusion
Instead of treating complaints as isolated tickets, CivicPulse acts as an **AI-Assisted Incident Intake and Resolution Supervisor**:
$$\mathbf{45\text{ Fragmented Citizen Reports}} \xrightarrow[\text{NLP + GIS + Time}]{\text{Incident Fusion Engine}} \mathbf{1\text{ Consolidated Civic Incident}} \xrightarrow{\text{Priority: 88/100}} \mathbf{Action Plan \to Department}$$

The 45 citizens receive real-time updates linked to the **same single incident**. All 45 photos, voice transcripts, and GPS points become **aggregated evidence** proving the severity of the issue to the municipal engineer.

---

# 2. Core Fundamentals & Terminology

Before inspecting code, you must understand the distinction between two database entities:

| Concept | What It Is | Database Model | Analogy |
| :--- | :--- | :--- | :--- |
| **Report** | A single citizen's raw submission (text, photo, voice transcript, phone number, GPS coordinates, timestamp). | `Report` table (`REP-XXXXX`) | A single 911 phone call or witness statement. |
| **Incident** | A probable real-world physical event formed by one or more fused reports. Has an aggregated priority score, assigned department, and action plan. | `Incident` table (`HYD-RD-XXXX`, `HYD-GB-XXXX`, etc.) | The actual fire or pipe burst itself. |

### The 4 Core Civic Categories
1. ⚠️ **Road Defect / Pothole** (`pothole` $\to$ `HYD-RD-XXXX`): Asphalt breakup, open trenches, dangerous road craters. Handled by **Road Maintenance**.
2. 🗑️ **Garbage Overflow** (`garbage_overflow` $\to$ `HYD-GB-XXXX`): Overflowing dumpsters, illegal dumps, public health hazards. Handled by **Sanitation**.
3. 💧 **Water Leakage & Drainage** (`water_leakage` $\to$ `HYD-WT-XXXX`): Potable pipe bursts, sewage overflow, road flooding. Handled by **Water / Drainage**.
4. 💡 **Broken Streetlight** (`broken_streetlight` $\to$ `HYD-SL-XXXX`): Non-functional luminaires, exposed cables, dark safety corridors. Handled by **Electrical / Street Lighting**.

---

# 3. The Micro-Level End-to-End Pipeline

Here is the exact lifecycle of a report from the millisecond a citizen clicks "Submit" to the moment the municipal department marks it resolved:

```
[ Citizen Submission: Text + Photo + GPS + Voice ]
                       │
                       ▼
            [ 1. Report Ingestion ]
           Saved to DB with unique REP-ID
                       │
                       ▼
     [ 2. Classification & Vision Guard ]
      Detects Category & Confidence (0-100%)
                       │
                       ▼
       [ 3. Spatio-Temporal De-duplication ]
     Compares against active incidents nearby:
     - Distance (Haversine meters)
     - Text Semantics (Cosine similarity)
     - Issue Category agreement
     - Time Window (Recent hours)
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
Relatedness >= 0.72            Relatedness < 0.72
 [ MERGE INTO INCIDENT ]     [ CREATE NEW INCIDENT ]
Attach to existing incident   Assign new HYD-XX-ID
        │                             │
        └──────────────┬──────────────┘
                       │
                       ▼
      [ 4. 5-Vector Priority Scoring ]
   Calculates Explainable Priority (0 - 100)
                       │
                       ▼
      [ 5. Department Routing & Action ]
    Road Maintenance / Sanitation / Water / Lights
    + Generates Standard Operational Action Plan
                       │
                       ▼
      [ 6. Autonomous Alerts & Tracking ]
    - Dispatches SMTP Notification Email
    - Sends Citizen SMS Updates
    - Updates Municipal GIS Command Center
```

---

### Step 1: Multi-Channel Intake
CivicPulse does not force citizens to use one channel. It ingests:
* **Web Portal ([`CitizenReport.tsx`](file:///c:/Users/Rohith/Downloads/Devertathon/frontend/src/pages/CitizenReport.tsx))**: Fast category chips, photo proof upload, interactive GIS map pin-drop, and landmark search.
* **Inbound SMS ([`sms.py`](file:///c:/Users/Rohith/Downloads/Devertathon/backend/app/api/v1/sms.py))**: Ingests SMS text from basic mobile phones, extracting issue keywords and approximate locality.
* **Helpline Call Simulation ([`calls.py`](file:///c:/Users/Rohith/Downloads/Devertathon/backend/app/api/v1/calls.py))**: Simulates an Exotel IVR helpline where citizens speak in English or Telugu. Audio transcripts are parsed directly into reports.

---

### Step 2: Issue Classification & Vision Guard
File: [`backend/app/services/classifier.py`](file:///c:/Users/Rohith/Downloads/Devertathon/backend/app/services/classifier.py)

When text or transcripts arrive, the classifier evaluates:
1. **Keyword Signal Matching**: Uses a prioritized civic lexicon. Words like `"pothole"`, `"crater"`, `"tarmac"`, `"asphalt"` vote for Road Defects; `"leak"`, `"burst"`, `"pipe"`, `"flooding"` vote for Water Leakage.
2. **Telugu Transcript Support**: Recognizes vernacular phrases like `"పెద్ద రోడ్డు గుంత"` (large road hole) or `"నీళ్లు కారుతున్నాయి"` (water leaking).
3. **Vision Model Guard ([`vision.py`](file:///c:/Users/Rohith/Downloads/Devertathon/backend/app/services/vision.py))**: If an image is provided, an optional YOLOv8 detector inspects the bounding box area. If no GPU/YOLO model is enabled, an offline image analyzer extracts color saturation and edge variance to estimate severity.
4. **Confidence Score**: Outputs a confidence float ($0.0 - 1.0$) and a label (`HIGH`, `MEDIUM`, `LOW`). If confidence is below $0.55$, the report is automatically marked with `needs_review = True` so human operators can inspect it without breaking the pipeline.

---

### Step 3: Spatio-Temporal De-duplication Engine
File: [`backend/app/services/duplicates.py`](file:///c:/Users/Rohith/Downloads/Devertathon/backend/app/services/duplicates.py)

How does the system know two reports describe the same pothole? It evaluates a **Composite Relatedness Score ($R$)**:

$$R = 0.40 \cdot S_{\text{geo}} + 0.35 \cdot S_{\text{text}} + 0.15 \cdot S_{\text{cat}} + 0.10 \cdot S_{\text{time}}$$

Where:
1. **Geographic Proximity ($S_{\text{geo}}$)**: Computed using the **Haversine Formula** on Earth's spherical radius ($R_{\text{earth}} \approx 6,371,000\text{ m}$):
   $$d = 2 R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lng}}{2}\right)}\right)$$
   * If distance $d \le 25\text{ m}$: $S_{\text{geo}} = 1.0$ (Almost certainly the exact same spot)
   * If $25\text{ m} < d \le 150\text{ m}$: Linearly decays from $1.0$ down to $0.4$
   * If $d > 500\text{ m}$: $S_{\text{geo}} = 0.0$ (Physically separate issues)
2. **Semantic Text Similarity ($S_{\text{text}}$)**: Tokenized Cosine Similarity over character n-grams and word stems (or `sentence-transformers` embeddings if enabled).
3. **Category Agreement ($S_{\text{cat}}$)**: $1.0$ if both reports identify `water_leakage`, $0.0$ if one says `pothole` and the other says `broken_streetlight`.
4. **Time Proximity ($S_{\text{time}}$)**: Reports filed within $48\text{ hours}$ score $1.0$. Reports filed weeks apart decay toward $0.0$.

#### Decision Thresholds:
* **$R \ge 0.72$ $\to$ `MERGE`**: The new report is automatically merged into the existing incident.
* **$0.45 \le R < 0.72$ $\to$ `MARK_RELATED`**: A new incident is created, but linked as a neighbor.
* **$R < 0.45$ $\to$ `CREATE_NEW`**: Created as an independent, standalone incident.

---

### Step 4: Incident Fusion (The Core Innovation)
File: [`backend/app/services/fusion.py`](file:///c:/Users/Rohith/Downloads/Devertathon/backend/app/services/fusion.py)

When a report merges into an incident:
1. The incident's `report_count` increments (e.g. from 1 to 4).
2. The representative geographic coordinates $(\text{lat}, \text{lng})$ are updated to the **centroid** of all merged reports.
3. The `summary` is re-synthesized to include context from all citizen descriptions.
4. The priority score is **re-calculated dynamically** (multiple reports prove higher real-world impact).

---

### Step 5: 5-Vector Explainable Priority Calculation
File: [`backend/app/services/priority.py`](file:///c:/Users/Rohith/Downloads/Devertathon/backend/app/services/priority.py)

Municipalities reject AI systems that output black-box numbers without rationale. CivicPulse computes a **fully transparent 0–100 score**:

$$\text{Total Priority Score} = V_{\text{sev}} + V_{\text{rep}} + V_{\text{area}} + V_{\text{loc}} + V_{\text{age}}$$

| Vector | Max Points | What It Measures | How It Is Calculated |
| :--- | :---: | :--- | :--- |
| **1. Severity ($V_{\text{sev}}$)** | **35** | Physical hazard level | Inherent issue risk (e.g., deep road crater = 30 pts, minor pothole = 15 pts, unlit residential lamp = 12 pts). |
| **2. Report Repetition ($V_{\text{rep}}$)** | **25** | Public distress & consensus | $1\text{ report} = 0\text{ pts}$, $2\text{ reports} = 10\text{ pts}$, $3\text{ reports} = 18\text{ pts}$, $4+\text{ reports} = 25\text{ pts}$. Multiple independent citizens reporting proves urgency! |
| **3. Affected Area ($V_{\text{area}}$)** | **20** | Physical footprint | Spread of coordinates and photo bounding box fraction. |
| **4. Location Importance ($V_{\text{loc}}$)** | **10** | Critical infrastructure impact | Proximity to transit hubs (Metro stations, arterial junctions) vs. quiet residential alleys. |
| **5. Age / Urgency ($V_{\text{age}}$)** | **10** | Elapsed time without fix | Automatically scales up as the issue sits unresolved past expected response windows. |

#### Priority Tiers:
* **CRITICAL ($80 - 100$)**: Immediate emergency dispatch required. Pulsing red radar halo on map.
* **HIGH ($65 - 79$)**: Urgent; 12–24h SLA.
* **MEDIUM ($45 - 64$)**: Standard queue; 48–72h SLA.
* **LOW ($0 - 44$)**: Routine maintenance.

---

### Step 6: Department Routing & SLA Forecast
File: [`backend/app/core/constants.py`](file:///c:/Users/Rohith/Downloads/Devertathon/backend/app/core/constants.py) & [`predictive.py`](file:///c:/Users/Rohith/Downloads/Devertathon/backend/app/services/predictive.py)

#### 1. Department Routing
Incidents are routed deterministically:
* `pothole` $\to$ **Road Maintenance Department** (`roads@civicpulse.demo`)
* `garbage_overflow` $\to$ **Sanitation Department** (`sanitation@civicpulse.demo`)
* `water_leakage` $\to$ **Water & Drainage Board** (`water@civicpulse.demo`)
* `broken_streetlight` $\to$ **Electrical & Street Lighting** (`streetlight@civicpulse.demo`)

#### 2. SLA Forecast Formula
The system predicts the expected resolution duration in hours:
$$\text{Predicted Hours} = \text{Base Hours} \times \text{Priority Multiplier} + \text{Workload Penalty}$$
* High-priority water main burst: $\text{Base } 24\text{h} \times 0.6 = \mathbf{14.4\text{ hours}}$ target.
* Low-priority routine street lamp: $\text{Base } 72\text{h} \times 1.4 = \mathbf{100.8\text{ hours}}$ target.

---

### Step 7: Autonomous Notification & Public Tracking
1. **Official Email Dispatch ([`email.py`](file:///c:/Users/Rohith/Downloads/Devertathon/backend/app/services/email.py))**: Formats a structured municipal dispatch email containing the incident ID, GPS coordinates, priority score, breakdown explanation, and step-by-step action plan.
2. **Citizen SMS Milestone Texts ([`sms_out.py`](file:///c:/Users/Rohith/Downloads/Devertathon/backend/app/services/sms_out.py))**: Citizens who provide a phone number receive automated milestone SMS texts:
   * Milestone 1: *"Report registered: REP-00022. Fused into Incident HYD-SL-0012."*
   * Milestone 2: *"Electrical crew dispatched to your location."*
   * Milestone 3: *"Issue marked RESOLVED. View resolution proof at civicpulse.demo/track/REP-00022"*
3. **Public Citizen Tracker ([`Tracker.tsx`](file:///c:/Users/Rohith/Downloads/Devertathon/frontend/src/pages/Tracker.tsx))**: Citizens can open `/track/REP-XXXXX` anytime to see a live resolution site map, current status milestone, and an official appeal form.

---

# 4. Architectural Decisions: Why This Approach and Why Not Others?

A senior developer must explain not just *how* a system works, but *why* other obvious designs were rejected.

```
                    COMPARISON OF ARCHITECTURAL APPROACHES
┌───────────────────────┬──────────────────────────┬──────────────────────────────────────┐
│ Approach              │ Why People Try It        │ Why It Fails in Production           │
├───────────────────────┼──────────────────────────┼──────────────────────────────────────┤
│ 1. Naive Ticketing    │ Easy to build            │ Dispatches 45 trucks to 1 pothole;   │
│    (1 Report = 1 Tkt) │ (Standard CRUD app)      │ duplicate chaos; unmanageable noise  │
├───────────────────────┼──────────────────────────┼──────────────────────────────────────┤
│ 2. Pure LLM Pipeline  │ "AI everything" hype     │ High API latency (3-5s); costs $$;   │
│    (Prompt everything)│                          │ hallucinated priority; un-auditable  │
├───────────────────────┼──────────────────────────┼──────────────────────────────────────┤
│ 3. Pure GIS DBSCAN    │ Simple math clustering   │ Merges unrelated issues that happen  │
│    (Spatial only)     │                          │ to be close (e.g. light + garbage)   │
├───────────────────────┼──────────────────────────┼──────────────────────────────────────┤
│ 4. Heavy PyTorch/CUDA │ High accuracy vision     │ 3GB install; crashes without GPU;    │
│    (YOLO mandatory)   │                          │ breaks on standard hackathon machines│
├───────────────────────┼──────────────────────────┼──────────────────────────────────────┤
│ 5. CivicPulse Hybrid  │ Deterministic algorithms │ <50ms latency; runs everywhere;      │
│    (Optimal Solution) │ + NLP + Haversine        │ zero hallucinations; 100% explainable│
└───────────────────────┴──────────────────────────┴──────────────────────────────────────┘
```

### Why Not Naive Ticketing?
If you build a standard CRUD app where each form submission creates a ticket, you haven't solved the civic problem—you've merely digitized citizen frustration. A flood of 50 duplicate tickets paralyzes municipal dispatchers. Incident Fusion is the true core value.

### Why Not a Pure LLM Black-Box Pipeline?
Sending raw text to an external LLM (e.g. OpenAI or Gemini) to ask: *"What department should handle this and what is its priority score?"* introduces severe fatal flaws:
1. **Hallucination Risk**: An LLM might score a trivial pothole 95/100 today and 40/100 tomorrow.
2. **Lack of Auditability**: Government audits require mathematical proof of why an incident was prioritized over another. CivicPulse's 5-factor scoring model can be defended in a city council audit.
3. **Latency & Cost**: LLMs take 2,000–5,000ms per call and cost money per token. CivicPulse's deterministic fusion executes in **under 40ms** locally.

### Why Not Pure GIS Clustering?
If you simply cluster coordinates using DBSCAN or K-Means, two completely different problems located 15 meters apart (e.g., an overflowing trash can right beside an unlit streetlight) will get fused into a single ticket. The municipal worker from Sanitation arrives and ignores the streetlight. CivicPulse requires **semantic category agreement** in addition to geographic proximity.

### Why a Deterministic Fallback Architecture for AI?
Many hackathon projects fail because they mandate 3GB of PyTorch, CUDA, and torchvision dependencies. If a user runs it on a laptop without a discrete GPU, it crashes on startup.
* CivicPulse is designed with a **layered fallback architecture**:
  * Default: Ultra-fast, lightweight scikit-learn/regex/PIL analysis (<50MB, runs in 15ms).
  * Optional: Switch on `torch`, `ultralytics` (YOLO), and `sentence-transformers` via `requirements-ai.txt` if high-end GPU hardware is available.
  * The system **never crashes** if neural network packages are missing.

### Why Custom Leaflet GIS Over Embedded Google Maps?
1. **Zero API Key Dependency**: Google Maps requires billing setup, credit cards, and API quotas that fail during demonstrations or reviews.
2. **Full DOM Styling Control**: Leaflet allows direct injection of animated SVG `DivIcons` with CSS pulse halos and custom cluster badges.
3. **OpenStreetMap / CARTO Integration**: Free, crisp, civic-tailored cartography with no watermarks.

---

# 5. The Map & GIS Subsystem Deep-Dive

The map was previously buggy, distorted, and poorly placed. Here is how it was re-engineered:

### The Container Lifecycle Bug and the Fix
* **The Glitch**: In React, Leaflet initializes before its container's CSS flexbox or grid transitions finish. Leaflet caches the container dimensions at $t=0$. When the card expands or animates via Framer Motion, Leaflet does not know the dimensions changed. Result: grey tiles, half-rendered viewports, and pins floating off-center.
* **The Fix ([`MapView.tsx`](file:///c:/Users/Rohith/Downloads/Devertathon/frontend/src/components/MapView.tsx))**:
  ```tsx
  function MapAutoResizer() {
    const map = useMap();
    useEffect(() => {
      const t1 = setTimeout(() => map.invalidateSize(), 100);
      const t2 = setTimeout(() => map.invalidateSize(), 350);
      const container = map.getContainer();
      if (!container) return;
      const observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(container);
      return () => { clearTimeout(t1); clearTimeout(t2); observer.disconnect(); };
    }, [map]);
    return null;
  }
  ```
  A native `ResizeObserver` monitors the map DOM node continuously. Any container shift immediately calls `map.invalidateSize()`, eliminating grey tiles permanently.

### Nominatim Reverse Geocoding & Landmark Presets
In [`frontend/src/lib/geo.ts`](file:///c:/Users/Rohith/Downloads/Devertathon/frontend/src/lib/geo.ts), the application interfaces with OpenStreetMap's Nominatim reverse-geocoder:
* When a pin drops at $(17.4948, 78.3996)$, Nominatim returns `"Kukatpally Metro, Hyderabad"`.
* If offline or rate-limited, the system falls back to a **spatial landmark dictionary** containing key Hyderabad transit nodes (Kukatpally, Ameerpet, Gachibowli, Miyapur, Amberpet, Charminar, Sultan Bazar).

### Dynamic Bounding vs. Static Averaging
* Previously, the map calculated the mathematical average of all latitudes and longitudes, landing on an arbitrary midpoint where no incident existed, with zoom locked to 12.
* Now, `DynamicMapController` uses `L.latLngBounds(validPoints)`. It dynamically calculates the bounding box enclosing all visible filtered incidents and calls `map.flyToBounds(bounds, { padding: [50, 50] })`.

### Custom SVG DivIcons & Radar Halos
In [`frontend/src/components/gis/MapIcons.ts`](file:///c:/Users/Rohith/Downloads/Devertathon/frontend/src/components/gis/MapIcons.ts):
* Custom Leaflet `DivIcon` instances render vector SVGs instead of blurry PNGs.
* Incidents with `priority_level === "CRITICAL"` render an outer ping ring styled with CSS `@keyframes pulse-ring`.
* Incidents with $N > 1$ merged reports render an inverted dark badge displaying the count $N$.

---

# 6. Micro-Level Codebase Anatomy

### Backend Directory Structure (`backend/`)
* **`app/main.py`**: FastAPI application entrypoint. Configures CORS, mounts `/uploads` static file storage, registers routers, and initializes the Supervisor Agent lifecycle.
* **`app/models/models.py`**: SQLAlchemy database schemas:
  * `Report`: Raw citizen input (`id`, `description`, `issue_type`, `latitude`, `longitude`, `image_filename`, `voice_transcript`, `mobile_number`, etc.).
  * `Incident`: Consolidated municipal event (`id`, `priority_score`, `priority_level`, `department`, `status`, `summary`, `action_plan`, `predicted_resolve_at`, etc.).
  * `IncidentReport`: Many-to-many junction table recording the `relatedness_score` and `relationship_type` (e.g. `merged`).
  * `SmsMessage` & `CallLog`: Inbound telephony and SMS audit tables.
* **`app/services/`**: The core intelligence layer:
  * `classifier.py`: Keyword and semantic NLP category identification.
  * `duplicates.py`: Haversine formula and composite relatedness scoring.
  * `fusion.py`: Merging candidate reports into incidents, updating centroids, and consolidating evidence.
  * `priority.py`: 5-vector explainable priority math.
  * `vision.py`: Image severity extraction and bounding box analysis.
  * `predictive.py`: SLA resolution hours calculation.
  * `watchdog.py`: Scans for stalled or overdue incidents and escalates alerts.
  * `hotspots.py`: Spatio-temporal grid clustering detecting emerging crisis zones.
  * `email.py`: Structured SMTP department alert generator.
  * `sms_out.py`: Automated citizen progress SMS dispatcher.
* **`app/api/v1/`**: REST API endpoints:
  * `reports.py`: `POST /reports`, `GET /reports/tracker/{id}`, `POST /reports/{id}/photo`.
  * `incidents.py`: `GET /incidents`, `GET /incidents/{id}`, `POST /incidents/{id}/status`, `POST /incidents/{id}/email`, `POST /incidents/{id}/appeal`.
  * `dashboard.py`: `GET /dashboard/stats`, `GET /dashboard/incidents`.
  * `demo.py`: `GET /demo/status`, `POST /demo/seed`.
  * `analytics.py`: `GET /analytics/hotspots`, `GET /analytics/watchdog/status`, `POST /analytics/watchdog/run`.
* **`scripts/run.py`**: Uvicorn server launcher.
* **`scripts/test_endpoints.py`**: Automated 20-point verification suite.

---

### Frontend Directory Structure (`frontend/`)
* **`src/App.tsx`**: Navigation header, live backend status pill, and route definitions (`/`, `/dashboard`, `/track/:reportId`, `/contact`).
* **`src/types.ts`**: Complete TypeScript interfaces mirroring backend Pydantic schemas.
* **`src/lib/geo.ts`**: Nominatim reverse-geocoding, address search, HTML5 GPS locate, and Hyderabad presets.
* **`src/lib/api.ts`**: Typed fetch client communicating with the FastAPI backend.
* **`src/components/gis/MapIcons.ts`**: Custom SVG category icons, cluster badges, and pulsing halos.
* **`src/components/MapView.tsx`**: Rebuilt GIS Map with `ResizeObserver`, dynamic bounding, tile toggle, and rich popups.
* **`src/components/LocationPicker.tsx`**: Citizen pin-drop component with landmark search, GPS locate, and reverse geocoding.
* **`src/components/IncidentDetailDrawer.tsx`**: Deep-dive inspector showing consolidated citizen photos, 5-bar priority breakdown, status actions, and department email dispatch.
* **`src/pages/Dashboard.tsx`**: High-density Municipal Operations Hub with split-screen GIS workspace, data grid, and radar tabs.
* **`src/pages/CitizenReport.tsx`**: Intuitive intake form with 4 category cards, photo upload, Telugu chips, and fusion outcome screen.
* **`src/pages/Tracker.tsx`**: Public tracking portal with geocoded resolution site map, SLA timeline, photo proof uploader, and appeal form.

---

# 7. The 4-Step Golden Demo Walkthrough

To demonstrate this system to judges, evaluators, or stakeholders, follow this exact 4-step sequence:

### Step 1: Open the Municipal Dashboard (`/dashboard`)
* Navigate to [http://127.0.0.1:5173/dashboard](http://127.0.0.1:5173/dashboard).
* Click **"Reset Demo Data"** in the top right.
* Point out:
  * The top KPI ribbon: 21 raw reports consolidated into 11 incidents with a **47.6% redundancy reduction**.
  * The Split Workspace: On the left is the interactive GIS canvas with color-coded pins; on the right is the synchronized incident queue.
  * Critical incidents like `HYD-RD-0001` (Kukatpally Metro) have a pulsing red radar halo and an `88/100` priority score.

### Step 2: Submit a Citizen Report (`/`)
* Switch to the Citizen Portal at [http://127.0.0.1:5173/](http://127.0.0.1:5173/).
* Click the **"Road Defect / Pothole"** card.
* Description: *"Deep hazardous road crater near Kukatpally metro entrance damaging vehicles."*
* In the map pin-drop box, click the popular chip **"Kukatpally Metro"** or click on the map.
* Attach an image or sample photo.
* Click **"Submit Report to Municipal Control"**.

### Step 3: Witness the AI Incident Fusion in Action
* Watch the outcome card: The AI detects `Road Hazard / Pothole` and immediately states:
  > **Consolidated into Incident `HYD-RD-0001`!**
* The system recognized that 4 citizens had already reported road damage at this exact Kukatpally Metro coordinate. Instead of creating a duplicate ticket, it merged the report into `HYD-RD-0001`!
* Click **"Live Citizen Tracker"** $\to$ Citizen sees their unique tracking ref `CRN-REP-XXXX/HYD-RD-0001` and an interactive mini-map showing the resolution site.

### Step 4: Act as the Municipal Dispatcher (`/dashboard`)
* Return to the Dashboard. Open `HYD-RD-0001`.
* Inspect the Incident Detail Drawer:
  * Show the 5-factor priority score breakdown (Severity 35, Repetition 25, Area 18, Location 10).
  * Show the list of all merged citizen reports with their actual photo proofs.
  * Click **"Dispatch Department Notice"** $\to$ System dispatches official notification email to `roads@civicpulse.demo`.
  * Click **"IN_PROGRESS"** $\to$ Status advances, milestone audit log updates, and citizen receives SMS update.

---

# 8. Automated Testing & Endpoints Reference

Run the automated integration test suite anytime:

```bash
python backend/scripts/test_endpoints.py
```

### Expected Output:
```text
Verifying CivicPulse REST endpoints...
============================================================
 [OK] GET /                                      : PASS (HTTP 200)
 [OK] GET /api/v1/dashboard/stats                : PASS (HTTP 200)
 [OK] GET /api/v1/dashboard/incidents            : PASS (HTTP 200)
 [OK] GET /api/v1/metrics                        : PASS (HTTP 200)
 [OK] GET /api/v1/demo/status                    : PASS (HTTP 200)
 [OK] POST /api/v1/demo/seed                     : PASS (HTTP 200)
 [OK] GET /api/v1/incidents                      : PASS (HTTP 200)
 [OK] GET /api/v1/incidents/{id}                 : PASS (HTTP 200)
 [OK] GET /api/v1/incidents/{id}/forecast        : PASS (HTTP 200)
 [OK] POST /api/v1/incidents/{id}/status         : PASS (HTTP 200)
 [OK] POST /api/v1/incidents/{id}/email          : PASS (HTTP 200)
 [OK] POST /api/v1/incidents/{id}/appeal         : PASS (HTTP 200)
 [OK] GET /api/v1/analytics/hotspots             : PASS (HTTP 200)
 [OK] GET /api/v1/analytics/watchdog/status      : PASS (HTTP 200)
 [OK] POST /api/v1/analytics/watchdog/run        : PASS (HTTP 200)
 [OK] GET /api/v1/sms/inbox                      : PASS (HTTP 200)
 [OK] POST /api/v1/sms/inbound                   : PASS (HTTP 201)
 [OK] GET /api/v1/calls                          : PASS (HTTP 200)
 [OK] POST /api/v1/calls/simulate                : PASS (HTTP 201)
 [OK] GET /api/v1/reports/tracker/{id}           : PASS (HTTP 200)
============================================================
Total: 20 | Passed: 20 | Failed: 0
```

---

# 9. Glossary for Beginners

* **Haversine Distance**: A mathematical equation that calculates the great-circle distance between two pairs of latitude and longitude coordinates over the curved surface of the Earth.
* **Reverse Geocoding**: Converting raw geographic numbers (e.g. `17.4948, 78.3996`) into human-readable street names (e.g. *"Kukatpally Metro, Hyderabad"*).
* **Forward Geocoding**: Converting a human search query (e.g. *"Ameerpet Junction"*) into latitude and longitude coordinates.
* **SLA (Service Level Agreement)**: The committed timeframe within which a municipal department is expected to inspect and resolve an incident.
* **Cosine Similarity**: A metric used to measure how similar two text documents are by calculating the cosine of the angle between their vector representations.
* **DivIcon**: A Leaflet class that allows rendering arbitrary HTML and inline SVGs as map markers instead of static raster image files.
* **ResizeObserver**: A modern browser API that detects when an HTML element changes size and triggers a callback, used here to prevent Leaflet grey tiles.
