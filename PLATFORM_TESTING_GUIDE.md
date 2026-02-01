# Starhawk Insurance Platform - Complete Testing Guide

## Overview
This guide covers end-to-end testing of the Starhawk Insurance Platform from user registration through claim assessment and validation.

**Base URL:** `http://localhost:3000` (adjust for your environment)  
**API Version:** `/api/v1` (if applicable)

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [API Endpoint Reference](#api-endpoint-reference)
3. [Complete Workflow Testing](#complete-workflow-testing)
4. [Individual API Testing](#individual-api-testing)
5. [EOSDA Integration Testing](#eosda-integration-testing)
6. [Test Scenarios](#test-scenarios)

---

## Prerequisites

### 1. Environment Setup
```bash
# Required environment variables
EOSDA_API_KEY=your_eosda_api_key_here
MONGODB_URI=mongodb://localhost:27017/starhawk
JWT_SECRET=your_jwt_secret_here
```

### 2. Test Data
- Valid Rwanda phone numbers: `+250788123456`
- Valid National IDs: `1191234567890123` (16 digits)
- Valid coordinates for Rwanda: `[30.0599, -1.9403]` (Kigali area)

### 3. Testing Tools
- **Postman** (recommended) or **cURL**
- **Swagger UI**: `http://localhost:3000/api` (if enabled)
- **MongoDB Compass** (for database verification)

---

## API Endpoint Reference

### Authentication
```
POST   /auth/login
```

### Users (Admin Only)
```
POST   /users                    # Register user
GET    /users                    # List users
GET    /users/:id                # Get user
PUT    /users/:id                # Update user
PUT    /users/:id/deactivate     # Deactivate user
GET    /users/profile             # Get own profile
PUT    /users/profile             # Update own profile
```

### Farms (Farmer)
```
POST   /farms                    # Create farm (polygon)
POST   /farms/upload-shapefile   # Create farm (shapefile)
POST   /farms/upload-kml         # Create farm (KML)
GET    /farms                     # List farms
GET    /farms/:id                 # Get farm
PUT    /farms/:id                 # Update farm
POST   /farms/insurance-requests # Request insurance
GET    /farms/insurance-requests # Get insurance requests
```

### Assessments (Insurer → Assessor)
```
POST   /assessments               # Create assessment (Insurer)
PUT    /assessments/:id           # Update assessment (Assessor)
POST   /assessments/:id/calculate-risk  # Calculate risk score
POST   /assessments/:id/submit    # Submit assessment
GET    /assessments/:id            # Get assessment
GET    /assessments               # Get assessor assessments
```

### Policies (Insurer)
```
POST   /policies                  # Issue policy
GET    /policies                  # List policies
GET    /policies/:id              # Get policy
```

### Claims (Farmer → Assessor → Insurer)
```
POST   /claims                    # File claim (Farmer)
PUT    /claims/:id/assign         # Assign assessor (Insurer)
PUT    /claims/:id/assessment     # Update assessment (Assessor)
POST   /claims/:id/submit-assessment  # Submit assessment (Assessor)
PUT    /claims/:id/approve        # Approve claim (Insurer)
PUT    /claims/:id/reject         # Reject claim (Insurer)
GET    /claims                     # List claims
GET    /claims/:id                 # Get claim
```

### Monitoring
```
GET    /monitoring/farms/:farmId   # Get monitoring data
GET    /monitoring/alerts         # Get alerts
GET    /monitoring/alerts/:farmId # Get farm alerts
PUT    /monitoring/alerts/:alertId/read  # Mark alert as read
```

### Admin
```
GET    /admin/statistics          # System statistics
GET    /admin/policies/overview   # Policy overview
GET    /admin/claims/statistics   # Claim statistics
```

### Health
```
GET    /health                    # Health check
```

---

## Complete Workflow Testing

### 🎯 Scenario: End-to-End Insurance Journey

This tests the complete flow from platform registration to claim assessment.

---

## Step 1: Platform Setup & User Registration

### 1.1 Health Check
```http
GET /health
```

**Expected Response:**
```json
{
  "status": "ok",
  "info": {
    "mongodb": { "status": "up" },
    "memory_heap": { "status": "up" }
  }
}
```

**✅ Test:** Verify all services are healthy

---

### 1.2 Register Admin User
*Note: Admin is typically bootstrapped. If not, use this:*

```http
POST /users
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "nationalId": "1191234567890123",
  "email": "admin@starhawk.rw",
  "phoneNumber": "+250788111111",
  "role": "ADMIN",
  "password": "Admin@123"
}
```

**Expected Response:**
```json
{
  "id": "user_id_here",
  "email": "admin@starhawk.rw",
  "phoneNumber": "+250788111111",
  "role": "ADMIN",
  "status": "ACTIVE"
}
```

**✅ Test:** Verify admin user created

---

### 1.3 Register Farmer
```http
POST /users
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "nationalId": "1191234567890124",
  "email": "farmer1@test.rw",
  "phoneNumber": "+250788222222",
  "role": "FARMER",
  "password": "Farmer@123"
}
```

**Save:** `farmerUserId`, `farmerToken`

---

### 1.4 Register Insurer
```http
POST /users
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "nationalId": "1191234567890125",
  "email": "insurer1@test.rw",
  "phoneNumber": "+250788333333",
  "role": "INSURER",
  "password": "Insurer@123"
}
```

**Save:** `insurerUserId`, `insurerToken`

---

### 1.5 Register Assessor
```http
POST /users
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "nationalId": "1191234567890126",
  "email": "assessor1@test.rw",
  "phoneNumber": "+250788444444",
  "role": "ASSESSOR",
  "password": "Assessor@123"
}
```

**Save:** `assessorUserId`, `assessorToken`

---

### 1.6 Login as Farmer
```http
POST /auth/login
Content-Type: application/json

{
  "phoneNumber": "+250788222222",
  "password": "Farmer@123"
}
```

**Expected Response:**
```json
{
  "token": "jwt_token_here",
  "userId": "farmer_user_id",
  "role": "FARMER",
  "email": "farmer1@test.rw",
  "phoneNumber": "+250788222222",
  "firstLoginRequired": false
}
```

**✅ Test:** Verify token received and role is FARMER  
**Save:** `farmerToken` for subsequent requests

---

## Step 2: Farm Registration

### 2.1 Create Farm (Polygon Coordinates)
```http
POST /farms
Authorization: Bearer {farmerToken}
Content-Type: application/json

{
  "name": "Test Farm - Maize Field",
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

**Expected Response:**
```json
{
  "id": "farm_id_here",
  "name": "Test Farm - Maize Field",
  "farmerId": "farmer_user_id",
  "area": 30.5,
  "cropType": "MAIZE",
  "status": "REGISTERED",
  "eosdaFieldId": "9793351",
  "location": {
    "type": "Point",
    "coordinates": [30.0624, -1.9428]
  },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**✅ Test Checklist:**
- ✅ Farm created in MongoDB
- ✅ EOSDA field created (`eosdaFieldId` present)
- ✅ Area calculated correctly
- ✅ Location centroid calculated
- ✅ Status is `REGISTERED`

**Save:** `farmId`, `eosdaFieldId`

---

### 2.2 Alternative: Create Farm from Shapefile
```http
POST /farms/upload-shapefile
Authorization: Bearer {farmerToken}
Content-Type: multipart/form-data

file: [shapefile.shp]
name: "Farm from Shapefile"
cropType: "BEANS"
```

**✅ Test:** Verify farm created with proper geometry

---

### 2.3 Get Farm Details
```http
GET /farms/{farmId}
Authorization: Bearer {farmerToken}
```

**✅ Test:** Verify farm data matches creation

---

### 2.4 List All Farms
```http
GET /farms?page=0&size=10
Authorization: Bearer {farmerToken}
```

**✅ Test:** Verify farmer sees only their farms

---

## Step 3: Insurance Request & Assessment

### 3.1 Create Insurance Request (Farmer)
```http
POST /farms/insurance-requests
Authorization: Bearer {farmerToken}
Content-Type: application/json

{
  "farmId": "{farmId}",
  "notes": "Requesting insurance coverage for maize field"
}
```

**Expected Response:**
```json
{
  "id": "request_id",
  "farmId": "farm_id",
  "farmerId": "farmer_user_id",
  "status": "PENDING",
  "notes": "Requesting insurance coverage for maize field",
  "createdAt": "2024-01-15T11:00:00Z"
}
```

**✅ Test:** Verify insurance request created  
**Save:** `insuranceRequestId`

---

### 3.2 Login as Insurer
```http
POST /auth/login
Content-Type: application/json

{
  "phoneNumber": "+250788333333",
  "password": "Insurer@123"
}
```

**Save:** `insurerToken`

---

### 3.3 Get Insurance Requests (Insurer)
```http
GET /farms/insurance-requests
Authorization: Bearer {insurerToken}
```

**✅ Test:** Verify insurer sees pending requests

---

### 3.4 Create Assessment (Insurer)
```http
POST /assessments
Authorization: Bearer {insurerToken}
Content-Type: application/json

{
  "farmId": "{farmId}",
  "insuranceRequestId": "{insuranceRequestId}",
  "notes": "Initial assessment of farm"
}
```

**Expected Response:**
```json
{
  "id": "assessment_id",
  "farmId": "farm_id",
  "insurerId": "insurer_user_id",
  "status": "DRAFT",
  "createdAt": "2024-01-15T11:30:00Z"
}
```

**✅ Test:** Verify assessment created  
**Save:** `assessmentId`

---

### 3.5 Login as Assessor
```http
POST /auth/login
Content-Type: application/json

{
  "phoneNumber": "+250788444444",
  "password": "Assessor@123"
}
```

**Save:** `assessorToken`

---

### 3.6 Update Assessment (Assessor)
```http
PUT /assessments/{assessmentId}
Authorization: Bearer {assessorToken}
Content-Type: application/json

{
  "observations": [
    "Field location verified",
    "Crop type: Maize confirmed",
    "Field boundaries match GPS coordinates"
  ],
  "visitDate": "2024-01-16T09:00:00Z"
}
```

**✅ Test:** Verify assessment updated

---

### 3.7 Calculate Risk Score (Assessor)
```http
POST /assessments/{assessmentId}/calculate-risk
Authorization: Bearer {assessorToken}
```

**Expected Response:**
```json
{
  "riskScore": 65,
  "assessmentId": "assessment_id"
}
```

**✅ Test Checklist:**
- ✅ Risk score calculated (0-100)
- ✅ EOSDA weather data retrieved (3 years historical)
- ✅ EOSDA NDVI statistics retrieved
- ✅ Risk factors considered:
  - Crop type risk (30%)
  - Farm size risk (20%)
  - Weather risk (30%)
  - NDVI trend risk (20%)

**Expected API Calls Behind the Scenes:**
1. `POST /weather/historical-high-accuracy/{eosdaFieldId}`
2. `POST /api/gdw/api` (Statistics) - for NDVI history

**Save:** `riskScore`

---

### 3.8 Submit Assessment (Assessor)
```http
POST /assessments/{assessmentId}/submit
Authorization: Bearer {assessorToken}
```

**Expected Response:**
```json
{
  "id": "assessment_id",
  "status": "SUBMITTED",
  "riskScore": 65,
  "submittedAt": "2024-01-16T10:00:00Z"
}
```

**✅ Test:** Verify assessment status changed to `SUBMITTED`

---

## Step 4: Policy Issuance

### 4.1 Issue Policy (Insurer)
```http
POST /policies
Authorization: Bearer {insurerToken}
Content-Type: application/json

{
  "assessmentId": "{assessmentId}",
  "coverageLevel": "STANDARD",
  "startDate": "2024-02-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z"
}
```

**Expected Response:**
```json
{
  "id": "policy_id",
  "policyNumber": "POL-2024-000001",
  "farmerId": "farmer_user_id",
  "farmId": "farm_id",
  "insurerId": "insurer_user_id",
  "premiumAmount": 975000,
  "coverageLevel": "STANDARD",
  "status": "ACTIVE",
  "startDate": "2024-02-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "createdAt": "2024-01-16T11:00:00Z"
}
```

**✅ Test Checklist:**
- ✅ Policy created with unique policy number
- ✅ Premium calculated: `basePremiumPerHectare * area * riskMultiplier`
- ✅ Farm status updated to `INSURED`
- ✅ Policy status is `ACTIVE`

**Premium Calculation:**
```
basePremiumPerHectare = 50,000 RWF
riskMultiplier = 0.5 + (riskScore / 100) * 1.5
premium = basePremiumPerHectare * area * riskMultiplier

Example:
riskScore = 65
riskMultiplier = 0.5 + (65/100) * 1.5 = 1.475
premium = 50,000 * 30.5 * 1.475 = 2,248,375 RWF
```

**Save:** `policyId`, `policyNumber`

---

### 4.2 Get Policy (Farmer)
```http
GET /policies/{policyId}
Authorization: Bearer {farmerToken}
```

**✅ Test:** Verify farmer can see their policy

---

### 4.3 List Policies (Farmer)
```http
GET /policies
Authorization: Bearer {farmerToken}
```

**✅ Test:** Verify farmer sees only their policies

---

## Step 5: Claim Filing & Assessment

### 5.1 File Claim (Farmer)
```http
POST /claims
Authorization: Bearer {farmerToken}
Content-Type: application/json

{
  "policyId": "{policyId}",
  "eventType": "DROUGHT",
  "eventDate": "2024-06-15T00:00:00Z",
  "description": "Severe drought conditions observed. Crop failure expected.",
  "estimatedLoss": 500000,
  "photos": []
}
```

**Expected Response:**
```json
{
  "id": "claim_id",
  "policyId": "policy_id",
  "farmerId": "farmer_user_id",
  "farmId": "farm_id",
  "eventType": "DROUGHT",
  "eventDate": "2024-06-15T00:00:00Z",
  "description": "Severe drought conditions observed. Crop failure expected.",
  "estimatedLoss": 500000,
  "status": "FILED",
  "filedAt": "2024-06-16T08:00:00Z"
}
```

**✅ Test Checklist:**
- ✅ Claim created
- ✅ Status is `FILED`
- ✅ Policy is active and valid
- ✅ Event date is within policy coverage period

**Save:** `claimId`

---

### 5.2 Assign Assessor (Insurer)
```http
PUT /claims/{claimId}/assign
Authorization: Bearer {insurerToken}
Content-Type: application/json

{
  "assessorId": "{assessorUserId}"
}
```

**Expected Response:**
```json
{
  "id": "claim_id",
  "status": "ASSIGNED",
  "assessorId": "assessor_user_id",
  "assessmentReportId": "assessment_report_id"
}
```

**✅ Test Checklist:**
- ✅ Claim status changed to `ASSIGNED`
- ✅ Assessor assigned
- ✅ Assessment report created automatically

---

### 5.3 Update Claim Assessment (Assessor)
```http
PUT /claims/{claimId}/assessment
Authorization: Bearer {assessorToken}
Content-Type: application/json

{
  "visitDate": "2024-06-18T09:00:00Z",
  "observations": [
    "Field inspection completed",
    "Significant crop damage observed",
    "NDVI analysis confirms vegetation stress"
  ],
  "damageArea": 25.0,
  "reportText": "Comprehensive assessment completed. Damage verified through satellite imagery and field inspection."
}
```

**Expected Response:**
```json
{
  "id": "assessment_report_id",
  "claimId": "claim_id",
  "assessorId": "assessor_user_id",
  "visitDate": "2024-06-18T09:00:00Z",
  "observations": [...],
  "damageArea": 25.0,
  "ndviBefore": 0.58,
  "ndviAfter": 0.35,
  "reportText": "..."
}
```

**✅ Test Checklist:**
- ✅ Assessment updated
- ✅ NDVI before/after automatically calculated from EOSDA
- ✅ Damage analysis performed automatically

**Expected API Calls Behind the Scenes:**
1. `POST /api/gdw/api` - Get NDVI before event (30 days before)
2. `POST /api/gdw/api` - Get NDVI after event (7 days after)
3. Damage percentage calculated: `((ndviBefore - ndviAfter) / ndviBefore) * 100`

---

### 5.4 Submit Claim Assessment (Assessor)
```http
POST /claims/{claimId}/submit-assessment
Authorization: Bearer {assessorToken}
```

**Expected Response:**
```json
{
  "id": "claim_id",
  "status": "ASSESSED",
  "assessmentReportId": "assessment_report_id",
  "submittedAt": "2024-06-18T10:30:00Z"
}
```

**✅ Test:** Verify claim status changed to `ASSESSED`

---

### 5.5 Approve Claim (Insurer)
```http
PUT /claims/{claimId}/approve
Authorization: Bearer {insurerToken}
Content-Type: application/json

{
  "payoutAmount": 450000
}
```

**Expected Response:**
```json
{
  "id": "claim_id",
  "status": "APPROVED",
  "payoutAmount": 450000,
  "approvedAt": "2024-06-20T14:00:00Z",
  "approvedBy": "insurer_user_id"
}
```

**✅ Test Checklist:**
- ✅ Claim status changed to `APPROVED`
- ✅ Payout amount set
- ✅ Approval timestamp recorded

---

### 5.6 Alternative: Reject Claim (Insurer)
```http
PUT /claims/{claimId}/reject
Authorization: Bearer {insurerToken}
Content-Type: application/json

{
  "rejectionReason": "Insufficient evidence of loss event. NDVI drop within normal seasonal variation."
}
```

**Expected Response:**
```json
{
  "id": "claim_id",
  "status": "REJECTED",
  "rejectionReason": "...",
  "rejectedAt": "2024-06-20T14:00:00Z"
}
```

---

### 5.7 Get Claim (Farmer)
```http
GET /claims/{claimId}
Authorization: Bearer {farmerToken}
```

**✅ Test:** Verify farmer can see claim status and assessment details

---

## Step 6: Monitoring & Alerts

### 6.1 Get Monitoring Data
```http
GET /monitoring/farms/{farmId}
Authorization: Bearer {farmerToken}
```

**Expected Response:**
```json
{
  "farmId": "farm_id",
  "currentNDVI": 0.52,
  "baselineNDVI": 0.58,
  "ndviChange": -0.06,
  "alerts": [
    {
      "id": "alert_id",
      "type": "VEGETATION_STRESS",
      "severity": "MEDIUM",
      "message": "NDVI dropped by 10% compared to baseline",
      "createdAt": "2024-06-15T06:00:00Z"
    }
  ],
  "weatherForecast": [...],
  "lastUpdated": "2024-06-15T06:00:00Z"
}
```

**✅ Test Checklist:**
- ✅ Current NDVI from EOSDA
- ✅ Comparison with baseline
- ✅ Alerts generated automatically
- ✅ Weather forecast data

---

### 6.2 Get Alerts
```http
GET /monitoring/alerts
Authorization: Bearer {farmerToken}
```

**✅ Test:** Verify alerts are retrieved

---

### 6.3 Mark Alert as Read
```http
PUT /monitoring/alerts/{alertId}/read
Authorization: Bearer {farmerToken}
```

**✅ Test:** Verify alert marked as read

---

## Individual API Testing

### Test Each Endpoint Individually

Use this section to test specific endpoints in isolation.

---

### Authentication API

#### Login - Success
```http
POST /auth/login
Content-Type: application/json

{
  "phoneNumber": "+250788222222",
  "password": "Farmer@123"
}
```

**✅ Expected:** 200 OK with JWT token

#### Login - Invalid Credentials
```http
POST /auth/login
Content-Type: application/json

{
  "phoneNumber": "+250788222222",
  "password": "WrongPassword"
}
```

**✅ Expected:** 401 Unauthorized

---

### Farms API

#### Create Farm - Validation Errors
```http
POST /farms
Authorization: Bearer {farmerToken}
Content-Type: application/json

{
  "name": "Invalid Farm",
  "boundary": {
    "type": "Polygon",
    "coordinates": [[
      [30.0, -1.9],  // Only 2 points - invalid
      [30.1, -1.9]
    ]]
  }
}
```

**✅ Expected:** 400 Bad Request - "Polygon must have at least 4 points"

#### Create Farm - EOSDA Failure
*Test with invalid EOSDA API key or network issue*

**✅ Expected:** 400 Bad Request - "Failed to register farm with EOSDA"

---

### Assessments API

#### Calculate Risk Score - Without EOSDA Data
*Test with farm that has no `eosdaFieldId`*

**✅ Expected:** Risk score still calculated (defaults to 50)

---

### Claims API

#### File Claim - Invalid Policy
```http
POST /claims
Authorization: Bearer {farmerToken}
Content-Type: application/json

{
  "policyId": "invalid_policy_id",
  "eventType": "DROUGHT",
  "eventDate": "2024-06-15T00:00:00Z"
}
```

**✅ Expected:** 404 Not Found - "Policy not found"

#### File Claim - Policy Not Active
*Test with expired or cancelled policy*

**✅ Expected:** 400 Bad Request - "Policy is not active"

---

## EOSDA Integration Testing

### Test EOSDA Services Directly

These tests verify the EOSDA integration works correctly.

---

### 1. Field Management

#### Create Field in EOSDA
```typescript
// This happens automatically in farm creation
// Verify by checking farm.eosdaFieldId
```

**✅ Test:** Verify `eosdaFieldId` is stored in farm record

---

### 2. Statistics (GDW API)

#### Get NDVI Statistics
*Called during risk assessment*

**Expected API Call:**
```http
POST /api/gdw/api
x-api-key: {eosda_api_key}
Content-Type: application/json

{
  "type": "mt_stats",
  "params": {
    "field_id": "9793351",
    "bm_type": ["NDVI"],
    "date_start": "2021-01-01",
    "date_end": "2024-01-15",
    "sensors": ["sentinel2"],
    "limit": 100,
    "exclude_cover_pixels": true,
    "cloud_masking_level": "best"
  }
}
```

**✅ Test Checklist:**
- ✅ Task created (returns `task_id`)
- ✅ Polling works (exponential backoff)
- ✅ Results retrieved successfully
- ✅ NDVI data in correct format

---

### 3. Weather API

#### Get Historical Weather
*Called during risk assessment*

**Expected API Call:**
```http
POST /weather/historical-high-accuracy/{eosdaFieldId}
x-api-key: {eosda_api_key}
Content-Type: application/json

{
  "params": {
    "date_start": "2021-01-15",
    "date_end": "2024-01-15"
  }
}
```

**✅ Test Checklist:**
- ✅ Weather data retrieved
- ✅ Historical statistics calculated
- ✅ Risk factors extracted (drought, flood frequency)

---

### 4. Field Analytics

#### Get Field Trend
*Can be called for detailed NDVI analysis*

**Expected API Call:**
```http
POST /field-analytics/trend/{eosdaFieldId}
x-api-key: {eosda_api_key}
Content-Type: application/json

{
  "params": {
    "date_start": "2024-01-01",
    "date_end": "2024-06-30",
    "index": "NDVI",
    "data_source": "S2"
  }
}
```

**✅ Test:** Verify async polling works correctly

---

### 5. Damage Analysis

#### Analyze Damage
*Called during claim assessment*

**Expected API Calls:**
1. Get NDVI before (30 days before event)
2. Get NDVI after (7 days after event)
3. Calculate damage percentage

**✅ Test Checklist:**
- ✅ NDVI before retrieved
- ✅ NDVI after retrieved
- ✅ Damage percentage calculated correctly
- ✅ Damage area estimated

---

## Test Scenarios

### Scenario 1: Happy Path
**Goal:** Complete successful insurance journey

**Steps:**
1. ✅ Register users (all roles)
2. ✅ Create farm (with EOSDA integration)
3. ✅ Request insurance
4. ✅ Assess farm (calculate risk score)
5. ✅ Issue policy
6. ✅ File claim
7. ✅ Assess claim (with EOSDA validation)
8. ✅ Approve claim

**Expected:** All steps complete successfully

---

### Scenario 2: EOSDA Integration Failure
**Goal:** Test graceful handling of EOSDA failures

**Steps:**
1. Create farm with invalid EOSDA API key
2. Try to calculate risk score without EOSDA data

**Expected:**
- Farm creation fails gracefully
- Risk score calculation uses defaults

---

### Scenario 3: Claim Validation
**Goal:** Test claim assessment with satellite data

**Steps:**
1. Create farm and issue policy
2. File claim with event date
3. Assign assessor
4. Update assessment (triggers EOSDA analysis)

**Expected:**
- NDVI before/after calculated
- Damage percentage accurate
- Weather verification performed

---

### Scenario 4: Monitoring Alerts
**Goal:** Test automated monitoring system

**Steps:**
1. Create insured farm
2. Wait for daily monitoring cron job (or trigger manually)
3. Check alerts endpoint

**Expected:**
- Alerts generated for vegetation stress
- Weather alerts if severe conditions
- NDVI comparisons with baseline

---

### Scenario 5: Role-Based Access Control
**Goal:** Test permissions for each role

**Test Cases:**
- ✅ Farmer can only see their farms
- ✅ Insurer can only issue policies for their assessments
- ✅ Assessor can only update assigned assessments
- ✅ Admin can see all data

---

## Testing Checklist

### Pre-Production Testing

- [ ] All API endpoints tested
- [ ] Authentication and authorization working
- [ ] EOSDA integration functional
- [ ] Error handling verified
- [ ] Database operations correct
- [ ] Role-based access enforced
- [ ] Data validation working
- [ ] Performance acceptable
- [ ] Monitoring system active
- [ ] Alerts generated correctly

### Integration Testing

- [ ] End-to-end workflow tested
- [ ] EOSDA API calls working
- [ ] Risk scoring accurate
- [ ] Premium calculation correct
- [ ] Claim assessment validated
- [ ] Damage analysis functional

### Edge Cases

- [ ] Invalid geometry handling
- [ ] EOSDA API failures
- [ ] Missing data scenarios
- [ ] Invalid policy states
- [ ] Concurrent requests
- [ ] Rate limiting

---

## Common Issues & Solutions

### Issue: EOSDA API Not Responding
**Solution:** Check `EOSDA_API_KEY` environment variable

### Issue: Farm Creation Fails
**Solution:** Verify geometry is valid (closed polygon, correct coordinates)

### Issue: Risk Score Always 50
**Solution:** Check if `eosdaFieldId` exists and EOSDA API is accessible

### Issue: Claim Assessment Has No NDVI Data
**Solution:** Verify event date is recent enough for satellite data

---

## Performance Testing

### Expected Response Times

- Farm creation: < 5 seconds (includes EOSDA)
- Risk calculation: < 30 seconds (EOSDA statistics)
- Claim assessment: < 45 seconds (multiple EOSDA calls)
- Policy issuance: < 2 seconds

### Load Testing

Test with:
- 10 concurrent farm creations
- 50 concurrent policy requests
- 100 concurrent claim filings

---

## Summary

This guide provides complete coverage of:
1. ✅ User registration (all roles)
2. ✅ Farm registration (with EOSDA)
3. ✅ Insurance assessment (with risk scoring)
4. ✅ Policy issuance
5. ✅ Claim filing and assessment
6. ✅ EOSDA integration verification
7. ✅ Monitoring and alerts

**Next Steps:**
1. Run through complete workflow
2. Test edge cases
3. Verify EOSDA integration
4. Test performance under load
5. Validate all error scenarios

---

*Last Updated: November 2025*  
*For: Starhawk Insurance Backend*

