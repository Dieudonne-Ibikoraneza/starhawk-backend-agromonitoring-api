# EOSDA API - Complete Request/Response Reference
## For Starhawk Insurance Backend

---

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Field Management API](#field-management-api)
4. [Field Analytics API](#field-analytics-api)
5. [Scene Search API](#scene-search-api)
6. [Field Imagery API](#field-imagery-api)
7. [Weather API](#weather-api)
8. [Statistics API (GDW)](#statistics-api-gdw)
9. [Render API](#render-api)
10. [Error Handling](#error-handling)
11. [Rate Limits & Best Practices](#rate-limits--best-practices)

---

## API Overview

### Base URL
```
https://api-connect.eos.com
```

### Authentication Methods
1. **Query Parameter**: `?api_key=<your_api_key>`
2. **Header**: `x-api-key: <your_api_key>`

### Rate Limits
- **Default**: 10 requests per minute
- **Can be increased**: Contact api.support@eosda.com

### Common Response Pattern
Most async endpoints follow a **two-step pattern**:
1. **POST** - Create task → Returns `request_id`
2. **GET** - Poll for results using `request_id`

---

## Authentication

### API Key Location
Your services use **header-based authentication**:

```typescript
// In your EOSDA services
headers: {
  'x-api-key': this.apiKey,
  'Content-Type': 'application/json'
}
```

### Example
```bash
curl --location 'https://api-connect.eos.com/field-management/fields' \
  --header 'x-api-key: your_api_key_here'
```

---

## Field Management API

### 1. Create Field

**Endpoint:** `POST https://api-connect.eos.com/field-management`

**Your Implementation:** `FieldManagementService.createField()`

**Request:**
```typescript
{
  "type": "Feature",
  "properties": {
    "name": "Farm Field A",           // Field name
    "group": "Farmer's Group",        // Optional grouping
    "years_data": [                   // Optional crop history
      {
        "crop_type": "Maize",
        "year": 2024,
        "sowing_date": "2024-03-15"
      }
    ]
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [30.0599, -1.9403],          // [longitude, latitude]
        [30.0599, -1.9453],
        [30.0649, -1.9453],
        [30.0649, -1.9403],
        [30.0599, -1.9403]           // Close polygon
      ]
    ]
  }
}
```

**Response (Success):**
```json
{
  "field_id": "9793351",              // Store this!
  "name": "Farm Field A",
  "area": 30.5,                       // Hectares
  "geometry": {
    "type": "Polygon",
    "coordinates": [...]
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Response (Error):**
```json
{
  "error": "Invalid geometry",
  "message": "Polygon must be closed",
  "statusCode": 400
}
```

**Notes:**
- Coordinates must be in `[longitude, latitude]` order
- Polygon must be closed (first point = last point)
- Maximum area: ~200 sq km (20,000 hectares)
- Your code stores `field_id` as `eosdaFieldId` in MongoDB

---

### 2. Get All Fields

**Endpoint:** `GET https://api-connect.eos.com/field-management/fields`

**Your Implementation:** `FieldManagementService.getAllFields()`

**Request:**
```bash
GET https://api-connect.eos.com/field-management/fields
Headers: x-api-key: your_api_key
```

**Response:**
```json
[
  {
    "field_id": "9793351",
    "name": "Farm Field A",
    "area": 30.5,
    "geometry": { ... },
    "created_at": "2024-01-15T10:30:00Z"
  },
  {
    "field_id": "9793352",
    "name": "Farm Field B",
    "area": 45.2,
    "geometry": { ... },
    "created_at": "2024-01-16T14:20:00Z"
  }
]
```

---

### 3. Get Field by ID

**Endpoint:** `GET https://api-connect.eos.com/field-management/fields/{field_id}`

**Your Implementation:** `FieldManagementService.getFieldById()`

**Request:**
```bash
GET https://api-connect.eos.com/field-management/fields/9793351
Headers: x-api-key: your_api_key
```

**Response:**
```json
{
  "field_id": "9793351",
  "name": "Farm Field A",
  "area": 30.5,
  "geometry": {
    "type": "Polygon",
    "coordinates": [...]
  },
  "properties": {
    "group": "Farmer's Group",
    "years_data": [...]
  },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

---

### 4. Update Field

**Endpoint:** `PUT https://api-connect.eos.com/field-management/fields/{field_id}`

**Your Implementation:** `FieldManagementService.updateField()`

**Request:**
```json
{
  "name": "Updated Farm Field A",
  "properties": {
    "group": "New Group",
    "years_data": [
      {
        "crop_type": "Rice",
        "year": 2024,
        "sowing_date": "2024-04-01"
      }
    ]
  }
}
```

**Response:**
```json
{
  "field_id": "9793351",
  "name": "Updated Farm Field A",
  "area": 30.5,
  "updated_at": "2024-01-20T09:15:00Z"
}
```

---

### 5. Delete Field

**Endpoint:** `DELETE https://api-connect.eos.com/field-management/fields/{field_id}`

**Your Implementation:** `FieldManagementService.deleteField()`

**Request:**
```bash
DELETE https://api-connect.eos.com/field-management/fields/9793351
Headers: x-api-key: your_api_key
```

**Response:**
```
Status: 204 No Content
```

**Response (Field not found):**
```
Status: 400 Bad Request
{
  "error": "Field doesn't exist for this user"
}
```

---

## Field Analytics API

### 1. Get Field Trend (NDVI Over Time)

**Endpoint:** `POST https://api-connect.eos.com/field-analytics/trend/{field_id}`

**Your Implementation:** `FieldAnalyticsService.getFieldTrend()`

**Request (Step 1 - Create Task):**
```json
POST https://api-connect.eos.com/field-analytics/trend/9793351
Headers: 
  x-api-key: your_api_key
  Content-Type: application/json

Body:
{
  "params": {
    "date_start": "2024-01-01",
    "date_end": "2024-06-30",
    "index": "NDVI",                  // NDVI, MSAVI, NDMI, etc.
    "data_source": "S2"               // S2 (Sentinel-2) or S1 (Sentinel-1)
  }
}
```

**Response (Step 1):**
```json
{
  "request_id": "0ef43eb1-b57b-48f2-8b96-c31f366491dc",
  "status": "processing"
}
```

**Request (Step 2 - Get Results):**
```bash
GET https://api-connect.eos.com/field-analytics/trend/9793351/0ef43eb1-b57b-48f2-8b96-c31f366491dc
Headers: x-api-key: your_api_key
```

**Response (Step 2 - Success):**
```json
{
  "status": "success",
  "result": {
    "field_id": "9793351",
    "index": "NDVI",
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-06-30"
    },
    "data": [
      {
        "date": "2024-01-05",
        "value": 0.45,
        "cloud_coverage": 0.15
      },
      {
        "date": "2024-01-10",
        "value": 0.48,
        "cloud_coverage": 0.08
      },
      {
        "date": "2024-01-15",
        "value": 0.52,
        "cloud_coverage": 0.20
      }
      // ... more data points
    ],
    "statistics": {
      "mean": 0.58,
      "min": 0.42,
      "max": 0.72,
      "std_dev": 0.08
    }
  }
}
```

**Response (Step 2 - Still Processing):**
```json
{
  "status": "processing",
  "message": "Task is still being processed"
}
```

**Response (Step 2 - Failed):**
```json
{
  "status": "failed",
  "error": "No data available for the specified date range"
}
```

---

### 2. Get Classification Area

**Endpoint:** `POST https://api-connect.eos.com/classification-area/{field_id}`

**Your Implementation:** `FieldAnalyticsService.getClassificationArea()`

**Request (Step 1):**
```json
{
  "params": {
    "index": "NDVI",
    "view_id": "S2/13/R/EL/2023/5/20/0",  // From scene search
    "data_source": "S2L2A",
    "thresholds": [
      [0.0, 0.3],    // Poor vegetation
      [0.3, 0.6],    // Moderate vegetation
      [0.6, 1.0]     // Healthy vegetation
    ],
    "colors": [
      "FF0000",      // Red for poor
      "FFFF00",      // Yellow for moderate
      "00FF00"       // Green for healthy
    ]
  }
}
```

**Response (Step 1):**
```json
{
  "request_id": "abc123-def456",
  "status": "processing"
}
```

**Response (Step 2):**
```json
{
  "status": "success",
  "result": {
    "field_id": "9793351",
    "view_id": "S2/13/R/EL/2023/5/20/0",
    "date": "2023-05-20",
    "classifications": [
      {
        "class": "Poor vegetation",
        "threshold": [0.0, 0.3],
        "area_hectares": 5.2,
        "percentage": 17.3
      },
      {
        "class": "Moderate vegetation",
        "threshold": [0.3, 0.6],
        "area_hectares": 15.8,
        "percentage": 52.7
      },
      {
        "class": "Healthy vegetation",
        "threshold": [0.6, 1.0],
        "area_hectares": 9.0,
        "percentage": 30.0
      }
    ],
    "total_area": 30.0,
    "image_url": "https://...classified_image.png"
  }
}
```

---

## Scene Search API

### Search Scenes for Field

**Endpoint:** `POST https://api-connect.eos.com/scene-search/for-field/{field_id}`

**Your Implementation:** Used in `FieldImageryService.searchScenes()`

**Request (Step 1):**
```json
POST https://api-connect.eos.com/scene-search/for-field/9793351
Headers:
  x-api-key: your_api_key
  Content-Type: application/json

Body:
{
  "params": {
    "date_start": "2024-01-01",
    "date_end": "2024-06-30",
    "data_source": "S2",              // S2 or S1
    "max_cloud_coverage": 30          // 0-100 percentage
  }
}
```

**Response (Step 1):**
```json
{
  "request_id": "52121212-0cdc-4280-821d-75a2f5aa993f",
  "status": "processing"
}
```

**Request (Step 2):**
```bash
GET https://api-connect.eos.com/scene-search/for-field/9793351/52121212-0cdc-4280-821d-75a2f5aa993f
Headers: x-api-key: your_api_key
```

**Response (Step 2):**
```json
{
  "status": "success",
  "result": [
    {
      "date": "2024-01-05",
      "view_id": "S2/13/R/EL/2024/1/5/0",
      "cloud": 0.12                   // 12% cloud coverage
    },
    {
      "date": "2024-01-10",
      "view_id": "S2/13/R/EL/2024/1/10/0",
      "cloud": 0.08
    },
    {
      "date": "2024-01-15",
      "view_id": "S2/13/R/EL/2024/1/15/0",
      "cloud": 0.25
    }
    // ... more scenes
  ],
  "total_count": 36
}
```

**Note:** Store `view_id` values - they're needed for imagery and classification requests

---

## Field Imagery API

### Get Field Index Image

**Endpoint:** `POST https://api-connect.eos.com/field-imagery/indicies/{field_id}`

**Your Implementation:** `FieldImageryService.getFieldIndexImage()`

**Request (Step 1):**
```json
{
  "params": {
    "view_id": "S2/13/R/EL/2024/1/5/0",  // From scene search
    "index": "NDVI",                      // NDVI, MSAVI, NDMI, RGB, etc.
    "format": "png"                       // png, tiff, jpeg
  }
}
```

**Response (Step 1):**
```json
{
  "request_id": "image-req-123",
  "status": "processing"
}
```

**Request (Step 2):**
```bash
GET https://api-connect.eos.com/field-imagery/indicies/{field_id}/{request_id}
Headers: x-api-key: your_api_key
```

**Response (Step 2):**
```json
{
  "status": "success",
  "result": {
    "field_id": "9793351",
    "view_id": "S2/13/R/EL/2024/1/5/0",
    "index": "NDVI",
    "date": "2024-01-05",
    "format": "png",
    "image_url": "https://api-connect.eos.com/images/ndvi_9793351_20240105.png",
    "statistics": {
      "mean": 0.58,
      "min": 0.35,
      "max": 0.82
    }
  }
}
```

---

## Weather API

### 1. Weather Forecast

**Endpoint:** `POST https://api-connect.eos.com/weather/forecast-high-accuracy/{field_id}`

**Your Implementation:** `WeatherService.getForecast()`

**Request:**
```json
{
  "params": {
    "date_start": "2024-01-20",       // Must be today or future
    "date_end": "2024-02-03"          // Max 14 days ahead
  }
}
```

**Response:**
```json
{
  "field_id": "9793351",
  "forecast": [
    {
      "date": "2024-01-20",
      "time": "00:00:00",
      "temperature": 22,                 // Celsius
      "temperature_min": 18,
      "temperature_max": 26,
      "rainfall": 0,                     // mm
      "humidity": 65,                    // percentage
      "wind_speed": 12,                  // km/h
      "wind_direction": 180,             // degrees
      "cloudiness": 30,                  // percentage
      "pressure": 1013                   // hPa
    },
    {
      "date": "2024-01-20",
      "time": "03:00:00",
      // ... data every 3 hours
    }
    // ... 14 days of 3-hour intervals
  ]
}
```

---

### 2. Historical Weather

**Endpoint:** `POST https://api-connect.eos.com/weather/historical-high-accuracy/{field_id}`

**Your Implementation:** `WeatherService.getHistoricalWeather()`

**Request:**
```json
{
  "params": {
    "date_start": "2023-01-01",
    "date_end": "2023-12-31"
  }
}
```

**Response:**
```json
{
  "field_id": "9793351",
  "historical_data": [
    {
      "date": "2023-01-01",
      "rainfall": 12.5,                  // mm
      "temp_critical": 0,                // days with critical temp
      "temperature_min": 18,             // Celsius
      "temperature_max": 28
    },
    {
      "date": "2023-01-02",
      "rainfall": 0,
      "temp_critical": 0,
      "temperature_min": 19,
      "temperature_max": 29
    }
    // ... daily data for entire range
  ],
  "statistics": {
    "total_rainfall_mm": 1245.8,
    "avg_temperature": 23.5,
    "days_with_rainfall": 145,
    "days_with_critical_temp": 12
  }
}
```

---

### 3. Historical Accumulated Weather

**Endpoint:** `POST https://api-connect.eos.com/weather/historical-accumulated/{field_id}`

**Your Implementation:** `WeatherService.getHistoricalAccumulated()`

**Request:**
```json
{
  "params": {
    "date_start": "2023-03-01",
    "date_end": "2023-09-30",
    "sum_of_active_temperatures": 10   // Base temperature for GDD
  },
  "provider": "weather-online"
}
```

**Response:**
```json
{
  "field_id": "9793351",
  "accumulated_data": {
    "date_start": "2023-03-01",
    "date_end": "2023-09-30",
    "total_rainfall": 487.3,            // mm
    "total_active_temperatures": 2845,  // Growing Degree Days (GDD)
    "average_temperature": 24.2,        // Celsius
    "frost_days": 0,
    "heat_stress_days": 8               // Days > 35°C
  },
  "monthly_breakdown": [
    {
      "month": "2023-03",
      "rainfall": 45.2,
      "active_temperatures": 310,
      "avg_temp": 21.5
    }
    // ... other months
  ]
}
```

---

## Statistics API (GDW)

### Get Multi-Temporal Statistics

**Endpoint:** `POST https://api-connect.eos.com/api/gdw/api`

**Your Implementation:** `StatisticsService.getStatistics()`

**Request (Step 1):**
```json
{
  "type": "mt_stats",
  "params": {
    "bm_type": ["NDVI", "MSAVI"],      // Multiple indices
    "date_start": "2024-01-01",
    "date_end": "2024-06-30",
    "field_id": "9793351",              // Use field_id OR geometry
    // OR use geometry if field_id not available:
    // "geometry": {
    //   "type": "Polygon",
    //   "coordinates": [[...]]
    // },
    "sensors": ["sentinel2"],           // or ["sentinel1"]
    "limit": 100,                       // Max data points
    "exclude_cover_pixels": true,       // Exclude clouds
    "cloud_masking_level": "best"       // Cloud filtering quality
  }
}
```

**Response (Step 1):**
```json
{
  "status": "created",
  "task_id": "00dd1775-4fe4-420f-9ab8-19e967233154",
  "req_id": "4554a79d-7b7c-4515-a94f-7ceeab2417c2",
  "task_timeout": 172800                // 48 hours
}
```

**Request (Step 2):**
```bash
GET https://api-connect.eos.com/api/gdw/api/00dd1775-4fe4-420f-9ab8-19e967233154?api_key=<your_api_key>
```

**Response (Step 2 - Processing):**
```json
{
  "status": "processing",
  "progress": 45                        // Percentage
}
```

**Response (Step 2 - Completed):**
```json
{
  "status": "completed",
  "result": {
    "NDVI": {
      "data": [
        {
          "date": "2024-01-05",
          "mean": 0.52,
          "std_dev": 0.08,
          "min": 0.35,
          "max": 0.68,
          "median": 0.51,
          "cloud_coverage": 0.12
        },
        {
          "date": "2024-01-10",
          "mean": 0.55,
          "std_dev": 0.07,
          "min": 0.38,
          "max": 0.71,
          "median": 0.54,
          "cloud_coverage": 0.08
        }
        // ... more dates
      ],
      "statistics": {
        "overall_mean": 0.58,
        "overall_min": 0.35,
        "overall_max": 0.82,
        "trend": "increasing"           // or "decreasing", "stable"
      }
    },
    "MSAVI": {
      "data": [
        // Similar structure to NDVI
      ],
      "statistics": { ... }
    }
  }
}
```

**Response (Step 2 - Failed):**
```json
{
  "status": "failed",
  "error": "No suitable imagery found for the specified date range"
}
```

---

## Render API

### Render Satellite Image Tile

**Endpoint:** `GET https://api-connect.eos.com/api/render/{scene_path}`

**Your Implementation:** `RenderService.renderImage()`

**Request:**
```bash
GET https://api-connect.eos.com/api/render/S2/36/U/XU/2016/5/2/0/NDVI/10/611/354?api_key=<your_api_key>
```

**Scene Path Format:**
```
{satellite}/{zone}/{latitude_band}/{grid_square}/{year}/{month}/{day}/{index}/NDVI/{zoom}/{x}/{y}
```

**Example:**
- Satellite: S2 (Sentinel-2)
- Zone: 36
- Latitude Band: U
- Grid Square: XU
- Date: 2016-05-02
- Index: NDVI
- Tile: zoom=10, x=611, y=354

**Response:**
```
Content-Type: image/png
Binary image data (PNG tile)
```

**Use Case:**
Display satellite imagery on map interface (Leaflet, Mapbox)

---

## Error Handling

### Common Error Responses

#### 1. Invalid API Key
```json
{
  "error": "Unauthorized",
  "message": "Invalid API key",
  "statusCode": 401
}
```

#### 2. Rate Limit Exceeded
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please wait before making more requests.",
  "statusCode": 429,
  "retry_after": 60                     // Seconds
}
```

#### 3. Invalid Request
```json
{
  "error": "Bad Request",
  "message": "Invalid date format. Expected YYYY-MM-DD",
  "statusCode": 400
}
```

#### 4. Field Not Found
```json
{
  "error": "Not Found",
  "message": "Field with ID 9793351 not found",
  "statusCode": 404
}
```

#### 5. No Data Available
```json
{
  "error": "No Data",
  "message": "No satellite imagery available for the specified date range",
  "statusCode": 404
}
```

#### 6. Task Timeout
```json
{
  "status": "timeout",
  "message": "Task processing exceeded maximum time limit",
  "task_id": "00dd1775-4fe4-420f-9ab8-19e967233154"
}
```

---

## Rate Limits & Best Practices

### Rate Limits

| Endpoint Type | Default Limit | Can Increase? |
|---------------|---------------|---------------|
| Field Management | 10/min | Yes |
| Analytics | 10/min | Yes |
| Weather | 10/min | Yes |
| Statistics (GDW) | 10/min | Yes |
| Imagery | 10/min | Yes |

### Request Optimization

#### 1. **Batch Date Ranges**
```typescript
// GOOD: Single request for 6 months
{
  date_start: "2024-01-01",
  date_end: "2024-06-30"
}

// BAD: Multiple requests for each month
// Makes 6 requests instead of 1
```

#### 2. **Use field_id When Available**
```typescript
// GOOD: Use field_id (faster, cached)
{
  "field_id": "9793351"
}

// FALLBACK: Use geometry (slower)
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [...]
  }
}
```

#### 3. **Cache Responses**
```typescript
// Your implementation should cache:
// - Historical data: 30+ days
// - Field boundaries: Until updated
// - Weather forecast: 6 hours
// - Statistics: 24 hours
```

#### 4. **Poll Efficiently**
```typescript
// GOOD: Exponential backoff
async function pollTask(taskId: string) {
  let delay = 2000; // Start with 2 seconds
  
  for (let i = 0; i < 10; i++) {
    const result = await checkTask(taskId);
    
    if (result.status === 'completed') {
      return result;
    }
    
    await sleep(delay);
    delay = Math.min(delay * 1.5, 30000); // Max 30 seconds
  }
}

// BAD: Fixed 1-second polling
// Makes too many requests
```

#### 5. **Request Only What You Need**
```typescript
// GOOD: Specific indices
{
  "bm_type": ["NDVI"]  // Only what you need
}

// BAD: All indices
{
  "bm_type": ["NDVI", "MSAVI", "NDMI", "EVI", ...]  // Wastes quota
}
```

---

## Your Implementation Mapping

### How Your Services Use These APIs

```typescript
// 1. Field Management Service
FieldManagementService {
  createField()      → POST /field-management
  getAllFields()     → GET /field-management/fields
  getFieldById()     → GET /field-management/fields/{id}
  updateField()      → PUT /field-management/fields/{id}
  deleteField()      → DELETE /field-management/fields/{id}
}

// 2. Field Analytics Service
FieldAnalyticsService {
  getFieldTrend()           → POST /field-analytics/trend/{id}
  getClassificationArea()   → POST /classification-area/{id}
}

// 3. Weather Service
WeatherService {
  getForecast()               → POST /weather/forecast-high-accuracy/{id}
  getHistoricalWeather()      → POST /weather/historical-high-accuracy/{id}
  getHistoricalAccumulated()  → POST /weather/historical-accumulated/{id}
}

// 4. Statistics Service
StatisticsService {
  getStatistics()    → POST /api/gdw/api (mt_stats)
}

// 5. Field Imagery Service
FieldImageryService {
  searchScenes()         → POST /scene-search/for-field/{id}
  getFieldIndexImage()   → POST /field-imagery/indicies/{id}
}

// 6. Render Service
RenderService {
  renderImage()      → GET /api/render/{scene_path}
}
```

---

## Complete Workflow Examples

### Example 1: Risk Assessment Flow

```typescript
// Step 1: Get historical NDVI (3 years)
const ndviStats = await statisticsService.getStatistics({
  field_id: "9793351",
  indices: ["NDVI"],
  date_start: "2021-01-01",
  date_end: "2023-12-31"
});

// Step 2: Get historical weather (3 years)
const weatherData = await weatherService.getHistoricalWeather({
  field_id: "9793351",
  date_start: "2021-01-01",
  date_end: "2023-12-31"
});

// Step 3: Calculate risk score
const riskScore = calculateRisk(ndviStats, weatherData);

// Step 4: Store in MongoDB
await riskAssessmentRepository.save({
  farmId: farm._id,
  riskScore,
  ndviHistory: ndviStats,
  weatherRisk: weatherData,
  status: "COMPLETED"
});
```

---

### Example 2: Claims Verification Flow

```typescript
// Step 1: Get NDVI before event (2 weeks before)
const preEventNdvi = await statisticsService.getStatistics({
  field_id: "9793351",
  indices: ["NDVI"],
  date_start: claimDate.subtract(14, 'days'),
  date_end: claimDate.subtract(1, 'day')
});

// Step 2: Get NDVI after event (2 weeks after)
const postEventNdvi = await statisticsService.getStatistics({
  field_id: "9793351",
  indices: ["NDVI"],
  date_start: claimDate.add(1, 'day'),
  date_end: claimDate.add(14, 'days')
});

// Step 3: Get weather during event
const weatherEvent = await weatherService.getHistoricalWeather({
  field_id: "9793351",
  date_start: claimDate.subtract(2, 'days'),
  date_end: claimDate.add(2, 'days')
});

// Step 4: Calculate damage
const damagePercentage = calculateDamage(preEventNdvi, postEventNdvi);

// Step 5: Verify weather event
const eventVerified = verifyWeatherEvent(weatherEvent, claim.eventType);

// Step 6: Update claim
await claimRepository.update(claimId, {
  damageAssessment: {
    preEventNdvi: preEventNdvi.result.NDVI.statistics.overall_mean,
    postEventNdvi: postEventNdvi.result.NDVI.statistics.overall_mean,
    damagePercentage,
    weatherVerified: eventVerified,
    assessmentDate: new Date()
  }
});
```

---

### Example 3: Ongoing Monitoring Flow

```typescript
// Runs daily via cron job
async function monitorFields() {
  const activeFields = await farmRepository.findActive();
  
  for (const field of activeFields) {
    // Get current NDVI (last 7 days)
    const currentNdvi = await statisticsService.getStatistics({
      field_id: field.eosdaFieldId,
      indices: ["NDVI"],
      date_start: today.subtract(7, 'days'),
      date_end: today
    });
    
    // Get baseline (same period last year)
    const baselineNdvi = await statisticsService.getStatistics({
      field_id: field.eosdaFieldId,
      indices: ["NDVI"],
      date_start: today.subtract(1, 'year').subtract(7, 'days'),
      date_end: today.subtract(1, 'year')
    });
    
    // Detect anomaly
    const drop = calculateNdviDrop(currentNdvi, baselineNdvi);
    
    if (drop > 20) {
      // Create alert
      await alertRepository.create({
        farmId: field._id,
        type: "VEGETATION_STRESS",
        severity: drop > 40 ? "HIGH" : "MEDIUM",
        message: `NDVI dropped by ${drop}% compared to baseline`,
        detectedAt: new Date()
      });
      
      // Send notification
      await emailService.sendAlert(field.owner, alert);
    }
  }
}
```

---

## Quick Reference Card

### Most Used Endpoints

```typescript
// 1. Create Field
POST /field-management
Body: { type: "Feature", geometry: {...}, properties: {...} }
→ Returns: { field_id }

// 2. Get NDVI Statistics
POST /api/gdw/api
Body: { type: "mt_stats", params: { field_id, bm_type: ["NDVI"], date_start, date_end } }
→ Returns: { task_id }
GET /api/gdw/api/{task_id}
→ Returns: { status, result: { NDVI: { data: [...], statistics: {...} } } }

// 3. Get Weather Forecast
POST /weather/forecast-high-accuracy/{field_id}
Body: { params: { date_start, date_end } }
→ Returns: { forecast: [...] }

// 4. Search Scenes
POST /scene-search/for-field/{field_id}
Body: { params: { date_start, date_end, max_cloud_coverage } }
→ Returns: { request_id }
GET /scene-search/for-field/{field_id}/{request_id}
→ Returns: { result: [{ date, view_id, cloud }] }
```

---

## Testing Your Integration

### Test Script

```typescript
// test-eosda-integration.ts

async function testEosdaIntegration() {
  const testFieldId = "9793351"; // Replace with your field
  
  console.log("1. Testing Field Management...");
  const fields = await eosdaService.fieldManagement.getAllFields();
  console.log(`✓ Found ${fields.length} fields`);
  
  console.log("2. Testing NDVI Statistics...");
  const ndvi = await eosdaService.statistics.getStatistics({
    field_id: testFieldId,
    indices: ["NDVI"],
    date_start: "2024-01-01",
    date_end: "2024-01-31"
  });
  console.log(`✓ NDVI data points: ${ndvi.result.NDVI.data.length}`);
  
  console.log("3. Testing Weather Forecast...");
  const forecast = await eosdaService.weather.getForecast({
    field_id: testFieldId,
    date_start: "2024-01-20",
    date_end: "2024-02-03"
  });
  console.log(`✓ Forecast days: ${forecast.forecast.length}`);
  
  console.log("4. Testing Scene Search...");
  const scenes = await eosdaService.fieldImagery.searchScenes({
    field_id: testFieldId,
    date_start: "2024-01-01",
    date_end: "2024-01-31",
    max_cloud_coverage: 30
  });
  console.log(`✓ Available scenes: ${scenes.result.length}`);
  
  console.log("\n✓ All tests passed!");
}
```

---

## Summary

This document provides the **complete EOSDA API request-response format** for all endpoints used in your Starhawk backend:

✅ **Field Management** - Create, read, update, delete fields  
✅ **Field Analytics** - NDVI trends, classification areas  
✅ **Scene Search** - Find available satellite imagery  
✅ **Field Imagery** - Get processed index images  
✅ **Weather API** - Forecast, historical, accumulated  
✅ **Statistics API** - Multi-temporal index statistics  
✅ **Render API** - Render map tiles  

**Your implementation uses these patterns:**
- Header-based authentication (`x-api-key`)
- Two-step async pattern (task creation → polling)
- Smart fallback (field_id → geometry)
- Proper error handling
- Rate limit compliance

**Keep this reference handy when:**
- Building new features
- Debugging API issues
- Optimizing requests
- Training new developers

---

*Last Updated: November 2025*  
*For: Starhawk Insurance Backend*  
*EOSDA API Version: Latest*
