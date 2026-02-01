# Complete Frontend Integration Workflow - Starhawk Insurance Platform
## From Zero to Hero: Complete Step-by-Step Guide

This document provides a comprehensive, step-by-step guide for frontend developers to integrate with the Starhawk Backend API. It covers the complete workflow from user registration through the entire insurance lifecycle.

---

## Table of Contents

1. [API Configuration](#1-api-configuration)
2. [Authentication & User Management](#2-authentication--user-management)
3. [Farm Registration Workflow](#3-farm-registration-workflow)
4. [Admin Assignment Workflow](#4-admin-assignment-workflow)
5. [Assessor Assessment Workflow](#5-assessor-assessment-workflow)
6. [Risk Assessment & Report Generation](#6-risk-assessment--report-generation)
7. [Insurer Approval/Rejection](#7-insurer-approvalrejection)
8. [Crop Monitoring Workflow](#8-crop-monitoring-workflow)
9. [Loss Assessment (Claims)](#9-loss-assessment-claims)
10. [Error Handling & Status Codes](#10-error-handling--status-codes)
11. [Quick Reference](#11-quick-reference)

---

## 1. API Configuration

### Base URL
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const API_VERSION = '/api/v1';
const FULL_API_URL = `${API_BASE_URL}${API_VERSION}`;
```

### Authentication Setup
```javascript
// Axios interceptor example
import axios from 'axios';

const apiClient = axios.create({
  baseURL: FULL_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to all requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (token expired)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 2. Authentication & User Management

### 2.1 Admin Login

**Endpoint:** `POST /auth/login`

**Request:**
```javascript
const login = async (phoneNumber, password) => {
  const response = await apiClient.post('/auth/login', {
    phoneNumber: '0781234567', // Rwandan format (10 digits)
    password: 'admin@123'
  });
  
  // Store authentication data
  localStorage.setItem('authToken', response.data.token);
  localStorage.setItem('user', JSON.stringify({
    userId: response.data.userId,
    role: response.data.role,
    email: response.data.email,
    phoneNumber: response.data.phoneNumber,
    firstLoginRequired: response.data.firstLoginRequired
  }));
  
  return response.data;
};
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "6908c847b726367c1d8e9c5d",
  "role": "ADMIN",
  "email": "admin@starhawk.rw",
  "phoneNumber": "0781234567",
  "firstLoginRequired": false
}
```

### 2.2 Admin Registers Users

**Endpoint:** `POST /users` (Admin only)

**Register Farmer:**
```javascript
const registerFarmer = async (farmerData) => {
  const response = await apiClient.post('/users', {
    email: 'farmer@example.com',
    phoneNumber: '0787654321',
    nationalId: '1199887766554433',
    role: 'FARMER'
  });
  
  return response.data;
};
```

**Register Assessor:**
```javascript
const registerAssessor = async (assessorData) => {
  const response = await apiClient.post('/users', {
    email: 'assessor@example.com',
    phoneNumber: '0787654322',
    nationalId: '1199887766554434',
    role: 'ASSESSOR'
  });
  
  return response.data;
};
```

**Register Insurer:**
```javascript
const registerInsurer = async (insurerData) => {
  const response = await apiClient.post('/users', {
    email: 'insurer@example.com',
    phoneNumber: '0787654323',
    nationalId: '1199887766554435',
    role: 'INSURER'
  });
  
  return response.data;
};
```

**Response:**
```json
{
  "id": "6908c850b726367c1d8e9c6e",
  "email": "farmer@example.com",
  "phoneNumber": "0787654321",
  "nationalId": "1199887766554433",
  "firstName": "John",
  "lastName": "Doe",
  "role": "FARMER",
  "active": true,
  "firstLoginRequired": true,
  "farmerProfile": {
    "farmProvince": null,
    "farmDistrict": null,
    "farmSector": null,
    "farmCell": null,
    "farmVillage": null
  }
}
```

### 2.3 User Login (All Roles)

**Endpoint:** `POST /auth/login`

```javascript
const login = async (phoneNumber, password) => {
  const response = await apiClient.post('/auth/login', {
    phoneNumber,
    password
  });
  
  // Store auth data
  localStorage.setItem('authToken', response.data.token);
  localStorage.setItem('user', JSON.stringify({
    userId: response.data.userId,
    role: response.data.role,
    email: response.data.email,
    phoneNumber: response.data.phoneNumber
  }));
  
  // Redirect based on role
  const role = response.data.role;
  if (role === 'FARMER') {
    window.location.href = '/farmer/dashboard';
  } else if (role === 'ASSESSOR') {
    window.location.href = '/assessor/dashboard';
  } else if (role === 'INSURER') {
    window.location.href = '/insurer/dashboard';
  } else if (role === 'ADMIN') {
    window.location.href = '/admin/dashboard';
  }
  
  return response.data;
};
```

---

## 3. Farm Registration Workflow

### 3.1 Farmer Registers Farm

**Endpoint:** `POST /farms/register` (Farmer only)

**Important:** Sowing date must be at least 14 days in the future.

**Request:**
```javascript
const registerFarm = async (cropType, sowingDate) => {
  // Validate sowing date is at least 14 days in future
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 14);
  
  const selectedDate = new Date(sowingDate);
  if (selectedDate < minDate) {
    throw new Error('Sowing date must be at least 14 days in the future');
  }
  
  const response = await apiClient.post('/farms/register', {
    cropType: 'MAIZE', // MAIZE, BEANS, RICE, WHEAT, etc.
    sowingDate: '2025-05-01' // YYYY-MM-DD format, must be >= 14 days from today
  });
  
  return response.data;
};
```

**Response:**
```json
{
  "id": "6908c860b726367c1d8e9c7e",
  "farmerId": "6908c850b726367c1d8e9c6e",
  "cropType": "MAIZE",
  "sowingDate": "2025-05-01T00:00:00.000Z",
  "status": "PENDING",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Frontend UI Flow:**
1. Show crop type dropdown (MAIZE, BEANS, RICE, etc.)
2. Show date picker with minimum date = today + 14 days
3. Validate date before submission
4. Show success message: "Farm registered successfully. Awaiting assessor assignment."
5. Admin will be automatically notified

**Error Handling:**
```javascript
try {
  await registerFarm('MAIZE', '2025-01-20');
} catch (error) {
  if (error.response?.status === 400) {
    // Validation error - show message
    alert(error.response.data.message);
  }
}
```

---

## 4. Admin Assignment Workflow

### 4.1 Admin Views Pending Farms

**Endpoint:** `GET /assessments/pending-farms` (Admin only)

**Request:**
```javascript
const getPendingFarms = async () => {
  const response = await apiClient.get('/assessments/pending-farms');
  return response.data;
};
```

**Response:**
```json
[
  {
    "id": "6908c860b726367c1d8e9c7e",
    "cropType": "MAIZE",
    "sowingDate": "2025-05-01T00:00:00.000Z",
    "name": null,
    "farmer": {
      "id": "6908c850b726367c1d8e9c6e",
      "email": "farmer@example.com",
      "phoneNumber": "0787654321",
      "nationalId": "1199887766554433",
      "firstName": "John",
      "lastName": "Doe",
      "province": "Kigali",
      "district": "Kicukiro",
      "sector": "Gikondo",
      "cell": "Kicukiro",
      "village": "Kicukiro",
      "farmerProfile": {
        "farmProvince": "Eastern",
        "farmDistrict": "Rwamagana",
        "farmSector": "Muhazi",
        "farmCell": "Muhazi",
        "farmVillage": "Muhazi"
      }
    },
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
]
```

**Frontend UI:**
- Display table/list of pending farms
- Show: Farmer name, crop type, sowing date, farm location
- Action button: "Assign Assessor"

### 4.2 Admin Gets Available Assessors

**Endpoint:** `GET /users/assessors` (Admin/Insurer only)

**Request:**
```javascript
const getAssessors = async (page = 0, size = 10) => {
  const response = await apiClient.get('/users/assessors', {
    params: { page, size }
  });
  return response.data;
};
```

**Response:**
```json
{
  "items": [
    {
      "id": "6908c855b726367c1d8e9c6f",
      "firstName": "Jane",
      "lastName": "Assessor",
      "email": "assessor@example.com",
      "phoneNumber": "0787654322",
      "role": "ASSESSOR",
      "assessorProfile": {
        "specialization": "Crop Assessment",
        "experienceYears": 5
      }
    }
  ],
  "totalItems": 10,
  "totalPages": 1,
  "currentPage": 0
}
```

### 4.3 Admin Assigns Assessor to Farm

**Endpoint:** `POST /assessments/assign` (Admin only)

**Request:**
```javascript
const assignAssessor = async (farmId, assessorId, insurerId = null) => {
  const response = await apiClient.post('/assessments/assign', {
    farmId: '6908c860b726367c1d8e9c7e',
    assessorId: '6908c855b726367c1d8e9c6f',
    insurerId: insurerId // Optional - can be null
  });
  
  return response.data;
};
```

**Response:**
```json
{
  "_id": "6908c870b726367c1d8e9c8e",
  "farmId": "6908c860b726367c1d8e9c7e",
  "assessorId": "6908c855b726367c1d8e9c6f",
  "insurerId": null,
  "status": "ASSIGNED",
  "assignedAt": "2025-01-15T11:00:00.000Z"
}
```

**Frontend UI Flow:**
1. Admin clicks "Assign Assessor" on pending farm
2. Modal/dialog opens showing list of assessors
3. Admin selects assessor (and optionally insurer)
4. Click "Assign"
5. Show success: "Assessor assigned successfully. Assessor has been notified."
6. Assessor will receive email notification

---

## 5. Assessor Assessment Workflow

### 5.1 Assessor Views Assigned Farms

**Endpoint:** `GET /assessments/farmers/list` (Assessor only)

**Request:**
```javascript
const getAssignedFarmers = async () => {
  const response = await apiClient.get('/assessments/farmers/list');
  return response.data;
};
```

**Response:**
```json
[
  {
    "id": "6908c850b726367c1d8e9c6e",
    "firstName": "John",
    "lastName": "Doe",
    "email": "farmer@example.com",
    "phoneNumber": "0787654321",
    "farmerProfile": {
      "farmProvince": "Eastern",
      "farmDistrict": "Rwamagana",
      "farmSector": "Muhazi"
    },
    "farms": [
      {
        "id": "6908c860b726367c1d8e9c7e",
        "cropType": "MAIZE",
        "sowingDate": "2025-05-01T00:00:00.000Z",
        "status": "PENDING",
        "name": null
      }
    ]
  }
]
```

**Frontend UI:**
- Display list of farmers with their farms
- Show farm status (PENDING = needs KML upload)
- Action: "Upload KML" button for PENDING farms

### 5.2 Assessor Uploads KML File

**Endpoint:** `POST /farms/:farmId/upload-kml` (Assessor only)

**Request:**
```javascript
const uploadKML = async (farmId, name, kmlFile) => {
  const formData = new FormData();
  formData.append('file', kmlFile);
  formData.append('name', name);
  
  const response = await apiClient.post(
    `/farms/${farmId}/upload-kml`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  
  return response.data;
};
```

**Response:**
```json
{
  "id": "6908c860b726367c1d8e9c7e",
  "farmerId": "6908c850b726367c1d8e9c6e",
  "name": "Main Farm Field",
  "cropType": "MAIZE",
  "sowingDate": "2025-05-01T00:00:00.000Z",
  "area": 2.5,
  "location": {
    "type": "Point",
    "coordinates": [30.0619, -1.9441]
  },
  "boundary": {
    "type": "Polygon",
    "coordinates": [[[30.0, -1.9], [30.1, -1.9], [30.1, -2.0], [30.0, -2.0], [30.0, -1.9]]]
  },
  "status": "REGISTERED",
  "eosdaFieldId": "12345",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

**Frontend UI Flow:**
1. Assessor clicks "Upload KML" on a PENDING farm
2. File upload dialog opens
3. Assessor selects KML file and enters farm name
4. Show upload progress
5. On success: "KML uploaded successfully. EOSDA field created."
6. Farm status changes to REGISTERED
7. Navigate to risk assessment page

**File Validation:**
- Accept only .kml files
- Max file size: 1MB
- Validate file format before upload

---

## 6. Risk Assessment & Report Generation

### 6.1 Assessor Views Assessment Details

**Endpoint:** `GET /assessments/:id` (Assessor/Insurer/Admin)

**Request:**
```javascript
const getAssessment = async (assessmentId) => {
  const response = await apiClient.get(`/assessments/${assessmentId}`);
  return response.data;
};
```

**Response:**
```json
{
  "_id": "6908c870b726367c1d8e9c8e",
  "farmId": {
    "_id": "6908c860b726367c1d8e9c7e",
    "name": "Main Farm Field",
    "cropType": "MAIZE",
    "eosdaFieldId": "12345"
  },
  "assessorId": {
    "_id": "6908c855b726367c1d8e9c6f",
    "firstName": "Jane",
    "lastName": "Assessor"
  },
  "status": "IN_PROGRESS",
  "riskScore": null,
  "observations": [],
  "photoUrls": [],
  "reportText": null,
  "droneAnalysisPdfUrl": null,
  "droneAnalysisData": null,
  "comprehensiveNotes": null,
  "reportGenerated": false
}
```

### 6.2 Fetch Field Details from EOSDA

**Endpoint:** `GET /farms/:id/indices/statistics` (Get NDVI data)

**Request:**
```javascript
const getFieldStatistics = async (farmId, dateStart, dateEnd) => {
  const response = await apiClient.get(`/farms/${farmId}/indices/statistics`, {
    params: {
      dateStart: '2022-01-01',
      dateEnd: '2025-01-15',
      indices: 'NDVI,MSAVI,NDMI,EVI'
    }
  });
  return response.data;
};
```

**Endpoint:** `GET /farms/:id/weather/historical` (Get weather data)

**Request:**
```javascript
const getHistoricalWeather = async (farmId, dateStart, dateEnd) => {
  const response = await apiClient.get(`/farms/${farmId}/weather/historical`, {
    params: {
      dateStart: '2022-01-01',
      dateEnd: '2025-01-15'
    }
  });
  return response.data;
};
```

**Frontend UI:**
- Display field statistics (NDVI charts, trends)
- Display weather history (rainfall, temperature charts)
- Show field imagery if available

### 6.3 Calculate Risk Score

**Endpoint:** `POST /assessments/:id/calculate-risk` (Assessor only)

**Request:**
```javascript
const calculateRiskScore = async (assessmentId) => {
  const response = await apiClient.post(
    `/assessments/${assessmentId}/calculate-risk`
  );
  return response.data;
};
```

**Response:**
```json
75.5
```

**Frontend UI:**
- Button: "Calculate Risk Score"
- Show loading spinner
- Display risk score (0-100) with color coding:
  - 0-30: Low risk (green)
  - 31-70: Medium risk (yellow)
  - 71-100: High risk (red)

### 6.4 Upload Drone Analysis PDF

**Endpoint:** `POST /assessments/:id/upload-drone-pdf` (Assessor only)

**Request:**
```javascript
const uploadDronePDF = async (assessmentId, pdfFile) => {
  const formData = new FormData();
  formData.append('file', pdfFile);
  
  const response = await apiClient.post(
    `/assessments/${assessmentId}/upload-drone-pdf`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  
  return response.data;
};
```

**Response:**
```json
{
  "_id": "6908c870b726367c1d8e9c8e",
  "droneAnalysisPdfUrl": "/uploads/drone/abc123.pdf",
  "droneAnalysisData": {
    "cropHealth": "Good",
    "coverage": 85,
    "anomalies": ["Minor pest damage in sector 3"]
  }
}
```

**Frontend UI:**
- File upload for PDF
- Show extracted data after processing
- Display extracted drone analysis data

### 6.5 Add Comprehensive Assessment Notes

**Endpoint:** `PUT /assessments/:id` (Assessor only)

**Request:**
```javascript
const updateAssessment = async (assessmentId, notes) => {
  const response = await apiClient.put(`/assessments/${assessmentId}`, {
    comprehensiveNotes: notes
  });
  return response.data;
};
```

**Frontend UI:**
- Large text area for comprehensive notes
- Auto-save or manual save button
- Character count

### 6.6 Generate Full Report

**Endpoint:** `POST /assessments/:id/generate-report` (Assessor only)

**Request:**
```javascript
const generateFullReport = async (assessmentId) => {
  const response = await apiClient.post(
    `/assessments/${assessmentId}/generate-report`
  );
  return response.data;
};
```

**Response:**
```json
{
  "_id": "6908c870b726367c1d8e9c8e",
  "reportGenerated": true,
  "reportGeneratedAt": "2025-01-15T14:00:00.000Z",
  "status": "SUBMITTED"
}
```

**Frontend UI Flow:**
1. Button: "Generate Full Report"
2. Validate all fields are complete:
   - Risk score calculated ✓
   - Weather analysis done ✓
   - Drone PDF uploaded (optional) ✓
   - Comprehensive notes added ✓
3. If incomplete, show which fields are missing
4. If complete, generate report
5. Show success: "Report generated. Insurer has been notified."
6. Insurer will receive email notification

**Validation Check:**
```javascript
const canGenerateReport = (assessment) => {
  return (
    assessment.riskScore !== null &&
    assessment.comprehensiveNotes &&
    assessment.comprehensiveNotes.length > 0
  );
};
```

---

## 7. Insurer Approval/Rejection

### 7.1 Insurer Views Pending Reports

**Endpoint:** `GET /assessments` (Insurer only - returns their assessments)

**Request:**
```javascript
const getInsurerAssessments = async () => {
  const response = await apiClient.get('/assessments');
  return response.data;
};
```

**Response:**
```json
[
  {
    "_id": "6908c870b726367c1d8e9c8e",
    "farmId": {
      "name": "Main Farm Field",
      "cropType": "MAIZE"
    },
    "status": "SUBMITTED",
    "reportGenerated": true,
    "riskScore": 75.5,
    "reportGeneratedAt": "2025-01-15T14:00:00.000Z"
  }
]
```

**Frontend UI:**
- Filter assessments by status: SUBMITTED
- Show: Farm name, crop type, risk score, report date
- Actions: "View Report", "Approve", "Reject"

### 7.2 Insurer Views Full Report

**Endpoint:** `GET /assessments/:id` (Get full assessment details)

**Request:**
```javascript
const viewFullReport = async (assessmentId) => {
  const response = await apiClient.get(`/assessments/${assessmentId}`);
  return response.data;
};
```

**Frontend UI:**
- Display complete report:
  - Farm details
  - Field statistics (NDVI, weather)
  - Risk score
  - Drone analysis data
  - Comprehensive notes
  - Photos (if any)

### 7.3 Insurer Approves Assessment

**Endpoint:** `POST /assessments/:id/approve` (Insurer only)

**Request:**
```javascript
const approveAssessment = async (assessmentId) => {
  const response = await apiClient.post(
    `/assessments/${assessmentId}/approve`
  );
  return response.data;
};
```

**Response:**
```json
{
  "_id": "6908c870b726367c1d8e9c8e",
  "status": "APPROVED",
  "updatedAt": "2025-01-15T15:00:00.000Z"
}
```

**Frontend UI:**
- Button: "Approve Assessment"
- Confirmation dialog: "Are you sure you want to approve this assessment?"
- On success: "Assessment approved. Farmer and assessor have been notified."
- Navigate to policy creation page

### 7.4 Insurer Rejects Assessment

**Endpoint:** `POST /assessments/:id/reject` (Insurer only)

**Request:**
```javascript
const rejectAssessment = async (assessmentId, rejectionReason) => {
  const response = await apiClient.post(
    `/assessments/${assessmentId}/reject`,
    {
      rejectionReason: 'Risk score too high for coverage'
    }
  );
  return response.data;
};
```

**Response:**
```json
{
  "_id": "6908c870b726367c1d8e9c8e",
  "status": "REJECTED",
  "rejectionReason": "Risk score too high for coverage",
  "updatedAt": "2025-01-15T15:00:00.000Z"
}
```

**Frontend UI:**
- Button: "Reject Assessment"
- Modal with text area for rejection reason (required)
- On success: "Assessment rejected. Farmer and assessor have been notified."

### 7.5 Insurer Creates Policy (After Approval)

**Endpoint:** `POST /policies` (Insurer only)

**Request:**
```javascript
const createPolicy = async (assessmentId, coverageLevel, startDate, endDate) => {
  const response = await apiClient.post('/policies', {
    assessmentId: assessmentId,
    coverageLevel: 'STANDARD', // STANDARD, PREMIUM
    startDate: '2025-05-01T00:00:00.000Z',
    endDate: '2025-12-31T23:59:59.000Z'
  });
  return response.data;
};
```

**Response:**
```json
{
  "_id": "6908c880b726367c1d8e9c9e",
  "policyNumber": "POL-2025-000001",
  "premiumAmount": 975000,
  "status": "ACTIVE",
  "coverageLevel": "STANDARD",
  "startDate": "2025-05-01T00:00:00.000Z",
  "endDate": "2025-12-31T23:59:59.000Z"
}
```

---

## 8. Crop Monitoring Workflow

### 8.1 Assessor Starts Crop Monitoring

**Endpoint:** `POST /crop-monitoring/start` (Assessor only)

**Request:**
```javascript
const startCropMonitoring = async (policyId) => {
  const response = await apiClient.post('/crop-monitoring/start', {
    policyId: '6908c880b726367c1d8e9c9e'
  });
  return response.data;
};
```

**Response:**
```json
{
  "_id": "6908c890b726367c1d8e9caf",
  "policyId": "6908c880b726367c1d8e9c9e",
  "farmId": "6908c860b726367c1d8e9c7e",
  "assessorId": "6908c855b726367c1d8e9c6f",
  "monitoringNumber": 1,
  "monitoringDate": "2025-06-15T10:00:00.000Z",
  "weatherData": { /* EOSDA weather data */ },
  "ndviData": { /* EOSDA NDVI data */ },
  "status": "IN_PROGRESS"
}
```

**Frontend UI:**
- Show list of active policies assigned to assessor
- Button: "Start Monitoring" (max 2 times per policy)
- Validate: Check if already 2 monitoring cycles completed
- If max reached, disable button and show message

### 8.2 Assessor Updates Monitoring Data

**Endpoint:** `PUT /crop-monitoring/:id` (Assessor only)

**Request:**
```javascript
const updateMonitoring = async (monitoringId, updateData) => {
  const response = await apiClient.put(
    `/crop-monitoring/${monitoringId}`,
    {
      observations: ['Crop growth is healthy', 'Minor pest activity detected'],
      photoUrls: ['/uploads/photos/photo1.jpg'],
      notes: 'Overall crop condition is good. Monitoring cycle 1 of 2.'
    }
  );
  return response.data;
};
```

### 8.3 Assessor Generates Monitoring Report

**Endpoint:** `POST /crop-monitoring/:id/generate-report` (Assessor only)

**Request:**
```javascript
const generateMonitoringReport = async (monitoringId) => {
  const response = await apiClient.post(
    `/crop-monitoring/${monitoringId}/generate-report`
  );
  return response.data;
};
```

**Response:**
```json
{
  "_id": "6908c890b726367c1d8e9caf",
  "reportGenerated": true,
  "reportGeneratedAt": "2025-06-20T14:00:00.000Z",
  "status": "COMPLETED"
}
```

**Frontend UI:**
- Validate all fields complete
- Generate report
- Show success: "Monitoring report generated. Dispatched to insurer."
- Mark monitoring as completed

### 8.4 View Monitoring History

**Endpoint:** `GET /crop-monitoring` (Role-based)

**Request:**
```javascript
const getMonitoringHistory = async () => {
  const response = await apiClient.get('/crop-monitoring');
  return response.data;
};
```

---

## 9. Loss Assessment (Claims)

### 9.1 Farmer Files Claim

**Endpoint:** `POST /claims` (Farmer only)

**Request:**
```javascript
const fileClaim = async (policyId, lossEventType, lossDescription, damagePhotos) => {
  const response = await apiClient.post('/claims', {
    policyId: '6908c880b726367c1d8e9c9e',
    lossEventType: 'DROUGHT', // DROUGHT, HIGH_RAINFALL, FLOOD, PEST, DISEASE
    lossDescription: 'Severe drought conditions affecting crop yield',
    damagePhotos: ['/uploads/photos/damage1.jpg', '/uploads/photos/damage2.jpg']
  });
  return response.data;
};
```

**Response:**
```json
{
  "_id": "6908c8a0b726367c1d8e9cb0",
  "policyId": "6908c880b726367c1d8e9c9e",
  "status": "FILED",
  "lossEventType": "DROUGHT",
  "filedAt": "2025-07-15T10:00:00.000Z"
}
```

### 9.2 Insurer Assigns Assessor to Claim

**Endpoint:** `PUT /claims/:id/assign` (Insurer only)

**Request:**
```javascript
const assignClaimAssessor = async (claimId, assessorId) => {
  const response = await apiClient.put(`/claims/${claimId}/assign`, {
    assessorId: '6908c855b726367c1d8e9c6f'
  });
  return response.data;
};
```

### 9.3 Assessor Updates Claim Assessment

**Endpoint:** `PUT /claims/:id/assessment` (Assessor only)

**Request:**
```javascript
const updateClaimAssessment = async (claimId, assessmentData) => {
  const response = await apiClient.put(
    `/claims/${claimId}/assessment`,
    {
      visitDate: '2025-07-18T09:00:00.000Z',
      observations: ['Field inspection completed', 'Significant crop damage confirmed'],
      damageArea: 25.0,
      reportText: 'Assessment report...'
    }
  );
  return response.data;
};
```

### 9.4 Insurer Approves/Rejects Claim

**Endpoint:** `PUT /claims/:id/approve` or `PUT /claims/:id/reject` (Insurer only)

**Request:**
```javascript
const approveClaim = async (claimId, payoutAmount) => {
  const response = await apiClient.put(`/claims/${claimId}/approve`, {
    payoutAmount: 500000
  });
  return response.data;
};

const rejectClaim = async (claimId, rejectionReason) => {
  const response = await apiClient.put(`/claims/${claimId}/reject`, {
    rejectionReason: 'Damage not covered under policy terms'
  });
  return response.data;
};
```

---

## 10. Error Handling & Status Codes

### Common HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Validation error or invalid input
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Sowing date must be at least 14 days in the future",
  "error": "Bad Request"
}
```

### Frontend Error Handling

```javascript
const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error
    const status = error.response.status;
    const message = error.response.data?.message || 'An error occurred';
    
    switch (status) {
      case 400:
        // Validation error - show to user
        alert(message);
        break;
      case 401:
        // Unauthorized - redirect to login
        localStorage.removeItem('authToken');
        window.location.href = '/login';
        break;
      case 403:
        // Forbidden - show permission error
        alert('You do not have permission to perform this action');
        break;
      case 404:
        // Not found
        alert('Resource not found');
        break;
      default:
        alert('An error occurred. Please try again.');
    }
  } else {
    // Network error
    alert('Network error. Please check your connection.');
  }
};
```

---

## 11. Quick Reference

### Status Enums

**Farm Status:**
- `PENDING` - Awaiting KML upload
- `REGISTERED` - KML uploaded, EOSDA field created
- `INSURED` - Policy issued

**Assessment Status:**
- `ASSIGNED` - Assessor assigned
- `IN_PROGRESS` - Assessment in progress
- `SUBMITTED` - Report generated, awaiting insurer review
- `APPROVED` - Approved by insurer
- `REJECTED` - Rejected by insurer

**Claim Status:**
- `FILED` - Claim filed by farmer
- `ASSIGNED` - Assessor assigned
- `IN_PROGRESS` - Assessment in progress
- `ASSESSED` - Assessment submitted
- `APPROVED` - Claim approved
- `REJECTED` - Claim rejected

**Crop Monitoring Status:**
- `IN_PROGRESS` - Monitoring in progress
- `COMPLETED` - Report generated and dispatched

### Complete Workflow Summary

```
1. Admin registers users (Farmer, Assessor, Insurer)
2. Users login with phone number and password
3. Farmer registers farm (cropType, sowingDate >= 14 days future)
   → Admin notified
4. Admin views pending farms and assigns assessor
   → Assessor notified
5. Assessor views assigned farms and uploads KML
   → Farm status: REGISTERED, EOSDA field created
6. Assessor performs risk assessment:
   - Fetch field details (EOSDA)
   - Calculate risk score
   - Upload drone PDF (optional)
   - Add comprehensive notes
   - Generate full report
   → Insurer notified
7. Insurer views report and approves/rejects
   → Farmer and assessor notified
8. If approved: Insurer creates policy
9. Assessor performs crop monitoring (max 2 cycles)
   - Start monitoring
   - Update data
   - Generate report
   → Insurer receives report
10. If loss occurs: Farmer files claim
    → Insurer assigns assessor
    → Assessor assesses claim
    → Insurer approves/rejects claim
```

### Key Endpoints Quick Reference

| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `/auth/login` | POST | All | User login |
| `/users` | POST | ADMIN | Register user |
| `/farms/register` | POST | FARMER | Register farm |
| `/assessments/pending-farms` | GET | ADMIN | View pending farms |
| `/assessments/assign` | POST | ADMIN | Assign assessor |
| `/assessments/farmers/list` | GET | ASSESSOR | View assigned farms |
| `/farms/:id/upload-kml` | POST | ASSESSOR | Upload KML file |
| `/assessments/:id/calculate-risk` | POST | ASSESSOR | Calculate risk score |
| `/assessments/:id/upload-drone-pdf` | POST | ASSESSOR | Upload drone PDF |
| `/assessments/:id` | PUT | ASSESSOR | Update assessment |
| `/assessments/:id/generate-report` | POST | ASSESSOR | Generate report |
| `/assessments/:id/approve` | POST | INSURER | Approve assessment |
| `/assessments/:id/reject` | POST | INSURER | Reject assessment |
| `/policies` | POST | INSURER | Create policy |
| `/crop-monitoring/start` | POST | ASSESSOR | Start monitoring |
| `/crop-monitoring/:id/generate-report` | POST | ASSESSOR | Generate monitoring report |
| `/claims` | POST | FARMER | File claim |

---

## Frontend Implementation Tips

### 1. State Management
- Use Redux/Context API to store:
  - Current user (role, userId)
  - Authentication token
  - Current assessment/farm data
  - Notifications

### 2. Role-Based Routing
```javascript
const ProtectedRoute = ({ role, children }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  
  if (!user || user.role !== role) {
    return <Navigate to="/unauthorized" />;
  }
  
  return children;
};

// Usage
<ProtectedRoute role="FARMER">
  <FarmerDashboard />
</ProtectedRoute>
```

### 3. Date Validation
```javascript
const validateSowingDate = (date) => {
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 14);
  
  const selectedDate = new Date(date);
  return selectedDate >= minDate;
};
```

### 4. File Upload Handling
```javascript
const handleFileUpload = async (file, endpoint) => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await apiClient.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        // Update progress bar
        setUploadProgress(percentCompleted);
      },
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};
```

### 5. Real-time Updates (Optional)
- Use WebSockets or polling to check for:
  - New assignments (assessor)
  - New pending farms (admin)
  - Report ready notifications (insurer)

---

## Testing Checklist

### Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Token expiration handling
- [ ] Role-based access control

### Farm Registration
- [ ] Register farm with valid data
- [ ] Validate sowing date (14 days future)
- [ ] Handle validation errors

### Admin Workflow
- [ ] View pending farms
- [ ] Assign assessor to farm
- [ ] Handle duplicate assignment

### Assessor Workflow
- [ ] View assigned farms
- [ ] Upload KML file
- [ ] Calculate risk score
- [ ] Upload drone PDF
- [ ] Add comprehensive notes
- [ ] Generate full report

### Insurer Workflow
- [ ] View pending reports
- [ ] View full report
- [ ] Approve assessment
- [ ] Reject assessment
- [ ] Create policy

### Crop Monitoring
- [ ] Start monitoring (max 2 cycles)
- [ ] Update monitoring data
- [ ] Generate monitoring report

### Claims
- [ ] File claim
- [ ] Assign assessor to claim
- [ ] Update claim assessment
- [ ] Approve/reject claim

---

This workflow guide covers the complete integration from user registration through the entire insurance lifecycle. Follow each step carefully and refer to the error handling section for troubleshooting.



