# AGROmonitoring Registration Endpoint Testing Guide

## New Endpoint Created

### **POST /farms/:id/register-agromonitoring**
- **Purpose:** Register existing farms with AGROmonitoring
- **Access:** ASSESSOR and ADMIN roles only
- **Swagger Documentation:** ✅ Fully documented

## Endpoint Details

### Request
```http
POST /farms/{farmId}/register-agromonitoring
Authorization: Bearer JWT_TOKEN
Content-Type: application/json
```

### Parameters
- **Path Parameter:** `farmId` (string, UUID) - Farm ID to register
- **Headers:** 
  - `Authorization: Bearer JWT_TOKEN` (required)
  - `Content-Type: application/json` (required)

### Response Examples

#### **200 - Success**
```json
{
  "message": "Farm successfully registered with AGROmonitoring",
  "data": {
    "_id": "69a886666c06f12f95ba61e4",
    "farmerId": "6940544a371ce21c672a5b12",
    "name": "MAIZE",
    "area": 73369.8308632053,
    "cropType": "MAIZE",
    "sowingDate": "2026-03-18T00:00:00.000Z",
    "location": {
      "type": "Point",
      "coordinates": [8.789433415151395, 46.718922558287844]
    },
    "boundary": {
      "type": "Polygon",
      "coordinates": [...]
    },
    "status": "REGISTERED",
    "eosdaFieldId": "agro_field_12345",
    "createdAt": "2026-03-04T19:22:37.438Z",
    "updatedAt": "2026-03-06T12:34:56.789Z"
  },
  "success": true
}
```

#### **400 - Bad Request**
```json
{
  "message": "Farm must have boundary geometry to register with AGROmonitoring",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "Farm not found",
  "error": "Not Found",
  "statusCode": 404
}
```

```json
{
  "message": "Farm 69a886666c06f12f95ba61e4 already registered with AGROmonitoring (Field ID: agro_field_12345)",
  "data": {
    // Farm details (no changes made)
  },
  "success": true
}
```

#### **403 - Forbidden**
```json
{
  "message": "User not authorized to register farms with AGROmonitoring",
  "error": "Forbidden",
  "statusCode": 403
}
```

## Testing Cases

### **Test Case 1: Successful Registration**
**Objective:** Register farm without AGROmonitoring field ID

**Request:**
```bash
curl -X POST http://localhost:3000/farms/69a886666c06f12f95ba61e4/register-agromonitoring \
  -H "Authorization: Bearer ASSESSOR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:** 200 with farm data including new `eosdaFieldId`

### **Test Case 2: Farm Not Found**
**Objective:** Test with invalid farm ID

**Request:**
```bash
curl -X POST http://localhost:3000/farms/invalid-farm-id/register-agromonitoring \
  -H "Authorization: Bearer ASSESSOR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:** 404 with "Farm not found" message

### **Test Case 3: Farm Already Registered**
**Objective:** Test farm that already has `eosdaFieldId`

**Request:**
```bash
# First call - should succeed
curl -X POST http://localhost:3000/farms/69a886666c06f12f95ba61e4/register-agromonitoring \
  -H "Authorization: Bearer ASSESSOR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Second call - should return already registered message
curl -X POST http://localhost:3000/farms/69a886666c06f12f95ba61e4/register-agromonitoring \
  -H "Authorization: Bearer ASSESSOR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:** 200 with "already registered" message

### **Test Case 4: Unauthorized Access**
**Objective:** Test with FARMER role (should fail)

**Request:**
```bash
curl -X POST http://localhost:3000/farms/69a886666c06f12f95ba61e4/register-agromonitoring \
  -H "Authorization: Bearer FARMER_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:** 403 with "not authorized" message

### **Test Case 5: Missing Boundary**
**Objective:** Test farm without boundary geometry

**Setup:** Create a farm without boundary in database first

**Request:**
```bash
curl -X POST http://localhost:3000/farms/farm-without-boundary/register-agromonitoring \
  -H "Authorization: Bearer ASSESSOR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:** 400 with "must have boundary geometry" message

## Post-Registration Testing

After successful registration, test weather analytics endpoints:

### **Test Weather Forecast**
```bash
curl -X GET "http://localhost:3000/farms/69a886666c06f12f95ba61e4/weather/forecast?dateStart=2026-03-06&dateEnd=2026-03-13" \
  -H "Authorization: Bearer ANY_JWT_TOKEN"
```

### **Test Historical Weather**
```bash
curl -X GET "http://localhost:3000/farms/69a886666c06f12f95ba61e4/weather/historical?dateStart=2026-02-06&dateEnd=2026-03-06" \
  -H "Authorization: Bearer ANY_JWT_TOKEN"
```

### **Test Accumulated Weather**
```bash
curl -X GET "http://localhost:3000/farms/69a886666c06f12f95ba61e4/weather/accumulated?dateStart=2026-02-06&dateEnd=2026-03-06" \
  -H "Authorization: Bearer ANY_JWT_TOKEN"
```

## Implementation Notes

### **Service Method:** `registerWithAgromonitoring()`
- Validates farm exists
- Checks for boundary geometry
- Creates AGROmonitoring field using existing geometry
- Updates farm with `eosdaFieldId`
- Returns updated farm data

### **Error Handling:**
- Farm not found → 404
- Missing boundary → 400
- AGROmonitoring API errors → 400 with detailed message
- Already registered → Returns existing farm data (no error)

### **Security:**
- Only ASSESSOR and ADMIN roles can access
- JWT authentication required
- Farm ownership validation through existing logic

## Swagger Integration

The endpoint is fully integrated with Swagger/OpenAPI:
- `@ApiTags('Farms')` - Groups with farm endpoints
- `@ApiOperation()` - Detailed descriptions
- `@ApiResponse()` - Documented response schemas
- `@ApiBearerAuth()` - JWT authentication
- Path parameters and status codes documented

## Usage Workflow

1. **Assessor** logs in and gets assigned farms
2. **Assessor** calls `POST /farms/{id}/register-agromonitoring` for farms without `eosdaFieldId`
3. **System** creates AGROmonitoring field and updates farm record
4. **Weather analytics** become available for the farm
5. **All users** can access weather data for registered farms

This completes the AGROmonitoring integration for existing farms!
