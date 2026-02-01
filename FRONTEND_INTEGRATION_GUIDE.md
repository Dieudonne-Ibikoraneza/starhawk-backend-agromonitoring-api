# Frontend Integration Guide - Starhawk Insurance Platform

This document provides a comprehensive guide for frontend developers to integrate with the Starhawk Backend API. It covers the complete flow from authentication through risk assessment, claim assessment, and policy generation.

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Risk Assessment Flow](#2-risk-assessment-flow)
3. [Claim Assessment Flow](#3-claim-assessment-flow)
4. [Policy Generation Flow](#4-policy-generation-flow)
5. [API Base Configuration](#api-base-configuration)
6. [Error Handling](#error-handling)
7. [Status Enums](#status-enums)
8. [Quick Reference](#quick-reference)

---

## API Base Configuration

### Base URL
```
Development: http://localhost:3000
Production: https://your-api-domain.com
```

### API Prefix
All endpoints are prefixed with `/api/v1`

### Authentication Header
All protected endpoints require:
```javascript
Authorization: Bearer {jwt_token}
```

### Content-Type
```javascript
Content-Type: application/json
```

---

## 1. Authentication Flow

### 1.1 User Login

**Endpoint:** `POST /api/v1/auth/login`

**Request:**
```javascript
const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    phoneNumber: '+250788222222',
    password: 'Password@123'
  })
});

const data = await response.json();
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "6908c847b726367c1d8e9c5d",
  "role": "FARMER",
  "email": "farmer@test.rw",
  "phoneNumber": "+250788222222",
  "firstLoginRequired": false
}
```

**Frontend Implementation:**
```javascript
// Store token for subsequent requests
localStorage.setItem('authToken', data.token);
localStorage.setItem('user', JSON.stringify({
  userId: data.userId,
  role: data.role,
  email: data.email,
  phoneNumber: data.phoneNumber
}));

// Set up axios interceptor or fetch wrapper
axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
```

### 1.2 Token Usage

**Include token in all protected requests:**
```javascript
const response = await fetch(`${API_BASE_URL}/api/v1/some-endpoint`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'Content-Type': 'application/json'
  }
});
```

### 1.3 Token Expiration

- Tokens expire after 24 hours (default)
- Handle 401 Unauthorized responses:
```javascript
// In your API wrapper
if (response.status === 401) {
  // Redirect to login
  localStorage.removeItem('authToken');
  router.push('/login');
}
```

---

## 2. Risk Assessment Flow

This flow covers the complete journey from farm registration through risk assessment to policy issuance.

### Flow Diagram

```
1. Farmer creates farm → 2. Farmer requests insurance → 3. Insurer creates assessment 
→ 4. Assessor updates assessment → 5. Assessor calculates risk → 6. Assessor submits 
→ 7. Insurer issues policy
```

### Step 1: Farm Registration

**Endpoint:** `POST /api/v1/farms`

**Role:** `FARMER`

**Request:**
```javascript
const createFarm = async (farmData) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/farms`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'My Farm',
      cropType: 'MAIZE',
      boundary: {
        type: 'Polygon',
        coordinates: [[
          [30.0599, -1.9403],
          [30.0599, -1.9453],
          [30.0649, -1.9453],
          [30.0649, -1.9403],
          [30.0599, -1.9403]
        ]]
      }
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "6908c96cb726367c1d8e9c7a",
  "farmerId": "6908c847b726367c1d8e9c5d",
  "name": "My Farm",
  "area": 30.5,
  "cropType": "MAIZE",
  "status": "REGISTERED",
  "eosdaFieldId": "10790026",
  "location": {
    "type": "Point",
    "coordinates": [30.0624, -1.9428]
  },
  "boundary": { ... },
  "createdAt": "2025-11-03T15:25:32.593Z",
  "updatedAt": "2025-11-03T15:25:32.593Z"
}
```

**Important:**
- Farm is automatically registered with EOSDA (satellite monitoring)
- `eosdaFieldId` is returned and stored
- Farm status is `REGISTERED`

### Step 2: Request Insurance

**Endpoint:** `POST /api/v1/farms/insurance-requests`

**Role:** `FARMER`

**Request:**
```javascript
const requestInsurance = async (farmId, notes) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/farms/insurance-requests`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      farmId: farmId,
      notes: 'Please assess my farm for insurance'
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "6908c97eb726367c1d8e9c7b",
  "farmerId": "6908c847b726367c1d8e9c5d",
  "farmId": "6908c96cb726367c1d8e9c7a",
  "status": "PENDING",
  "notes": "Please assess my farm for insurance",
  "createdAt": "2025-11-03T15:30:00.000Z"
}
```

**Status:** Insurance request status becomes `PENDING`

### Step 3: Create Assessment (Insurer)

**Endpoint:** `POST /api/v1/assessments`

**Role:** `INSURER`

**Request:**
```javascript
const createAssessment = async (farmId, insuranceRequestId, assessorId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/assessments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${insurerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      farmId: farmId,
      insuranceRequestId: insuranceRequestId,
      assessorId: assessorId,
      notes: 'Initial assessment assigned to assessor'
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "6908cb20b726367c1d8e9c8c",
  "farmId": {
    "id": "6908c96cb726367c1d8e9c7a",
    "name": "My Farm",
    "eosdaFieldId": "10790026"
  },
  "assessorId": { ... },
  "insurerId": { ... },
  "status": "ASSIGNED",
  "assignedAt": "2025-11-03T15:35:00.000Z"
}
```

**Status:** Assessment status is `ASSIGNED`

### Step 4: Update Assessment (Assessor)

**Endpoint:** `PUT /api/v1/assessments/:id`

**Role:** `ASSESSOR`

**Request:**
```javascript
const updateAssessment = async (assessmentId, assessmentData) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/assessments/${assessmentId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${assessorToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      observations: [
        'Field location verified',
        'Crop type: Maize confirmed',
        'Field boundaries match GPS coordinates'
      ],
      visitDate: '2025-11-03T09:00:00Z',
      photoUrls: [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg'
      ]
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "6908cb20b726367c1d8e9c8c",
  "status": "IN_PROGRESS",
  "observations": [...],
  "visitDate": "2025-11-03T09:00:00Z",
  "photoUrls": [...],
  "updatedAt": "2025-11-03T15:37:00.000Z"
}
```

**Status:** Assessment status changes to `IN_PROGRESS`

### Step 5: Calculate Risk Score (Assessor)

**Endpoint:** `POST /api/v1/assessments/:id/calculate-risk`

**Role:** `ASSESSOR`

**Request:**
```javascript
const calculateRisk = async (assessmentId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/assessments/${assessmentId}/calculate-risk`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${assessorToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
};
```

**Response:**
```json
65
```

**What Happens Behind the Scenes:**
1. ✅ Backend fetches 3-year weather history from EOSDA
2. ✅ Backend fetches 3-year NDVI statistics from EOSDA
3. ✅ Backend calculates risk score (0-100) using weighted formula:
   - Crop type risk (30%)
   - Farm size risk (20%)
   - Weather risk (30%)
   - NDVI trend risk (20%)
4. ✅ Risk score is stored in assessment

**Frontend Implementation:**
```javascript
// This might take 10-30 seconds, show loading indicator
const handleCalculateRisk = async (assessmentId) => {
  setLoading(true);
  try {
    const riskScore = await calculateRisk(assessmentId);
    setRiskScore(riskScore);
    // Update UI with risk score
    // Show breakdown if available
  } catch (error) {
    showError('Failed to calculate risk score');
  } finally {
    setLoading(false);
  }
};
```

### Step 6: Submit Assessment (Assessor)

**Endpoint:** `POST /api/v1/assessments/:id/submit`

**Role:** `ASSESSOR`

**Request:**
```javascript
const submitAssessment = async (assessmentId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/assessments/${assessmentId}/submit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${assessorToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "6908cb20b726367c1d8e9c8c",
  "status": "SUBMITTED",
  "riskScore": 65,
  "submittedAt": "2025-11-03T15:40:00.000Z",
  "completedAt": "2025-11-03T15:40:00.000Z"
}
```

**Status:** Assessment status changes to `SUBMITTED`

**Important:**
- Risk score is automatically calculated if not already done
- Assessment must be `SUBMITTED` before policy can be issued

---

## 3. Claim Assessment Flow

This flow covers claim filing through assessment and approval/rejection.

### Flow Diagram

```
1. Farmer files claim → 2. Insurer assigns assessor → 3. Assessor updates assessment 
→ 4. Assessor submits assessment → 5. Insurer approves/rejects claim
```

### Step 1: File Claim (Farmer)

**Endpoint:** `POST /api/v1/claims`

**Role:** `FARMER`

**Request:**
```javascript
const fileClaim = async (policyId, claimData) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/claims`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${farmerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      policyId: policyId,
      eventType: 'DROUGHT', // DROUGHT, FLOOD, PEST, DISEASE, etc.
      eventDate: '2025-11-01T00:00:00Z',
      description: 'Severe drought conditions affecting crop yield',
      estimatedLoss: 500000
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "6908cc30b726367c1d8e9c9d",
  "policyId": { ... },
  "farmerId": { ... },
  "farmId": { ... },
  "status": "FILED",
  "eventType": "DROUGHT",
  "eventDate": "2025-11-01T00:00:00Z",
  "description": "Severe drought conditions affecting crop yield",
  "estimatedLoss": 500000,
  "filedAt": "2025-11-03T16:00:00.000Z"
}
```

**Status:** Claim status is `FILED`

### Step 2: Assign Assessor (Insurer)

**Endpoint:** `PUT /api/v1/claims/:id/assign`

**Role:** `INSURER`

**Request:**
```javascript
const assignAssessor = async (claimId, assessorId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/claims/${claimId}/assign`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${insurerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      assessorId: assessorId
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "6908cc30b726367c1d8e9c9d",
  "status": "ASSIGNED",
  "assessorId": "6908c850b726367c1d8e9c6e",
  "assessmentReportId": "6908cc40b726367c1d8e9c9e"
}
```

**Status:** Claim status changes to `ASSIGNED`
**Important:** A claim assessment is automatically created

### Step 3: Update Claim Assessment (Assessor)

**Endpoint:** `PUT /api/v1/claims/:id/assessment`

**Role:** `ASSESSOR`

**Request:**
```javascript
const updateClaimAssessment = async (claimId, assessmentData) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/claims/${claimId}/assessment`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${assessorToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      visitDate: '2025-11-05T09:00:00Z',
      observations: [
        'Field inspection completed',
        'Significant crop damage observed',
        'Weather data confirms drought conditions'
      ],
      damageArea: 25.0, // hectares
      reportText: 'Detailed assessment report...'
      // ndviBefore, ndviAfter, damageArea are automatically calculated if not provided
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "6908cc40b726367c1d8e9c9e",
  "claimId": "6908cc30b726367c1d8e9c9d",
  "assessorId": { ... },
  "visitDate": "2025-11-05T09:00:00Z",
  "observations": [...],
  "damageArea": 25.0,
  "ndviBefore": 0.65,
  "ndviAfter": 0.35,
  "weatherImpactAnalysis": "Drought conditions confirmed",
  "reportText": "Detailed assessment report..."
}
```

**What Happens Behind the Scenes:**
1. ✅ If `ndviBefore`/`ndviAfter` not provided, backend automatically:
   - Fetches NDVI 30 days before event date
   - Fetches NDVI 7 days after event date
   - Calculates damage percentage
   - Estimates damage area
2. ✅ Claim status changes to `IN_PROGRESS`

**Frontend Implementation:**
```javascript
// Optional: Let backend calculate NDVI automatically
const assessmentData = {
  visitDate: new Date().toISOString(),
  observations: ['Field inspection completed'],
  reportText: 'Assessment report...'
  // Leave ndviBefore, ndviAfter, damageArea empty to auto-calculate
};

// Or provide manual values
const assessmentData = {
  visitDate: new Date().toISOString(),
  observations: ['Field inspection completed'],
  ndviBefore: 0.65, // Manual override
  ndviAfter: 0.35,  // Manual override
  damageArea: 25.0,  // Manual override
  reportText: 'Assessment report...'
};
```

### Step 4: Submit Claim Assessment (Assessor)

**Endpoint:** `POST /api/v1/claims/:id/submit-assessment`

**Role:** `ASSESSOR`

**Request:**
```javascript
const submitClaimAssessment = async (claimId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/claims/${claimId}/submit-assessment`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${assessorToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "6908cc30b726367c1d8e9c9d",
  "status": "ASSESSED",
  "assessmentReportId": "6908cc40b726367c1d8e9c9e",
  "submittedAt": "2025-11-05T10:30:00.000Z"
}
```

**Status:** Claim status changes to `ASSESSED`

### Step 5: Approve/Reject Claim (Insurer)

**Endpoint (Approve):** `PUT /api/v1/claims/:id/approve`  
**Endpoint (Reject):** `PUT /api/v1/claims/:id/reject`

**Role:** `INSURER`

**Approve Request:**
```javascript
const approveClaim = async (claimId, payoutAmount) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/claims/${claimId}/approve`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${insurerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      payoutAmount: payoutAmount
    })
  });
  
  return await response.json();
};
```

**Approve Response:**
```json
{
  "id": "6908cc30b726367c1d8e9c9d",
  "status": "APPROVED",
  "payoutAmount": 450000,
  "approvedAt": "2025-11-06T14:00:00.000Z",
  "approvedBy": "6908c84fb726367c1d8e9c5f"
}
```

**Reject Request:**
```javascript
const rejectClaim = async (claimId, rejectionReason) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/claims/${claimId}/reject`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${insurerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      rejectionReason: 'Insufficient evidence of loss event. NDVI drop within normal seasonal variation.'
    })
  });
  
  return await response.json();
};
```

**Reject Response:**
```json
{
  "id": "6908cc30b726367c1d8e9c9d",
  "status": "REJECTED",
  "rejectionReason": "Insufficient evidence of loss event...",
  "rejectedAt": "2025-11-06T14:00:00.000Z"
}
```

---

## 4. Policy Generation Flow

This flow covers policy issuance after risk assessment is completed.

### Step 1: Issue Policy (Insurer)

**Endpoint:** `POST /api/v1/policies`

**Role:** `INSURER`

**Prerequisites:**
- Assessment must be `SUBMITTED`
- Assessment must belong to the insurer
- Assessment must have a `riskScore`

**Request:**
```javascript
const issuePolicy = async (assessmentId, policyData) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/policies`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${insurerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      assessmentId: assessmentId,
      coverageLevel: 'STANDARD', // STANDARD, PREMIUM, BASIC
      startDate: '2025-12-01T00:00:00Z',
      endDate: '2026-11-30T23:59:59Z'
    })
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "6908cd50b726367c1d8e9cad",
  "farmerId": { ... },
  "farmId": { ... },
  "insurerId": { ... },
  "assessmentId": "6908cb20b726367c1d8e9c8c",
  "policyNumber": "POL-2025-000001",
  "coverageLevel": "STANDARD",
  "premiumAmount": 975000,
  "startDate": "2025-12-01T00:00:00Z",
  "endDate": "2026-11-30T23:59:59Z",
  "status": "ACTIVE",
  "issuedAt": "2025-11-06T10:00:00.000Z"
}
```

**What Happens Behind the Scenes:**
1. ✅ Premium is automatically calculated:
   ```
   basePremiumPerHectare = 50,000 RWF
   riskMultiplier = 0.5 + (riskScore / 100) * 1.5
   premium = basePremiumPerHectare * area * riskMultiplier
   ```
2. ✅ Policy number is auto-generated (format: `POL-YYYY-XXXXXX`)
3. ✅ Farm status is updated to `INSURED`
4. ✅ Policy status is set to `ACTIVE`

**Frontend Implementation:**
```javascript
const handleIssuePolicy = async (assessmentId) => {
  try {
    const policy = await issuePolicy(assessmentId, {
      coverageLevel: selectedCoverageLevel,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    // Show success message
    showSuccess(`Policy ${policy.policyNumber} issued successfully!`);
    
    // Update UI - mark farm as insured
    updateFarmStatus(policy.farmId, 'INSURED');
    
    // Navigate to policy details
    router.push(`/policies/${policy.id}`);
  } catch (error) {
    if (error.status === 400) {
      showError('Assessment must be submitted before issuing policy');
    } else {
      showError('Failed to issue policy');
    }
  }
};
```

### Step 2: View Policy

**Endpoint:** `GET /api/v1/policies/:id`

**Role:** All authenticated users (with appropriate access)

**Request:**
```javascript
const getPolicy = async (policyId) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/policies/${policyId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
};
```

**Response:**
```json
{
  "id": "6908cd50b726367c1d8e9cad",
  "policyNumber": "POL-2025-000001",
  "premiumAmount": 975000,
  "coverageLevel": "STANDARD",
  "status": "ACTIVE",
  "startDate": "2025-12-01T00:00:00Z",
  "endDate": "2026-11-30T23:59:59Z",
  "farmId": {
    "id": "6908c96cb726367c1d8e9c7a",
    "name": "My Farm",
    "area": 30.5
  },
  "assessmentId": {
    "id": "6908cb20b726367c1d8e9c8c",
    "riskScore": 65
  },
  "issuedAt": "2025-11-06T10:00:00.000Z"
}
```

### Step 3: List Policies

**Endpoint:** `GET /api/v1/policies`

**Role:** `FARMER` (sees own policies) or `INSURER` (sees own issued policies)

**Request:**
```javascript
const getPolicies = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/policies`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
};
```

**Response:**
```json
[
  {
    "id": "6908cd50b726367c1d8e9cad",
    "policyNumber": "POL-2025-000001",
    "premiumAmount": 975000,
    "status": "ACTIVE",
    ...
  },
  ...
]
```

---

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": ["field1 is required", "field2 must be a valid enum value"],
  "error": "Bad Request"
}
```

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

**403 Forbidden:**
```json
{
  "statusCode": 403,
  "message": "This assessment is not assigned to you",
  "error": "Forbidden"
}
```

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Assessment not found",
  "error": "Not Found"
}
```

**500 Internal Server Error:**
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error",
  "timestamp": "2025-11-03T15:37:49.007Z",
  "path": "/api/v1/assessments/6908cb20b726367c1d8e9c8c/calculate-risk"
}
```

### Frontend Error Handling Implementation

```javascript
const handleApiCall = async (url, options) => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('authToken');
        router.push('/login');
        throw new Error('Session expired. Please login again.');
      }
      
      if (response.status === 403) {
        throw new Error('You do not have permission to perform this action.');
      }
      
      if (response.status === 404) {
        throw new Error('Resource not found.');
      }
      
      // Handle validation errors
      if (response.status === 400 && Array.isArray(error.message)) {
        throw new Error(error.message.join(', '));
      }
      
      throw new Error(error.message || 'An error occurred');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};
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
- `ASSIGNED` - Assessment assigned to assessor
- `IN_PROGRESS` - Assessment being worked on
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

## Quick Reference

### Authentication
| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `/auth/login` | POST | Public | User login |

### Farms
| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `/farms` | POST | FARMER | Create farm |
| `/farms/:id` | GET | All | Get farm details |
| `/farms/insurance-requests` | POST | FARMER | Request insurance |

### Assessments (Risk)
| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `/assessments` | POST | INSURER | Create assessment |
| `/assessments/:id` | PUT | ASSESSOR | Update assessment |
| `/assessments/:id/calculate-risk` | POST | ASSESSOR | Calculate risk score |
| `/assessments/:id/submit` | POST | ASSESSOR | Submit assessment |

### Policies
| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `/policies` | POST | INSURER | Issue policy |
| `/policies/:id` | GET | All | Get policy details |
| `/policies` | GET | FARMER/INSURER | List policies |

### Claims
| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `/claims` | POST | FARMER | File claim |
| `/claims/:id/assign` | PUT | INSURER | Assign assessor |
| `/claims/:id/assessment` | PUT | ASSESSOR | Update assessment |
| `/claims/:id/submit-assessment` | POST | ASSESSOR | Submit assessment |
| `/claims/:id/approve` | PUT | INSURER | Approve claim |
| `/claims/:id/reject` | PUT | INSURER | Reject claim |

### Farm Analytics (New)
| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `/farms/:id/weather/forecast` | GET | All | Get weather forecast |
| `/farms/:id/weather/historical` | GET | All | Get historical weather |
| `/farms/:id/indices/statistics` | GET | All | Get NDVI/indices statistics |
| `/farms/:id/indices/ndvi` | GET | All | Get NDVI time series |

---

## Complete Flow Examples

### Example 1: Complete Risk Assessment Flow

```javascript
// 1. Login
const loginData = await login('+250788222222', 'Password@123');
const token = loginData.token;

// 2. Create farm
const farm = await createFarm({
  name: 'My Farm',
  cropType: 'MAIZE',
  boundary: { ... }
});

// 3. Request insurance
const insuranceRequest = await requestInsurance(farm.id, 'Please assess');

// 4. (Insurer) Create assessment
const assessment = await createAssessment({
  farmId: farm.id,
  insuranceRequestId: insuranceRequest.id,
  assessorId: 'assessor_id'
});

// 5. (Assessor) Update assessment
await updateAssessment(assessment.id, {
  observations: ['Field verified'],
  visitDate: new Date().toISOString()
});

// 6. (Assessor) Calculate risk
const riskScore = await calculateRisk(assessment.id);
console.log('Risk Score:', riskScore); // e.g., 65

// 7. (Assessor) Submit assessment
await submitAssessment(assessment.id);

// 8. (Insurer) Issue policy
const policy = await issuePolicy(assessment.id, {
  coverageLevel: 'STANDARD',
  startDate: '2025-12-01T00:00:00Z',
  endDate: '2026-11-30T23:59:59Z'
});
console.log('Policy Number:', policy.policyNumber);
console.log('Premium:', policy.premiumAmount);
```

### Example 2: Complete Claim Assessment Flow

```javascript
// 1. (Farmer) File claim
const claim = await fileClaim(policy.id, {
  eventType: 'DROUGHT',
  eventDate: '2025-11-01T00:00:00Z',
  description: 'Severe drought conditions',
  estimatedLoss: 500000
});

// 2. (Insurer) Assign assessor
await assignAssessor(claim.id, 'assessor_id');

// 3. (Assessor) Update assessment
await updateClaimAssessment(claim.id, {
  visitDate: new Date().toISOString(),
  observations: ['Field inspection completed'],
  reportText: 'Detailed report...'
  // ndviBefore, ndviAfter auto-calculated
});

// 4. (Assessor) Submit assessment
await submitClaimAssessment(claim.id);

// 5. (Insurer) Approve claim
const approvedClaim = await approveClaim(claim.id, 450000);
console.log('Payout Amount:', approvedClaim.payoutAmount);
```

---

## Additional Resources

- **API Documentation**: Access Swagger UI at `/api` when backend is running
- **Health Check**: `GET /api/v1/health` - Check API status
- **Error Codes**: See [Error Handling](#error-handling) section

---

**Last Updated**: November 2025  
**API Version**: v1  
**Backend Version**: 1.0.0

