# Starhawk Backend - Complete System Documentation

## Overview

Starhawk Backend is a comprehensive REST API for an agricultural insurance management system specifically designed for Rwanda. The system supports multi-role user management with NIDA (National Identification Agency) integration, JWT-based authentication, and role-specific profiling.

**Technology Stack:**
- Java 21
- Spring Boot 3.5.6
- PostgreSQL 12+
- Spring Security with JWT
- Spring Cloud OpenFeign (for NIDA integration)
- Flyway (database migrations)
- Spring Boot Mail (email notifications)
- OpenAPI/Swagger (API documentation)

---

## Core Business Domain

### 1. User Roles

The system supports five distinct user roles:

1. **ADMIN**: System administrators with full access
2. **INSURER**: Insurance companies
3. **ASSESSOR**: Field assessors for claim evaluation
4. **FARMER**: Agricultural producers (end users)
5. **GOVERNMENT**: Government officials

### 2. User Management

#### User Entity Structure

```java
User {
    // Identity
    UUID id (Primary Key)
    String firstName (from NIDA)
    String lastName (from NIDA)
    String email (unique)
    String phoneNumber (unique, 10 digits, Rwanda format)
    String nationalId (unique, 16 digits)
    
    // Authentication & Authorization
    String password (BCrypt hashed)
    Role role (ADMIN, INSURER, ASSESSOR, FARMER, GOVERNMENT)
    
    // Account Status
    boolean active (default: true)
    boolean firstLoginRequired (default: true)
    
    // Location Data (from NIDA)
    String province
    String district
    String sector
    String cell
    String village
    String sex (Male/Female from NIDA)
    
    // Timestamps
    LocalDateTime createdAt (auto-generated)
    LocalDateTime updatedAt (auto-updated)
}
```

#### User Registration Flow

**Endpoint:** `POST /api/v1/auth/register` (Admin only)

**Process:**
1. **Validation Phase:**
   - Validate National ID format (16 digits, Rwanda-specific format)
   - Validate phone number (starts with 072, 073, 078, or 079)
   - Validate email format
   - Check uniqueness of nationalId, email, and phoneNumber
   - Validate role against enum

2. **NIDA Integration:**
   - Call external NIDA API with nationalId
   - Validate response (status 200 and data not null)
   - Extract demographic information:
     - foreName → firstName
     - surnames → lastName
     - province, district, sector, cell, village
     - sex

3. **User Creation:**
   - Generate secure random password (12 characters, mixed alphanumeric + special)
   - Hash password using BCrypt
   - Create User entity with NIDA data
   - Set role-specific flags
   - Save to database

4. **Profile Creation:**
   - Based on role, create corresponding profile:
     - **FARMER**: Create FarmerProfile
     - **ASSESSOR**: Create AssessorProfile
     - **INSURER**: Create InsurerProfile
     - **ADMIN/GOVERNMENT**: No additional profile

5. **Welcome Email:**
   - Send email to new user with credentials
   - Include: firstName, phoneNumber, generated password
   - Note: Registration succeeds even if email fails

#### User Authentication Flow

**Endpoint:** `POST /api/v1/auth/login`

**Process:**
1. **Receive Credentials:**
   - phoneNumber (username)
   - password

2. **Validation:**
   - Find user by phoneNumber
   - Check if account is active
   - Authenticate using Spring Security's AuthenticationManager

3. **Token Generation:**
   - Extract username (phoneNumber) from authenticated user
   - Build JWT claims:
     - userId: User UUID
     - role: User role
   - Set expiration (configurable, default 24 hours)
   - Sign with HS256 algorithm using base64-encoded secret

4. **Response:**
   - Return JWT token
   - Include user details (id, role, email, phoneNumber, firstLoginRequired)

#### Profile Management

**User Profile Retrieval:**
- **Endpoint:** `GET /api/v1/auth/profile`
- **Access:** Authenticated users (own profile)
- **Response:** Complete user info + role-specific profile details

**Profile Update:**
- **Endpoint:** `PUT /api/v1/auth/profile`
- **Access:** Authenticated users (own profile)
- **Role-Specific Updates:**
  - **Farmer**: Farm location details (farmProvince, farmDistrict, farmSector, farmCell, farmVillage)
  - **Assessor**: Specialization, experience, bio, photo, address
  - **Insurer**: Company details, license, registration info

**Admin User Management:**
- **List All Users:** `GET /api/v1/users` (paginated)
- **Get User by ID:** `GET /api/v1/users/{userId}`
- **Update User:** `PUT /api/v1/users/{userId}` (can change role, email, status)
- **Deactivate User:** `PUT /api/v1/users/{userId}/deactivate`

### 3. Role-Specific Profiles

#### Farmer Profile

```java
FarmerProfile {
    UUID id (Primary Key)
    UUID userId (Foreign Key → users.id, One-to-One)
    
    // Farm Location
    String farmProvince
    String farmDistrict
    String farmSector
    String farmCell
    String farmVillage
    
    LocalDateTime createdAt
    LocalDateTime updatedAt
}
```

**Business Logic:**
- Automatically created during user registration with FARMER role
- Tracks farm location separately from residential location
- Used for insurance policy underwriting and claim assessment

#### Assessor Profile

```java
AssessorProfile {
    UUID id (Primary Key)
    UUID userId (Foreign Key → users.id, One-to-One)
    
    // Professional Details
    String specialization (TEXT)
    Integer experienceYears
    String profilePhotoUrl
    String bio (TEXT)
    String address (TEXT)
    
    LocalDateTime createdAt
    LocalDateTime updatedAt
}
```

**Business Logic:**
- Created during registration with ASSESSOR role
- Stores professional credentials for claim assessment
- Used to match assessors with appropriate claims
- Bio field allows detailed professional background

#### Insurer Profile

```java
InsurerProfile {
    UUID id (Primary Key)
    UUID userId (Foreign Key → users.id, One-to-One)
    
    // Company Details
    String companyName
    String contactPerson
    String website
    String address (TEXT)
    String companyDescription (TEXT)
    String licenseNumber
    LocalDate registrationDate
    String companyLogoUrl
    
    LocalDateTime createdAt
    LocalDateTime updatedAt
}
```

**Business Logic:**
- Created during registration with INSURER role
- Stores insurance company information
- License number and registration date for regulatory compliance
- Used for policy management and company verification

### 4. NIDA Integration

**Purpose:** Validate national identity and retrieve demographic data

**Integration Details:**
- **Service:** External NIDA API
- **Base URL:** `https://prod.safaribus.rw/nxreporting/nida`
- **Endpoint:** `POST /document`
- **Client:** Spring Cloud OpenFeign

**Request:**
```java
DocumentRequest {
    String document_number (National ID)
}
```

**Response:**
```java
NidaResponse {
    int status (HTTP status code)
    String message
    String timestamp
    DocumentResponse data
}

DocumentResponse {
    String village
    String cell
    String sector
    String district
    String province
    String sex (7=Female, 8=Male)
    String foreName
    String surnames
}
```

**Business Rules:**
- National ID must exist in NIDA database
- Response must have status 200
- Data fields must not be empty
- Used ONLY during registration (not during updates)
- NIDA data becomes the source of truth for identity fields

**Error Handling:**
- Invalid National ID → BadRequestException
- NIDA service unavailable → BadRequestException
- Empty response data → BadRequestException

### 5. Authentication & Authorization

#### JWT (JSON Web Token) Authentication

**Token Structure:**
- **Header:** `{"alg": "HS256", "typ": "JWT"}`
- **Payload:**
  - userId: User UUID
  - role: User role
  - sub: phoneNumber (subject)
  - iat: Issued at timestamp
  - exp: Expiration timestamp
- **Signature:** HMAC-SHA256 with base64-encoded secret key

**Configuration:**
- Secret: Base64-encoded string (256-bit minimum)
- Expiration: Configurable (default 86400000 ms = 24 hours)
- Algorithm: HS256

**Token Validation:**
1. Extract from "Authorization: Bearer {token}" header
2. Verify signature using secret key
3. Check expiration (exp claim)
4. Extract username (phoneNumber)
5. Load user details from database
6. Validate token subject matches loaded username
7. Set Spring Security authentication context

#### Security Configuration

**Public Endpoints:**
- `POST /api/v1/auth/login`
- `/swagger-ui/**` (API documentation)
- `/v3/api-docs/**` (OpenAPI spec)
- `/actuator/health` (health checks)

**Protected Endpoints:**
- `/api/v1/users/**` (Admin only)
- `/api/v1/auth/profile` (Authenticated users)
- All other endpoints require authentication

**Authorization:**
- Role-based access control (RBAC)
- Spring Security method-level security (`@PreAuthorize`)
- Role format: `ROLE_{ROLE_NAME}` (e.g., `ROLE_ADMIN`)

**Password Security:**
- BCrypt hashing with automatic salt generation
- Cost factor: 10 (configurable)
- One-way hashing (cannot be reversed)

#### Security Filter Chain

1. **JwtAuthenticationFilter:** Extracts and validates JWT tokens
2. **DaoAuthenticationProvider:** Handles username/password authentication
3. **CustomUserDetailsService:** Loads user details for authentication
4. **SecurityExceptionHandler:** Handles authentication/authorization exceptions

### 6. Data Validation

#### Rwanda National ID Validator

**Format:** `GYYYY#NNNNNNNIFCC` (16 digits)

**Components:**
1. **G (National Identifier):** Single digit
   - 1 = Rwandan citizen
   - 2 = Refugee
   - 3 = Foreigner

2. **YYYY (Year of Birth):** 4 digits
   - Must result in age 16-120 at issuance
   - Current year validation

3. **# (Gender Identifier):** Single digit
   - 8 = Male
   - 7 = Female

4. **NNNNNNN (Birth Order):** 7 digits
   - Sequential number for same year/gender
   - Cannot be all zeros

5. **I (Issue Frequency):** Single digit
   - 0 = First issuance
   - 1-9 = Replacement number

6. **CC (Security Code):** 2 digits
   - Check sum (NIDA proprietary)

**Validation Rules:**
- Must be exactly 16 digits
- Structure must match regex: `^(\\d)(\\d{4})([78])(\\d{7})(\\d)(\\d{2})$`
- Each component validated against business rules

#### Rwandan Phone Number Validator

**Format:** `072XXXXXXX`, `073XXXXXXX`, `078XXXXXXX`, `079XXXXXXX`

**Rules:**
- Must be exactly 10 digits
- Must start with prefix: 072, 073, 078, or 079
- Regex: `^(072|073|078|079)\\d{7}$`
- No special characters (hyphens, spaces auto-removed)

#### Email Validator

- Standard email format validation
- Jakarta Validation `@Email` annotation
- Must be unique per user

#### Enum Validator

- Validates role values against Role enum
- Case-insensitive option available
- Provides clear error messages with allowed values

### 7. Email Notifications

**Purpose:** Welcome users and provide credentials

**Email Service:**
- Provider: Spring Boot Mail
- Protocol: SMTP
- Support: Gmail, custom SMTP servers

**Welcome Email Content:**
```
Subject: Welcome to Starhawk Platform

Dear {firstName},

Welcome to the Starhawk Platform!

Your account has been successfully created. Please use the following credentials to log in:

Phone Number: {phoneNumber}
Password: {generatedPassword}

For security reasons, please change your password after your first login.

If you have any questions or need assistance, please don't hesitate to contact us.

Best regards,
Starhawk Team
```

**Configuration:**
- SMTP host (configurable)
- Port (587 for TLS)
- Username & password (SMTP credentials)
- TLS/SSL support

**Error Handling:**
- Email failures logged but don't block user registration
- Non-critical operation (async in production recommended)

### 8. Database Schema

#### Tables

**users**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(10) NOT NULL UNIQUE,
    national_id VARCHAR(16) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    first_login_required BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    province VARCHAR(255),
    district VARCHAR(255),
    sector VARCHAR(255),
    cell VARCHAR(255),
    village VARCHAR(255),
    sex VARCHAR(10),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

Indexes:
- idx_users_email
- idx_users_phone_number
- idx_users_national_id
- idx_users_role
- idx_users_active
```

**farmer_profiles**
```sql
CREATE TABLE farmer_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    farm_province VARCHAR(255),
    farm_district VARCHAR(255),
    farm_sector VARCHAR(255),
    farm_cell VARCHAR(255),
    farm_village VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_farmer_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

Index: idx_farmer_profiles_user_id
```

**assessor_profiles**
```sql
CREATE TABLE assessor_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    specialization TEXT,
    experience_years INTEGER,
    profile_photo_url VARCHAR(500),
    bio TEXT,
    address TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assessor_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

Index: idx_assessor_profiles_user_id
```

**insurer_profiles**
```sql
CREATE TABLE insurer_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    company_name VARCHAR(255),
    contact_person VARCHAR(255),
    website VARCHAR(500),
    address TEXT,
    company_description TEXT,
    license_number VARCHAR(100),
    registration_date DATE,
    company_logo_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_insurer_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

Index: idx_insurer_profiles_user_id
```

**Migrations:**
- Managed by Flyway
- Sequential versioning: `V1__create_users_table.sql`, `V2__create_profile_tables.sql`
- Auto-executed on application startup

#### Relationships

- One-to-One: `users` ← `farmer_profiles`, `assessor_profiles`, `insurer_profiles`
- Foreign keys with CASCADE DELETE
- Unique constraints on `user_id` to enforce one profile per user per role

### 9. API Response Structure

**Standard Response Format:**
```json
{
    "message": "Success message",
    "data": { ... },
    "pagination": { ... },  // Only for paginated responses
    "success": true
}
```

**Pagination Metadata:**
```json
{
    "pageNumber": 0,
    "pageSize": 10,
    "totalElements": 150,
    "totalPages": 15
}
```

**Error Response Format:**
```json
{
    "type": "about:blank",
    "title": "Bad Request",
    "status": 400,
    "detail": "Error message",
    "instance": "/api/v1/endpoint",
    "validationErrors": {  // Only for validation errors
        "field": "error message"
    }
}
```

### 10. Exception Handling

#### Custom Exceptions

**BadRequestException:**
- HTTP 400
- Client errors (validation, business rule violations)
- Example: Duplicate email, invalid NIDA data

**NotFoundException:**
- HTTP 404
- Resource not found
- Example: User not found by ID

**SecurityExceptions:**
- AuthenticationEntryPoint (HTTP 401)
- AccessDeniedHandler (HTTP 403)
- AuthenticationFailureHandler (HTTP 403)

#### Global Exception Handler

**Handled Exceptions:**
- IllegalArgumentException → 400
- MethodArgumentNotValidException → 400 (with field errors)
- BadRequestException → 400
- NotFoundException → 404
- MaxUploadSizeExceededException → 400
- DisabledException → 403
- MessagingException → 500
- Exception (generic) → 500

**Response Format:**
- ProblemDetail (RFC 7807 compliant)
- JSON response
- Includes timestamp and instance URI

### 11. Admin User Bootstrap

**Purpose:** Auto-create default admin on first startup

**Configuration (Environment Variables):**
- `ADMIN_EMAIL`: Admin email address
- `ADMIN_PHONE`: Admin phone number
- `ADMIN_NATIONAL_ID`: Admin national ID
- `ADMIN_PASSWORD`: Admin password

**Logic:**
- Executed via `@PostConstruct` in `UserService`
- Checks if admin user exists by email
- If not exists, creates admin with:
  - Role: ADMIN
  - firstLoginRequired: false
  - active: true
  - Hardcoded location data (can be configured)
- Only creates once (idempotent)

**Security Note:**
- Must change default admin credentials in production
- Use environment variables for all admin credentials

### 12. Configuration Management

#### Environment Profiles

**Development Profile (`application-dev.properties`):**
- Local PostgreSQL database
- MailHog for email testing
- Verbose logging (DEBUG level)
- Hibernate DDL auto-update

**Production Profile (`application-prod.properties`):**
- Production database URL
- Production SMTP settings
- INFO level logging
- Flyway migrations only

**Base Configuration (`application.properties`):**
- JWT secret (must override in production)
- JWT expiration (24 hours default)
- Admin bootstrap credentials (must override in production)

#### Required Environment Variables

**Database:**
- `SPRING_DATASOURCE_URL`: JDBC connection string
- `SPRING_DATASOURCE_USERNAME`: Database username
- `SPRING_DATASOURCE_PASSWORD`: Database password

**Security:**
- `JWT_SECRET`: Base64-encoded secret (256-bit minimum)
- `JWT_EXPIRATION_MS`: Token expiration in milliseconds

**Email:**
- `MAIL_HOST`: SMTP server hostname
- `MAIL_PORT`: SMTP port (587 for TLS)
- `MAIL_USERNAME`: SMTP username
- `MAIL_PASSWORD`: SMTP password
- `MAIL_SMTP_AUTH`: Enable SMTP auth (true/false)
- `MAIL_SMTP_STARTTLS`: Enable STARTTLS (true/false)

**Admin:**
- `ADMIN_EMAIL`
- `ADMIN_PHONE`
- `ADMIN_NATIONAL_ID`
- `ADMIN_PASSWORD`

**Application:**
- `SPRING_PROFILES_ACTIVE`: Active profile (dev/prod)

### 13. API Endpoints

#### Authentication Endpoints

```
POST   /api/v1/auth/login
       Body: { phoneNumber, password }
       Response: { token, userId, role, email, phoneNumber, firstLoginRequired }

GET    /api/v1/auth/profile
       Headers: Authorization: Bearer {token}
       Response: UserProfileResponse with role-specific profile

PUT    /api/v1/auth/profile
       Headers: Authorization: Bearer {token}
       Body: Role-specific profile data
       Response: Updated UserProfileResponse
```

#### User Management Endpoints (Admin Only)

```
POST   /api/v1/users
       Body: RegisterRequest { nationalId, email, phoneNumber, role }
       Response: UserProfileResponse

GET    /api/v1/users
       Query: page, size, sortBy, sortDirection
       Response: Paginated list of UserProfileResponse

GET    /api/v1/users/{userId}
       Response: UserProfileResponse

PUT    /api/v1/users/{userId}
       Body: UpdateUserRequest { email, role, active }
       Response: UserProfileResponse

PUT    /api/v1/users/{userId}/deactivate
       Response: Success message
```

#### API Documentation

```
GET    /swagger-ui.html
       OpenAPI/Swagger UI interface

GET    /v3/api-docs
       OpenAPI JSON specification
```

### 14. Business Rules & Constraints

#### User Registration

1. National ID must be valid Rwanda format (16 digits)
2. National ID must exist in NIDA database
3. Email must be unique across all users
4. Phone number must be unique across all users
5. Phone number must follow Rwanda format (072/073/078/079)
6. Role must be valid enum value
7. Password is auto-generated (12 characters, mixed types)
8. User receives welcome email with credentials
9. Role-specific profile is automatically created

#### User Authentication

1. Login uses phone number (not email)
2. Account must be active to authenticate
3. Password is verified using BCrypt
4. JWT token includes userId and role
5. Token expires after configured duration
6. Token must be included in Authorization header

#### Profile Management

1. Users can only update their own profile
2. Profile updates are role-specific
3. No profile fields are mandatory (all optional)
4. Profile data persists independently of user data
5. Profile is deleted when user is deleted (CASCADE)

#### Admin Operations

1. Only ADMIN role can access `/api/v1/users/**` endpoints
2. Admin can create users for any role except ADMIN
3. Admin can change user roles
4. Admin can deactivate users (except other admins)
5. Profile migration handled automatically on role change

#### NIDA Integration

1. NIDA validation occurs ONLY during registration
2. NIDA data becomes source of truth for identity
3. NIDA failures prevent user creation
4. NIDA response must have all required fields
5. Empty/invalid NIDA data rejected

#### Data Validation

1. All inputs validated before processing
2. Validation errors return detailed field-level messages
3. National ID format strictly enforced (business logic)
4. Phone number format strictly enforced (Rwanda only)
5. Email format validated using Jakarta Validation

### 15. Security Architecture

#### Authentication Flow

1. **Login Request:**
   - Client sends credentials to `/api/v1/auth/login`
   - AuthenticationManager validates credentials
   - JwtService generates JWT token
   - Token returned to client

2. **Subsequent Requests:**
   - Client includes token in Authorization header
   - JwtAuthenticationFilter intercepts request
   - Token validated (signature + expiration)
   - User details loaded from database
   - Security context populated
   - Request proceeds to controller

3. **Authorization:**
   - Controller methods check roles using `@PreAuthorize`
   - Spring Security validates role against token claims
   - Access granted or denied based on role

#### Password Security

1. Passwords never stored in plain text
2. BCrypt hashing with random salt
3. Cost factor 10 (configurable)
4. SecureRandom for password generation
5. Password not transmitted after initial email

#### Token Security

1. Tokens signed with HMAC-SHA256
2. Secret key base64-encoded
3. Tokens include expiration timestamp
4. Tokens validated on every request
5. Invalid/expired tokens rejected

#### Data Security

1. Prepared statements for SQL (JPA prevents injection)
2. Input validation on all endpoints
3. CORS configurable (default: disabled)
4. HTTPS required in production
5. Sensitive data never logged

### 16. Deployment Architecture

#### Container Strategy

**Multi-Stage Docker Build:**
1. **Stage 1 (Builder):**
   - Base: maven:3.9.9-eclipse-temurin-21-alpine
   - Downloads dependencies
   - Compiles application
   - Builds executable JAR

2. **Stage 2 (Runtime):**
   - Base: eclipse-temurin:21-jre-alpine
   - Copies JAR from builder
   - Non-root user (spring)
   - dumb-init for signal handling
   - Health checks configured

#### JVM Configuration

**Production Settings:**
- `-XX:+UseContainerSupport`: Container-aware memory
- `-XX:MaxRAMPercentage=75.0`: Use 75% of container memory
- `-Djava.security.egd=file:/dev/./urandom`: Faster startup
- `-Dspring.profiles.active=prod`: Production profile

#### Health Checks

**Endpoint:** `/actuator/health`

**Configuration:**
- Interval: 30 seconds
- Timeout: 3 seconds
- Start period: 40 seconds
- Retries: 3

#### Database Migrations

**Automatic Execution:**
- Flyway runs migrations on startup
- Migrations located in `db/migration/`
- Version tracking in `flyway_schema_history` table
- Failed migrations prevent startup

---

## Component Architecture

### Package Structure

```
com.starhawk.starhwakbackend/
├── auth/
│   ├── AuthController.java          # Authentication endpoints
│   ├── AuthService.java             # Authentication business logic
│   ├── SecurityExceptionHandler.java # Security error handling
│   ├── dto/
│   │   ├── LoginRequest.java        # Login input DTO
│   │   ├── LoginResponse.java       # Login response DTO
│   │   └── RegisterRequest.java     # Registration input DTO
│   └── security/
│       ├── CustomUserDetailsService.java # User loading for auth
│       ├── JwtAuthenticationFilter.java  # JWT token filter
│       └── JwtService.java               # JWT operations
│
├── users/
│   ├── UserController.java          # User management endpoints
│   ├── UserService.java             # User business logic
│   ├── User.java                    # User entity
│   ├── UserRepository.java          # User data access
│   ├── FarmerProfile.java           # Farmer profile entity
│   ├── FarmerProfileRepository.java # Farmer profile data access
│   ├── AssessorProfile.java         # Assessor profile entity
│   ├── AssessorProfileRepository.java # Assessor profile data access
│   ├── InsurerProfile.java          # Insurer profile entity
│   ├── InsurerProfileRepository.java # Insurer profile data access
│   ├── Role.java                    # Role enum
│   └── dto/
│       ├── UserProfileResponse.java  # User profile output
│       ├── FarmerProfileRequest.java # Farmer profile input
│       ├── AssessorProfileRequest.java # Assessor profile input
│       ├── InsurerProfileRequest.java  # Insurer profile input
│       └── UpdateUserRequest.java    # Admin update input
│
├── nida/
│   ├── NidaServiceClient.java       # Feign client interface
│   ├── NidaResponse.java            # External API response
│   ├── DocumentResponse.java        # NIDA data structure
│   ├── DocumentRequest.java         # NIDA request structure
│   └── NidaFeignConfig.java         # Feign configuration
│
├── commons/
│   ├── GlobalExceptionHandler.java  # Global exception handler
│   ├── email/
│   │   └── EmailService.java        # Email sending service
│   ├── exceptions/
│   │   ├── BadRequestException.java # 400 exception
│   │   └── NotFoundException.java   # 404 exception
│   ├── generic_api_response/
│   │   └── ApiResponse.java         # Standard response wrapper
│   ├── pagination/
│   │   └── PageInfo.java            # Pagination metadata
│   └── validation/
│       ├── RwandaNationalIdValidator.java # National ID validator
│       ├── ValidRwandaId.java            # National ID annotation
│       ├── RwandanPhoneNumberValidator.java # Phone validator
│       ├── ValidRwandanPhoneNumber.java     # Phone annotation
│       ├── EnumValidator.java          # Enum validator
│       └── ValidEnum.java               # Enum annotation
│
└── config/
    ├── SecurityConfig.java          # Spring Security configuration
    └── OpenAPIConfig.java           # Swagger/OpenAPI configuration
```

### Service Layer Responsibilities

**AuthService:**
- User registration with NIDA integration
- User login and JWT generation
- NIDA data fetching and validation
- Secure password generation
- Welcome email triggering
- Role profile creation

**UserService:**
- Admin user bootstrap
- User profile retrieval
- User profile updates (self and admin)
- User deactivation
- Admin user management (CRUD)
- Pagination for user listing
- NIDA data fetching (reused from AuthService)
- Role-based profile handling

**EmailService:**
- Welcome email composition and sending
- SMTP configuration abstraction
- Error handling (non-blocking)

**JwtService:**
- Token generation with claims
- Token validation (signature + expiration)
- Token parsing and claim extraction

**CustomUserDetailsService:**
- User loading for Spring Security
- Authority/role mapping
- User authentication support

### Repository Layer

**Data Access Patterns:**
- Spring Data JPA repositories
- Custom queries via method naming
- One-to-One relationship handling
- Cascading delete operations
- UUID primary keys throughout

**Repositories:**
- `UserRepository`: Basic CRUD + custom finders
- `FarmerProfileRepository`: Profile CRUD + user lookup
- `AssessorProfileRepository`: Profile CRUD + user lookup
- `InsurerProfileRepository`: Profile CRUD + user lookup

---

## Replication Guide

### For Another Language/Framework

#### Core Business Logic to Replicate

1. **User Registration:**
   - National ID validation (Rwanda format)
   - Phone number validation (Rwanda format)
   - Email validation
   - NIDA API integration
   - Password generation and hashing
   - User entity creation
   - Role-specific profile creation
   - Welcome email sending

2. **Authentication:**
   - JWT token generation (HS256)
   - JWT token validation
   - Spring Security alternative (auth middleware)
   - User loading by phone number
   - Password verification (BCrypt or equivalent)

3. **Profile Management:**
   - Role-specific profile handling
   - Profile updates (role-based)
   - Profile retrieval with join

4. **Authorization:**
   - Role-based access control (RBAC)
   - Protected endpoints
   - Admin-only operations
   - Method-level security

5. **Data Validation:**
   - Rwanda National ID format validation
   - Rwandan phone number validation
   - Email validation
   - Enum validation
   - Input sanitization

6. **Exception Handling:**
   - Global exception handler
   - Error response formatting
   - Validation error handling
   - Security exception handling

#### Database Schema to Replicate

Replicate these tables exactly:
- `users` (with all indexes)
- `farmer_profiles`
- `assessor_profiles`
- `insurer_profiles`

Relationships:
- One-to-One between users and profiles
- CASCADE DELETE on user deletion
- Foreign key constraints

#### External Integrations to Replicate

1. **NIDA API:**
   - Endpoint: `POST https://prod.safaribus.rw/nxreporting/nida/document`
   - Request: `{ "document_number": "..." }`
   - Response parsing
   - Error handling

2. **SMTP Email:**
   - Welcome email template
   - SMTP configuration
   - Non-blocking email sending

#### Key Algorithms to Replicate

1. **Password Hashing:**
   - BCrypt with cost factor 10
   - Random salt generation

2. **Password Generation:**
   - 12 characters
   - Mixed case letters
   - Numbers
   - Special characters
   - Cryptographically secure random

3. **JWT Token:**
   - HS256 signature
   - Claims: userId, role, expiration
   - Base64 secret key encoding

4. **National ID Validation:**
   - Structure: GYYYY#NNNNNNNIFCC
   - Component validation rules
   - Business logic validation

#### Configuration to Replicate

Environment variables:
- Database connection strings
- JWT secret and expiration
- SMTP configuration
- Admin bootstrap credentials
- Application profile (dev/prod)

Configuration profiles:
- Development vs. production
- Logging levels
- Database settings
- Email settings

---

## Testing Considerations

### Unit Tests

**Services:**
- AuthService registration flow
- AuthService login flow
- UserService profile operations
- EmailService email formatting
- JwtService token operations
- Validators (National ID, Phone)

### Integration Tests

**API Endpoints:**
- Authentication flows
- Profile management
- Admin operations
- Error handling

**Database:**
- Repository operations
- CASCADE deletes
- Relationships
- Migrations

### Security Tests

**Authentication:**
- Valid/invalid credentials
- Expired tokens
- Missing tokens
- Invalid token signatures

**Authorization:**
- Role-based access
- Admin-only endpoints
- Unauthorized access attempts

**Validation:**
- National ID edge cases
- Phone number edge cases
- Email validation
- Input sanitization

### Load Tests

**Endpoints:**
- Login endpoint
- Profile retrieval
- User listing (pagination)

**Database:**
- Query performance
- Index effectiveness
- Connection pooling

---

## Future Enhancements

**Recommended Additions:**
1. Password reset flow (email/SMS)
2. Two-factor authentication (2FA)
3. Refresh token mechanism
4. Rate limiting per endpoint
5. API versioning strategy
6. Audit logging
7. Soft delete for users
8. Profile photo upload
9. Document management
10. Insurance policy management
11. Claim submission and processing
12. Payment integration
13. SMS notifications (via Twilio or similar)
14. Real-time notifications (WebSocket)
15. Comprehensive API documentation

---

## Summary

This Starhawk Backend system provides a robust foundation for agricultural insurance management with:

- **Multi-role user management** with NIDA identity verification
- **JWT-based authentication** with role-based authorization
- **Rwanda-specific validations** for national ID and phone numbers
- **Role-specific profiles** for Farmers, Assessors, and Insurers
- **Email notifications** for user onboarding
- **Comprehensive error handling** and validation
- **Database migrations** with Flyway
- **Security best practices** with BCrypt and JWT
- **Admin bootstrap** for initial setup
- **Production-ready deployment** with Docker

The architecture is modular, scalable, and follows Spring Boot best practices. All business logic is contained in service layers, with clear separation of concerns between authentication, authorization, data access, and external integrations.

