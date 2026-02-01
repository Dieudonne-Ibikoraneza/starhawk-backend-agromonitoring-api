# Starhawk Insurance Platform - Complete API Summary

## Quick Reference

### Base URL
```
http://localhost:3000
```

### Authentication
All protected endpoints require:
```
Authorization: Bearer {jwt_token}
```

---

## API Endpoints by Module

### 🔐 Authentication (`/auth`)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | Public | User login |

**Request:**
```json
{
  "phoneNumber": "+250788222222",
  "password": "Password@123"
}
```

**Response:**
```json
{
  "token": "jwt_token",
  "userId": "user_id",
  "role": "FARMER",
  "email": "farmer@test.rw",
  "phoneNumber": "+250788222222"
}
```

---

### 👥 Users (`/users`)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/users` | ADMIN | Register new user |
| GET | `/users` | ADMIN | List all users (paginated) |
| GET | `/users/:id` | ADMIN | Get user by ID |
| PUT | `/users/:id` | ADMIN | Update user |
| PUT | `/users/:id/deactivate` | ADMIN | Deactivate user |
| GET | `/users/profile` | All | Get own profile |
| PUT | `/users/profile` | All | Update own profile |

**Query Parameters (GET /users):**
- `page` (default: 0)
- `size` (default: 10)
- `sortBy` (default: 'createdAt')
- `sortDirection` ('asc' | 'desc')

---

### 🚜 Farms (`/farms`)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/farms` | FARMER | Create farm (polygon) |
| POST | `/farms/upload-shapefile` | FARMER | Create farm (shapefile) |
| POST | `/farms/upload-kml` | FARMER | Create farm (KML) |
| GET | `/farms` | All | List farms (role-based) |
| GET | `/farms/:id` | All | Get farm by ID |
| PUT | `/farms/:id` | FARMER | Update farm |
| POST | `/farms/insurance-requests` | FARMER | Request insurance |
| GET | `/farms/insurance-requests` | FARMER/INSURER | Get insurance requests |

**Create Farm Request:**
```json
{
  "name": "My Farm",
  "cropType": "MAIZE",
  "boundary": {
    "type": "Polygon",
    "coordinates": [[
      [30.0599, -1.9403],
      [30.0599, -1.9453],
      [30.0649, -1.9453],
      [30.0649, -1.9403],
      [30.0599, -1.9403]
    ]]
  }
}
```

**Response:**
```json
{
  "id": "farm_id",
  "name": "My Farm",
  "area": 30.5,
  "status": "REGISTERED",
  "eosdaFieldId": "9793351",
  "location": {
    "type": "Point",
    "coordinates": [30.0624, -1.9428]
  }
}
```

**✅ EOSDA Integration:** Automatically creates EOSDA field during farm creation

---

### 📊 Assessments (`/assessments`)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/assessments` | INSURER | Create assessment |
| PUT | `/assessments/:id` | ASSESSOR | Update assessment |
| POST | `/assessments/:id/calculate-risk` | ASSESSOR | Calculate risk score |
| POST | `/assessments/:id/submit` | ASSESSOR | Submit assessment |
| GET | `/assessments/:id` | All | Get assessment |
| GET | `/assessments` | ASSESSOR | Get assessor assessments |

**Create Assessment Request:**
```json
{
  "farmId": "farm_id",
  "insuranceRequestId": "request_id",
  "notes": "Initial assessment"
}
```

**Calculate Risk Score:**
- Fetches 3-year weather history from EOSDA
- Fetches 3-year NDVI statistics from EOSDA
- Calculates weighted risk score (0-100)

**✅ EOSDA Integration:**
- `POST /weather/historical-high-accuracy/{fieldId}`
- `POST /api/gdw/api` (Statistics)

---

### 📜 Policies (`/policies`)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/policies` | INSURER | Issue policy |
| GET | `/policies` | FARMER/INSURER | List policies |
| GET | `/policies/:id` | All | Get policy |

**Issue Policy Request:**
```json
{
  "assessmentId": "assessment_id",
  "coverageLevel": "STANDARD",
  "startDate": "2024-02-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "policy_id",
  "policyNumber": "POL-2024-000001",
  "premiumAmount": 975000,
  "status": "ACTIVE",
  "coverageLevel": "STANDARD"
}
```

**Premium Calculation:**
```
basePremiumPerHectare = 50,000 RWF
riskMultiplier = 0.5 + (riskScore / 100) * 1.5
premium = basePremiumPerHectare * area * riskMultiplier
```

---

### 📋 Claims (`/claims`)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/claims` | FARMER | File claim |
| PUT | `/claims/:id/assign` | INSURER | Assign assessor |
| PUT | `/claims/:id/assessment` | ASSESSOR | Update assessment |
| POST | `/claims/:id/submit-assessment` | ASSESSOR | Submit assessment |
| PUT | `/claims/:id/approve` | INSURER | Approve claim |
| PUT | `/claims/:id/reject` | INSURER | Reject claim |
| GET | `/claims` | All | List claims (role-based) |
| GET | `/claims/:id` | All | Get claim |

**File Claim Request:**
```json
{
  "policyId": "policy_id",
  "eventType": "DROUGHT",
  "eventDate": "2024-06-15T00:00:00Z",
  "description": "Severe drought conditions",
  "estimatedLoss": 500000
}
```

**Update Assessment Request:**
```json
{
  "visitDate": "2024-06-18T09:00:00Z",
  "observations": ["Field inspection completed"],
  "damageArea": 25.0,
  "reportText": "Assessment report..."
}
```

**✅ EOSDA Integration:**
- Automatically calculates NDVI before/after event
- Analyzes damage percentage
- Verifies weather conditions during event

**EOSDA API Calls:**
1. `POST /api/gdw/api` - NDVI before (30 days before)
2. `POST /api/gdw/api` - NDVI after (7 days after)
3. Damage analysis calculation

---

### 📈 Monitoring (`/monitoring`)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/monitoring/farms/:farmId` | All | Get monitoring data |
| GET | `/monitoring/alerts` | All | Get alerts |
| GET | `/monitoring/alerts/:farmId` | All | Get farm alerts |
| PUT | `/monitoring/alerts/:alertId/read` | All | Mark alert as read |

**Response:**
```json
{
  "farmId": "farm_id",
  "currentNDVI": 0.52,
  "baselineNDVI": 0.58,
  "ndviChange": -0.06,
  "alerts": [...],
  "weatherForecast": [...]
}
```

**✅ EOSDA Integration:**
- Daily NDVI monitoring
- Weather forecast retrieval
- Automated alert generation

---

### 👨‍💼 Admin (`/admin`)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/admin/statistics` | ADMIN | System statistics |
| GET | `/admin/policies/overview` | ADMIN | Policy overview |
| GET | `/admin/claims/statistics` | ADMIN | Claim statistics |

---

### ❤️ Health (`/health`)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/health` | Public | Health check |

---

## Request/Response Formats

### Common Headers
```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Common Error Response
```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

### Pagination Response
```json
{
  "data": [...],
  "page": 0,
  "size": 10,
  "total": 100,
  "totalPages": 10
}
```

---

## Status Enums

### Farm Status
- `REGISTERED` - Farm created, not insured
- `INSURED` - Farm has active policy

### Insurance Request Status
- `PENDING` - Request submitted, awaiting assessment
- `ASSESSED` - Assessment completed
- `REJECTED` - Request rejected
- `ACCEPTED` - Request accepted

### Assessment Status
- `DRAFT` - Assessment in progress
- `SUBMITTED` - Assessment submitted to insurer

### Policy Status
- `ACTIVE` - Policy is active
- `EXPIRED` - Policy expired
- `CANCELLED` - Policy cancelled

### Claim Status
- `FILED` - Claim filed by farmer
- `ASSIGNED` - Assessor assigned
- `IN_PROGRESS` - Assessment in progress
- `ASSESSED` - Assessment submitted
- `APPROVED` - Claim approved
- `REJECTED` - Claim rejected

---

## EOSDA Integration Points

### 1. Farm Registration
**Service:** `FieldManagementService.createField()`
**Endpoint:** `POST /field-management`
**When:** During farm creation
**Data Stored:** `farm.eosdaFieldId`

### 2. Risk Assessment
**Service:** `WeatherService.getHistoricalWeather()`
**Service:** `StatisticsService.getStatistics()`
**Endpoints:**
- `POST /weather/historical-high-accuracy/{fieldId}`
- `POST /api/gdw/api` (mt_stats)
**When:** During risk score calculation

### 3. Claim Assessment
**Service:** `StatisticsService.getStatistics()` (called twice)
**Endpoint:** `POST /api/gdw/api`
**When:** During claim assessment update
**Purpose:** Compare NDVI before/after event

### 4. Monitoring
**Service:** `StatisticsService.getStatistics()`
**Service:** `WeatherService.getForecast()`
**When:** Daily cron job
**Purpose:** Monitor field health, generate alerts

---

## Workflow Summary

### 1. Farm Registration Flow
```
Farmer → POST /farms
  → EOSDA: Create field
  → Store eosdaFieldId
  → Return farm with status REGISTERED
```

### 2. Insurance Assessment Flow
```
Farmer → POST /farms/insurance-requests
Insurer → POST /assessments
Assessor → PUT /assessments/:id
Assessor → POST /assessments/:id/calculate-risk
  → EOSDA: Get weather history (3 years)
  → EOSDA: Get NDVI statistics (3 years)
  → Calculate risk score
Assessor → POST /assessments/:id/submit
```

### 3. Policy Issuance Flow
```
Insurer → POST /policies
  → Calculate premium from risk score
  → Update farm status to INSURED
  → Return policy with status ACTIVE
```

### 4. Claim Processing Flow
```
Farmer → POST /claims
Insurer → PUT /claims/:id/assign
Assessor → PUT /claims/:id/assessment
  → EOSDA: Get NDVI before event
  → EOSDA: Get NDVI after event
  → Calculate damage percentage
Assessor → POST /claims/:id/submit-assessment
Insurer → PUT /claims/:id/approve (or reject)
```

---

## Testing Priority

### High Priority (Core Functionality)
1. ✅ User registration and authentication
2. ✅ Farm creation with EOSDA integration
3. ✅ Risk assessment with EOSDA data
4. ✅ Policy issuance
5. ✅ Claim filing and assessment

### Medium Priority (Supporting Features)
1. ✅ Insurance requests
2. ✅ Monitoring and alerts
3. ✅ Admin statistics
4. ✅ File uploads (shapefile, KML)

### Low Priority (Nice to Have)
1. ✅ Profile management
2. ✅ Alert marking
3. ✅ Policy updates

---

## Common Test Cases

### Success Cases
- ✅ Complete workflow (registration → claim approval)
- ✅ Multiple farms per farmer
- ✅ Multiple policies per farm
- ✅ Multiple claims per policy

### Error Cases
- ✅ Invalid geometry
- ✅ EOSDA API failure
- ✅ Invalid policy states
- ✅ Unauthorized access
- ✅ Missing required fields

### Edge Cases
- ✅ Very large farms (>200 hectares)
- ✅ Very small farms (<0.1 hectares)
- ✅ Invalid coordinates
- ✅ Future/past dates
- ✅ Concurrent requests

---

*Last Updated: November 2025*  
*For: Starhawk Insurance Backend*

