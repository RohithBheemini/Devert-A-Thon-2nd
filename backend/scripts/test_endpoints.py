"""Comprehensive endpoint verification test suite for CivicPulse."""

import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"

def get(path):
    req = urllib.request.Request(f"{BASE}{path}")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode())

def post(path, data=None):
    headers = {"Content-Type": "application/json"} if data is not None else {}
    body = json.dumps(data).encode() if data is not None else b""
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode())

def run_tests():
    passed = 0
    failed = 0
    results = []

    def check(name, fn):
        nonlocal passed, failed
        try:
            status, res = fn()
            if status in (200, 201):
                passed += 1
                results.append((name, "PASS", f"HTTP {status}"))
            else:
                failed += 1
                results.append((name, "FAIL", f"HTTP {status}"))
        except Exception as e:
            failed += 1
            results.append((name, "FAIL", str(e)))

    print("Verifying CivicPulse REST endpoints...")
    
    # 1. Root & Core
    check("GET /", lambda: get("/"))
    check("GET /api/v1/dashboard/stats", lambda: get("/api/v1/dashboard/stats"))
    check("GET /api/v1/dashboard/incidents", lambda: get("/api/v1/dashboard/incidents"))
    check("GET /api/v1/metrics", lambda: get("/api/v1/metrics"))

    # 2. Demo & Seeding
    check("GET /api/v1/demo/status", lambda: get("/api/v1/demo/status"))
    check("POST /api/v1/demo/seed", lambda: post("/api/v1/demo/seed"))

    # 3. Incidents
    check("GET /api/v1/incidents", lambda: get("/api/v1/incidents"))
    
    # Get first incident ID
    _, incs = get("/api/v1/incidents")
    test_inc_id = incs[0]["id"] if incs else "HYD-RD-0001"
    
    check(f"GET /api/v1/incidents/{test_inc_id}", lambda: get(f"/api/v1/incidents/{test_inc_id}"))
    check(f"GET /api/v1/incidents/{test_inc_id}/forecast", lambda: get(f"/api/v1/incidents/{test_inc_id}/forecast"))
    check(f"POST /api/v1/incidents/{test_inc_id}/status", lambda: post(f"/api/v1/incidents/{test_inc_id}/status", {"status": "ACKNOWLEDGED"}))
    check(f"POST /api/v1/incidents/{test_inc_id}/email", lambda: post(f"/api/v1/incidents/{test_inc_id}/email"))
    check(f"POST /api/v1/incidents/{test_inc_id}/appeal", lambda: post(f"/api/v1/incidents/{test_inc_id}/appeal", {"reason": "Verified priority appeal"}))

    # 4. Analytics, Watchdog, Hotspots
    check("GET /api/v1/analytics/hotspots", lambda: get("/api/v1/analytics/hotspots"))
    check("GET /api/v1/analytics/watchdog/status", lambda: get("/api/v1/analytics/watchdog/status"))
    check("POST /api/v1/analytics/watchdog/run?dry_run=true", lambda: post("/api/v1/analytics/watchdog/run?dry_run=true"))

    # 5. SMS & Calls
    check("GET /api/v1/sms/inbox", lambda: get("/api/v1/sms/inbox"))
    check("POST /api/v1/sms/inbound", lambda: post("/api/v1/sms/inbound", {"from_number": "+919845011111", "text": "Pothole near Kukatpally metro"}))
    check("GET /api/v1/calls", lambda: get("/api/v1/calls"))
    check("POST /api/v1/calls/simulate", lambda: post("/api/v1/calls/simulate", {"from_number": "+919845022222", "transcript": "Garbage issue near Ameerpet"}))

    # 6. Tracker
    check("GET /api/v1/reports/tracker/REP-00001", lambda: get("/api/v1/reports/tracker/REP-00001"))

    print("\nEndpoint Verification Summary:")
    print("=" * 60)
    for name, status, detail in results:
        symbol = "[OK]" if status == "PASS" else "[ERR]"
        print(f" {symbol} {name:<42} : {status} ({detail})")
    print("=" * 60)
    print(f"Total: {passed + failed} | Passed: {passed} | Failed: {failed}")
    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
