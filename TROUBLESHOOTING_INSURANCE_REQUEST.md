# Troubleshooting Insurance Request Error

## Error
```
POST /api/v1/farms/insurance-requests - Duration: 2ms - Error: Bad Request Exception
```

## Common Causes & Solutions

### ✅ 1. Missing `farmId` in Request Body

**Wrong:**
```json
{
  "notes": "Requesting insurance"
}
```

**Correct:**
```json
{
  "farmId": "507f1f77bcf86cd799439011",
  "notes": "Requesting insurance"
}
```

---

### ✅ 2. `farmId` is Not a String

**Wrong:**
```json
{
  "farmId": 123456789,
  "notes": "Requesting insurance"
}
```

**Correct:**
```json
{
  "farmId": "507f1f77bcf86cd799439011",
  "notes": "Requesting insurance"
}
```

---

### ✅ 3. Extra Properties in Request Body

The ValidationPipe is configured with `forbidNonWhitelisted: true`, so any extra properties will cause an error.

**Wrong:**
```json
{
  "farmId": "507f1f77bcf86cd799439011",
  "notes": "Requesting insurance",
  "extraField": "not allowed",
  "anotherField": 123
}
```

**Correct:**
```json
{
  "farmId": "507f1f77bcf86cd799439011",
  "notes": "Requesting insurance"
}
```

---

### ✅ 4. Missing Content-Type Header

**Wrong:**
```
POST /api/v1/farms/insurance-requests
Authorization: Bearer {token}
```

**Correct:**
```
POST /api/v1/farms/insurance-requests
Authorization: Bearer {token}
Content-Type: application/json
```

---

### ✅ 5. Invalid JSON Format

**Wrong:**
```json
{
  "farmId": "507f1f77bcf86cd799439011",
  "notes": "Requesting insurance"
  // Missing comma or closing brace
}
```

**Correct:**
```json
{
  "farmId": "507f1f77bcf86cd799439011",
  "notes": "Requesting insurance"
}
```

---

## Correct Request Format

### cURL Example
```bash
curl -X POST http://localhost:3000/api/v1/farms/insurance-requests \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "farmId": "507f1f77bcf86cd799439011",
    "notes": "Requesting insurance coverage for my maize field"
  }'
```

### Postman Example
- **Method:** POST
- **URL:** `http://localhost:3000/api/v1/farms/insurance-requests`
- **Headers:**
  - `Authorization: Bearer {your_token}`
  - `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "farmId": "507f1f77bcf86cd799439011",
  "notes": "Requesting insurance coverage"
}
```

---

## Validation Rules

The `CreateInsuranceRequestDto` has these validation rules:

1. **farmId** (required):
   - Must be a non-empty string
   - Must exist in the database
   - Must belong to the authenticated farmer

2. **notes** (optional):
   - If provided, must be a string
   - Can be empty or omitted

---

## How to Debug

### 1. Check Request Body
Ensure your request body matches exactly:
```json
{
  "farmId": "your_farm_id_here",
  "notes": "optional notes"
}
```

### 2. Verify Farm ID
Make sure the `farmId` exists and belongs to the logged-in farmer:
```http
GET /api/v1/farms/{farmId}
Authorization: Bearer {token}
```

### 3. Check for Duplicate Requests
If you get "An insurance request already exists", check existing requests:
```http
GET /api/v1/farms/insurance-requests
Authorization: Bearer {token}
```

### 4. Enable Detailed Logging
Add to your request to see detailed validation errors:
```typescript
// In ValidationPipe configuration
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  disableErrorMessages: false, // Enable error messages
  exceptionFactory: (errors) => {
    return new BadRequestException({
      message: 'Validation failed',
      errors: errors,
    });
  },
})
```

---

## Common Error Messages

| Error Message | Cause | Solution |
|--------------|-------|----------|
| `Farm ID is required` | Missing `farmId` | Add `farmId` to request body |
| `Farm ID must be a string` | `farmId` is not a string | Convert to string |
| `Farm does not belong to this farmer` | Wrong farmer | Use farm that belongs to logged-in farmer |
| `Farm not found` | Invalid `farmId` | Verify farm ID exists |
| `An insurance request already exists` | Duplicate request | Check existing requests first |

---

## Test with Minimal Request

Start with the absolute minimum:

```json
{
  "farmId": "your_valid_farm_id"
}
```

Then add optional fields:
```json
{
  "farmId": "your_valid_farm_id",
  "notes": "Optional notes"
}
```

---

## Quick Checklist

- [ ] Request uses POST method
- [ ] URL is correct: `/api/v1/farms/insurance-requests`
- [ ] Authorization header present with valid token
- [ ] Content-Type header is `application/json`
- [ ] Request body is valid JSON
- [ ] `farmId` is present and is a string
- [ ] `farmId` exists in database
- [ ] `farmId` belongs to logged-in farmer
- [ ] No extra properties in request body
- [ ] No duplicate pending request exists

---

*If error persists, check server logs for detailed validation error messages.*

