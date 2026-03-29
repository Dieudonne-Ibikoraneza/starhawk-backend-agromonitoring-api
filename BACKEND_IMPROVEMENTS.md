# Starhawk Backend Improvements & Roadmap

This document outlines the strategic roadmap for the Starhawk Agri-Platform backend. These enhancements are sorted by priority to ensure maximum impact on performance, accuracy, and security.

---

## 🔴 HIGH PRIORITY: Scalability, Security & Core Reliability

### 1. Satellite Data Caching Layer

- **Goal**: Reduce API costs and achieve <100ms response times.
- **Problem**: Repeatedly fetching NDVI/Weather from AgroMonitoring for the same field is slow and uses up API credits.
- **Solution**: Use NestJS `CacheModule` (Redis/In-Memory) to store satellite responses for 24 hours.

### 2. KML Geometry Validation & Repair

- **Goal**: Prevent silent API failures during field registration.
- **Problem**: Self-intersecting polygons or invalid windings lead to rejection by satellite providers.
- **Solution**: Use `@turf/turf` in `FarmsService` to automatically validate and "clean" geometry.

### 3. Field Ownership & Access Guards

- **Goal**: Ensure data privacy and prevent unauthorized access.
- **Problem**: Any user could potentially guess a `farmId` and query its satellite data.
- **Solution**: Implement NestJS `Guards` to verify that an Assessor is assigned to the requested farmer before returning data.

### 4. Database Indexing & Query Optimization

- **Goal**: Maintain sub-second dashboard performance at scale.
- **Problem**: Searching thousands of fields by `farmerId`, `cropType`, or `status` will become slow.
- **Solution**: Add indexes for `farmerId`, `cropType`, `status`, and `province` in the MongoDB schemas.

### 5. API Rate Limiting

- **Goal**: Protect the backend from abuse and accidental loops.
- **Problem**: A bug in a client or a malicious user could overwhelm your server.
- **Solution**: Implement `@nestjs/throttler` to limit requests per IP/User.

### 6. Automated Unit & Integration Testing

- **Goal**: Confidence in core agricultural logic.
- **Problem**: Manual testing of Season A/B logic or damage calculations is slow and error-prone.
- **Solution**: Target 70%+ coverage for `agromonitoring`, `claims`, and `assessments` services using Jest.

---

## 🟡 MEDIUM PRIORITY: Accuracy & Developer Experience

### 7. Centralized "Calculated Fields"

- **Goal**: Single source of truth for all client apps (Web/Mobile/Reports).
- **Solution**: Move Rwanda Season A/B logic and sowing progress calculations to the backend `Farm` DTO.

### 8. "Best Clear Image" Windowed Search

- **Goal**: drastically improve damage analysis accuracy.
- **Problem**: Single-date NDVI can be highly inaccurate if there are clouds.
- **Solution**: Implement a search that finds the image with the _lowest cloud coverage_ within a +/- 7-day window.

### 9. Outgoing API Interceptors & Logging

- **Goal**: Instant troubleshooting of external provider failures.
- **Solution**: Add a global `AxiosInterceptor` to log all requests/responses to AgroMonitoring, capturing latency and status codes.

### 10. Audit Logging (Change Tracking)

- **Goal**: Traceability for insurance claims and policy changes.
- **Solution**: Store a log of "Who, What, When" for critical status changes (e.g., claiming a loss).

### 11. Environment Configuration Validation

- **Goal**: Prevent startup crashes due to missing `.env` keys.
- **Solution**: Use `class-validator` and `ConfigService` to verify all required API keys are present on boot.

---

## 🔵 LOW PRIORITY: Optimization & Resilience

### 12. Satellite Provider Redundancy (Adapters)

- **Goal**: Business continuity.
- **Solution**: Use the **Adapter Pattern** to allow "hot-swapping" between AgroMonitoring, EOSDA, and SentinelHub.

### 13. Asynchronous Satellite Pre-fetching

- **Goal**: Instant data availability.
- **Solution**: Use `@nestjs/schedule` to weekly pre-pull NDVI/Weather for all active fields.

### 14. Automated Notification Hub

- **Goal**: Proactive user engagement.
- **Solution**: Alert assessors via Dashboard/Email when a significant NDVI drop is detected or a report is generated.
