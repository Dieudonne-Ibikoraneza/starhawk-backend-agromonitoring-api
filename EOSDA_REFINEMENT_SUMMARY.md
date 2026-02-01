# EOSDA API Refinement Summary

## Overview
All EOSDA services have been refined to match the official API documentation exactly. The implementation now uses:
- ✅ Correct endpoints per documentation
- ✅ Async 2-step pattern with polling (exponential backoff)
- ✅ Rate limit handling with retry logic
- ✅ Proper request/response formats

---

## Changes by Service

### 1. **Base Service** (`eosda-base.service.ts`)
**Added:**
- ✅ `pollAsyncTask()` - Exponential backoff polling for async operations
- ✅ `makeRequestWithRetry()` - Automatic retry on 429 (rate limit) errors
- ✅ `AsyncTaskResponse` interface for async task handling
- ✅ `sleep()` utility for delays

**Improvements:**
- Automatic retry on rate limit errors (429) with exponential backoff
- Polling with exponential backoff (starts at 2s, max 30s)
- Better error handling and logging

---

### 2. **Field Management Service** (`field-management.service.ts`)
**Fixed Endpoints:**
- ✅ `POST /field-management` → ✅ **Correct** (unchanged)
- ✅ `GET /field-management/fields` → **NEW** `getAllFields()`
- ✅ `GET /field-management/fields/{field_id}` → **NEW** `getFieldById()`
- ✅ `PUT /field-management/fields/{field_id}` → **Fixed** (was `/field-management/{id}`)
- ✅ `DELETE /field-management/fields/{field_id}` → **Fixed** (was `/field-management/{id}`)

**Backward Compatibility:**
- ✅ `getField()` → Redirects to `getFieldById()`
- ✅ `listFields()` → Redirects to `getAllFields()`

---

### 3. **Field Analytics Service** (`field-analytics.service.ts`)
**Major Refactor:**
- ✅ Implemented async 2-step pattern:
  1. `POST /field-analytics/trend/{field_id}` → Get `request_id`
  2. `GET /field-analytics/trend/{field_id}/{request_id}` → Poll for results

**New Methods:**
- ✅ `getFieldTrend()` - NDVI/indices trend over time (async with polling)
- ✅ `getClassificationArea()` - Classification area analysis (async with polling)

**Legacy Methods (Deprecated but working):**
- ⚠️ `getNDVITimeSeries()` → Uses `getFieldTrend()` internally
- ⚠️ `getAnalytics()` → Uses `getFieldTrend()` internally
- ⚠️ `getCurrentIndices()` → Uses `getFieldTrend()` internally

**Request Format:**
```typescript
{
  fieldId: string;
  dateStart: string; // YYYY-MM-DD
  dateEnd: string; // YYYY-MM-DD
  index?: 'NDVI' | 'MSAVI' | 'NDMI' | 'EVI';
  dataSource?: 'S2' | 'S1';
}
```

---

### 4. **Statistics Service** (`statistics.service.ts`)
**Complete Rewrite:**
- ✅ Uses GDW API: `POST /api/gdw/api` with `type: "mt_stats"`
- ✅ Async 2-step pattern:
  1. `POST /api/gdw/api` → Get `task_id`
  2. `GET /api/gdw/api/{task_id}?api_key=...` → Poll for results

**New Implementation:**
```typescript
async getStatistics(request: StatisticsRequest): Promise<StatisticsResponse>
```

**Supports:**
- ✅ Multiple indices: `['NDVI', 'MSAVI', 'NDMI', 'EVI']`
- ✅ Field ID OR geometry (field_id is faster)
- ✅ Cloud masking: `exclude_cover_pixels`, `cloud_masking_level`
- ✅ Sensor selection: `['sentinel2']` or `['sentinel1']`

**Legacy Methods:**
- ⚠️ `getNDVITimeSeries()` → Uses `getStatistics()` internally
- ⚠️ `getVegetationIndices()` → Uses `getStatistics()` internally

---

### 5. **Weather Service** (`weather.service.ts`)
**Fixed Endpoints:**
- ✅ `POST /weather/forecast-high-accuracy/{field_id}` → **NEW** `getForecast()`
- ✅ `POST /weather/historical-high-accuracy/{field_id}` → **NEW** `getHistoricalWeather()`
- ✅ `POST /weather/historical-accumulated/{field_id}` → **NEW** `getHistoricalAccumulated()`

**Breaking Changes:**
- ⚠️ **All weather methods now require `fieldId`** (not geometry)
- ⚠️ Legacy methods (`getCurrentWeather`, `getWeatherForecast`) are deprecated

**New Request Format:**
```typescript
// Forecast
{
  fieldId: string;
  dateStart: string; // Must be today or future
  dateEnd: string; // Max 14 days ahead
}

// Historical
{
  fieldId: string;
  dateStart: string;
  dateEnd: string;
}
```

**Response Format:**
- Forecast: 3-hour intervals
- Historical: Daily data with statistics
- Accumulated: GDD, total rainfall, etc.

---

### 6. **Field Imagery Service** (`field-imagery.service.ts`)
**Major Refactor:**
- ✅ Scene Search: `POST /scene-search/for-field/{field_id}` (2-step async)
- ✅ Index Image: `POST /field-imagery/indicies/{field_id}` (2-step async)

**New Methods:**
- ✅ `searchScenes()` - Search for available satellite imagery
- ✅ `getFieldIndexImage()` - Get processed index image (requires `view_id`)

**Workflow:**
1. Call `searchScenes()` → Get array of scenes with `view_id`
2. Use `view_id` in `getFieldIndexImage()` → Get image URL

**Response Format:**
```typescript
// Scene Search Result
{
  status: 'success';
  result: [
    {
      date: '2024-01-05',
      view_id: 'S2/13/R/EL/2024/1/5/0', // Store this!
      cloud: 0.12 // 12%
    }
  ];
  total_count: 36;
}
```

**Legacy Methods:**
- ⚠️ `searchImagery()` → Uses `searchScenes()` internally
- ⚠️ `getImageryComparison()` → Uses `searchScenes()` + `getFieldIndexImage()`

---

### 7. **Render Service** (`render.service.ts`)
**Fixed Endpoint:**
- ✅ `GET /api/render/{scene_path}?api_key=...` → **NEW** `renderImage()`

**New Implementation:**
```typescript
async renderImage(request: { scenePath: string }): Promise<RenderImageResponse>
```

**Scene Path Format:**
```
S2/36/U/XU/2016/5/2/0/NDVI/10/611/354
{satellite}/{zone}/{band}/{square}/{year}/{month}/{day}/{index}/{indexType}/{zoom}/{x}/{y}
```

**Helper Methods:**
- ✅ `buildScenePath()` - Build path from components
- ✅ `parseScenePath()` - Parse path into components

**Breaking Changes:**
- ⚠️ Legacy methods (`renderMap`, `renderNDVI`) are deprecated
- ⚠️ Requires `scenePath` (get from `searchScenes()` result `view_id`)

---

## Key Improvements

### 1. **Async Task Handling**
All async endpoints now use proper 2-step pattern:
```typescript
// Step 1: Create task
const task = await service.createTask(params);
const taskId = task.request_id; // or task.task_id

// Step 2: Poll for results (automatic)
const result = await service.pollAsyncTask(() => 
  service.checkTask(taskId)
);
```

### 2. **Rate Limit Handling**
Automatic retry on 429 errors:
- Max 3 retries
- 6 second delay (60s / 10 req/min)
- Exponential backoff

### 3. **Polling Strategy**
Exponential backoff polling:
- Starts at 2 seconds
- Increases by 1.5x each attempt
- Max delay: 30 seconds
- Max attempts: 15 (20 for GDW)

### 4. **Error Handling**
- Better error messages
- Proper status code handling
- Detailed logging for debugging

---

## Migration Guide

### For Field Management:
```typescript
// Old (deprecated)
const field = await eosdaService.fieldManagement.getField(fieldId);

// New (recommended)
const field = await eosdaService.fieldManagement.getFieldById(fieldId);
```

### For Analytics:
```typescript
// Old (still works but deprecated)
const analytics = await eosdaService.fieldAnalytics.getNDVITimeSeries({
  fieldId: '123',
  startDate: '2024-01-01',
  endDate: '2024-06-30',
});

// New (recommended)
const trend = await eosdaService.fieldAnalytics.getFieldTrend({
  fieldId: '123',
  dateStart: '2024-01-01',
  dateEnd: '2024-06-30',
  index: 'NDVI',
  dataSource: 'S2',
});
```

### For Statistics:
```typescript
// Old (still works but deprecated)
const stats = await eosdaService.statistics.getNDVITimeSeries({
  fieldId: '123',
  startDate: '2024-01-01',
  endDate: '2024-06-30',
});

// New (recommended)
const stats = await eosdaService.statistics.getStatistics({
  fieldId: '123',
  startDate: '2024-01-01',
  endDate: '2024-06-30',
  indices: ['NDVI', 'MSAVI'],
  sensors: ['sentinel2'],
});
```

### For Weather:
```typescript
// Old (deprecated - requires fieldId now)
const weather = await eosdaService.weather.getForecast({
  geometry: { ... },
  days: 7,
});

// New (recommended)
const forecast = await eosdaService.weather.getForecast({
  fieldId: '123', // Must create field first!
  dateStart: '2024-01-20',
  dateEnd: '2024-02-03', // Max 14 days
});
```

### For Imagery:
```typescript
// Old (still works but deprecated)
const imagery = await eosdaService.fieldImagery.searchImagery({
  fieldId: '123',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
});

// New (recommended)
const scenes = await eosdaService.fieldImagery.searchScenes({
  fieldId: '123',
  dateStart: '2024-01-01',
  dateEnd: '2024-01-31',
  maxCloudCoverage: 30,
  dataSource: 'S2',
});

// Use view_id from scenes
const image = await eosdaService.fieldImagery.getFieldIndexImage({
  fieldId: '123',
  viewId: scenes.result[0].view_id,
  index: 'NDVI',
});
```

### For Render:
```typescript
// Old (deprecated)
const render = await eosdaService.render.renderNDVI({
  fieldId: '123',
  date: '2024-01-05',
});

// New (recommended)
// 1. Get scene path from searchScenes
const scenes = await eosdaService.fieldImagery.searchScenes({...});
const viewId = scenes.result[0].view_id; // e.g., "S2/13/R/EL/2024/1/5/0"

// 2. Build scene path for render (extract from view_id or use helper)
const scenePath = eosdaService.render.buildScenePath({
  satellite: 'S2',
  zone: '13',
  latitudeBand: 'R',
  gridSquare: 'EL',
  year: 2024,
  month: 1,
  day: 5,
  indexType: 'NDVI',
  zoom: 10,
  x: 611,
  y: 354,
});

// 3. Render
const image = await eosdaService.render.renderImage({ scenePath });
```

---

## Best Practices

### 1. **Use field_id When Available**
```typescript
// ✅ FAST - Uses cached field_id
{ field_id: "9793351" }

// ⚠️ SLOW - Sends geometry every time
{ geometry: { ... } }
```

### 2. **Batch Date Ranges**
```typescript
// ✅ GOOD - Single request for 6 months
{
  date_start: "2024-01-01",
  date_end: "2024-06-30"
}

// ⚠️ BAD - Multiple requests for each month
// Makes 6 requests instead of 1
```

### 3. **Request Only What You Need**
```typescript
// ✅ GOOD - Only NDVI
{
  bm_type: ["NDVI"]
}

// ⚠️ BAD - All indices (wastes quota)
{
  bm_type: ["NDVI", "MSAVI", "NDMI", "EVI", ...]
}
```

### 4. **Handle Async Tasks Properly**
```typescript
// ✅ GOOD - Uses built-in polling
const result = await service.getFieldTrend({ ... });
// Polling is automatic with exponential backoff

// ⚠️ BAD - Manual polling
while (true) {
  const status = await checkTask(id);
  if (status === 'completed') break;
  await sleep(1000); // Too frequent!
}
```

---

## Testing

All services maintain backward compatibility where possible. Legacy methods are deprecated but still work. Test with:

```typescript
// Test new methods
const trend = await eosdaService.fieldAnalytics.getFieldTrend({...});
const stats = await eosdaService.statistics.getStatistics({...});
const forecast = await eosdaService.weather.getForecast({...});

// Test legacy methods (should still work)
const analytics = await eosdaService.fieldAnalytics.getNDVITimeSeries({...});
```

---

## Summary

✅ **All 7 services refined** to match official documentation  
✅ **Async 2-step pattern** implemented with polling  
✅ **Rate limit handling** with automatic retry  
✅ **Exponential backoff** polling strategy  
✅ **Backward compatibility** maintained where possible  
✅ **Better error handling** and logging  

**Next Steps:**
1. Test all services with real EOSDA API
2. Update any code that uses deprecated methods
3. Consider adding response caching (Redis/Memory)
4. Monitor rate limits in production

---

*Refined: November 2025*  
*For: Starhawk Insurance Backend*

