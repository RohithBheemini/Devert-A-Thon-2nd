# CivicPulse — AI Civic Issue Intake & Resolution Assistant
> **DVPS30 — Community Civic Issue Reporting**  
> *Transforming fragmented citizen reports into verified, consolidated, prioritized, and department-routed civic incidents.*

---

## 🏛️ Project Overview

**CivicPulse** is an AI-powered municipal intake and incident resolution platform designed to solve the real-world civic complaint lifecycle. Instead of treating every citizen complaint as an isolated ticket, CivicPulse uses multi-modal AI and geospatial clustering to determine whether multiple citizen reports describe the **same underlying physical problem**.

### Supported Core Categories (DVPS30)
1. ⚠️ **Road Defect / Pothole** (`pothole`)
2. 🗑️ **Garbage Overflow** (`garbage_overflow`)
3. 💧 **Water Leakage & Drainage** (`water_leakage`)
4. 💡 **Broken Streetlight** (`broken_streetlight`)

---

## ⚡ Key Architectural Features

### 1. Spatio-Temporal De-duplication & Incident Fusion
* **Haversine Proximity**: Accurately computes geographic distance between incoming reports and existing neighborhood incidents.
* **Semantic NLP & Vision Guard**: Computes text similarity and categorizes issues with confidence levels (`HIGH`, `MEDIUM`, `LOW`).
* **Evidence Fusion**: Automatically merges duplicate reports into a single actionable incident record while aggregating multiple citizen photos and notes.

### 2. 5-Vector Explainable Priority Engine
Every incident receives a transparent, explainable score ($0-100$):
$$\text{Score} = \text{Severity} (35) + \text{Repetition} (25) + \text{Affected Area} (20) + \text{Location Importance} (10) + \text{Age/Urgency} (10)$$

### 3. Enterprise GIS Command Center (`/dashboard`)
* **Split-Screen Workspace**: Side-by-side interactive GIS map (65%) and prioritized incident queue (35%) with real-time focus synchronization.
* **Leaflet Container Lifecycle Fix**: Powered by a native `ResizeObserver` and staged `invalidateSize()` hooks that permanently eliminate grey or distorted tiles.
* **Custom SVG Category Markers**: Category glyphs, priority halos, and report count badges for fused clusters.
* **OpenStreetMap Nominatim Geocoding**: Real-time reverse geocoding from GPS pins to street addresses and landmark search.
* **Tile Switching & Fullscreen**: Support for CartoDB Positron, OSM, and full-screen GIS views.

### 4. Citizen Reporting & Public Tracker (`/` & `/track/:id`)
* **Intuitive Intake Form**: Quick category cards, photo proof uploader, GPS "Locate Me" button, and Telugu voice notes.
* **Public Tracking Map**: Displays resolution site coordinates, SLA clock, milestone progress timeline, follow-up photo proof, and official appeal submissions.

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18+
* **Python**: 3.10+

---

### Backend Setup (FastAPI)

```bash
cd backend

# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the development server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
* **API Root**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
* **Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### Frontend Setup (React + Vite + Tailwind CSS)

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start the Vite development server
npm run dev
```
* **Web Portal**: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)
  * `/`: Citizen Issue Reporting Portal
  * `/dashboard`: Municipal Operations Hub
  * `/track/:reportId`: Public Citizen Tracker
  * `/contact`: Telephony & Helpline Simulation

---

## 🧪 Automated Testing & Verification

A 20-point automated integration test suite verifies all REST endpoints:

```bash
python backend/scripts/test_endpoints.py
```

### Verified Endpoints (20/20 PASS)
- `GET /` — System status
- `GET /api/v1/dashboard/stats` — KPI metrics
- `GET /api/v1/dashboard/incidents` — Aggregated incident feed
- `GET /api/v1/metrics` — Redundancy reduction & SLA analytics
- `GET /api/v1/demo/status` & `POST /api/v1/demo/seed` — Demo dataset seeder
- `GET /api/v1/incidents` & `GET /api/v1/incidents/{id}` — Incident details
- `POST /api/v1/incidents/{id}/status` — Status lifecycle progression
- `POST /api/v1/incidents/{id}/email` — Automated department alert dispatch
- `POST /api/v1/incidents/{id}/appeal` — Citizen appeal triage
- `GET /api/v1/analytics/hotspots` — Spatio-temporal cluster detection
- `GET /api/v1/analytics/watchdog/status` & `POST /api/v1/analytics/watchdog/run` — SLA Watchdog
- `GET /api/v1/sms/inbox` & `POST /api/v1/sms/inbound` — Two-way SMS notifications
- `GET /api/v1/calls` & `POST /api/v1/calls/simulate` — Exotel helpline simulation
- `GET /api/v1/reports/tracker/{report_id}` — Citizen public tracker with coordinates
