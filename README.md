# Policy Management API

Node.js API for managing insurance policies. Uses MongoDB for storage, worker threads for file processing, and has CPU monitoring built in.

## Setup

```bash
npm install
npm start
```

Server runs on `http://localhost:3000` by default

## API Endpoints

### Upload File

**POST** `/api/policy/upload`

Upload CSV or XLSX file with policy data. Uses worker threads so it won't block.

**Request:**
- Content-Type: `multipart/form-data`
- Body: form-data with `file` field
- Supported: `.xlsx`, `.xls`, `.csv`
- Max size: 10MB

**Example:**
```bash
curl -X POST http://localhost:3000/api/policy/upload -F "file=@data.csv"
```

**Response:**
```json
{
  "success": true,
  "message": "File processed successfully",
  "processed": 1198,
  "total": 1198,
  "errors": [],
  "progress": ["Processing 1198 records...", "Processed 100/1198 records..."]
}
```

---

### Search by Username

**GET** `/api/policy/search?username=John`

Find policies by user's first name.

**Query params:**
- `username` - first name to search (required)

**Example:**
```bash
curl "http://localhost:3000/api/policy/search?username=John"
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "users": [{
    "id": "507f1f77bcf86cd799439011",
    "firstName": "John",
    "email": "john@example.com",
    "phoneNumber": "555-1234"
  }],
  "policies": [{
    "policyNumber": "POL-001",
    "policyStartDate": "2024-01-01T00:00:00.000Z",
    "policyEndDate": "2025-01-01T00:00:00.000Z",
    "policyCategory": "Life Insurance",
    "company": "ABC Insurance",
    "user": {
      "firstName": "John",
      "email": "john@example.com"
    }
  }]
}
```

---

### Get Aggregated Policies

**GET** `/api/policy/aggregate`

Returns all policies grouped by user.

**Example:**
```bash
curl http://localhost:3000/api/policy/aggregate
```

**Response:**
```json
{
  "success": true,
  "totalUsers": 10,
  "data": [{
    "userId": "507f1f77bcf86cd799439011",
    "userFirstName": "John",
    "userEmail": "john@example.com",
    "userPhone": "555-1234",
    "totalPolicies": 3,
    "policies": [{
      "policyNumber": "POL-001",
      "policyStartDate": "2024-01-01T00:00:00.000Z",
      "policyEndDate": "2025-01-01T00:00:00.000Z",
      "policyCategory": "Life Insurance",
      "company": "ABC Insurance"
    }]
  }]
}
```

---

### Schedule Message

**POST** `/api/message/schedule-message`

Schedule a message to be inserted into DB at a specific date/time.

**Request body:**
```json
{
  "message": "Your policy expires soon",
  "day": "2026-01-20",
  "time": "18:30"
}
```

- `message` - text to schedule (required)
- `day` - date in YYYY-MM-DD format (required)
- `time` - time in HH:MM format, 24-hour (required)

**Example:**
```bash
curl -X POST http://localhost:3000/api/message/schedule-message \
  -H "Content-Type: application/json" \
  -d '{"message": "Test", "day": "2026-01-20", "time": "18:30"}'
```

**Response:**
```json
{
  "status": "Scheduled successfully",
  "runAt": "2026-01-20T18:30:00.000Z"
}
```

---

## CSV File Format

Your CSV/XLSX should have these columns (column names are case-insensitive):

| Column | Required | Notes |
|--------|----------|-------|
| agent | No | Agent name |
| firstname | Yes | User first name |
| email | Yes | User email |
| dob | Yes | Date of birth (YYYY-MM-DD) |
| address | No | Defaults to "N/A" if empty |
| phone | Yes | Phone number |
| state | No | Defaults to "N/A" |
| zip | No | Defaults to "N/A" |
| gender | No | Defaults to "Other" |
| usertype | Yes | User type |
| account_name | No | Account name |
| category_name | Yes | Policy category |
| company_name | Yes | Insurance company |
| policy_number | Yes | Policy number |
| policy_start_date | Yes | Start date (YYYY-MM-DD) |
| policy_end_date | Yes | End date (YYYY-MM-DD) |

---

## Error Responses

**400 Bad Request:**
```json
{
  "error": "Error message here"
}
```

**500 Server Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Database Collections

- `agents` - Agent info
- `users` - User details (name, email, phone, address, etc)
- `accounts` - User accounts
- `lobs` - Policy categories
- `carriers` - Insurance companies
- `policies` - Policy records
- `messages` - Scheduled messages

---

## Features

- File upload with worker threads
- Search policies by username
- Aggregate policies by user
- CPU monitoring (auto-restart at 70%)
- Scheduled message insertion
- Flexible CSV column matching

---

## Environment Variables

Create `.env` file:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/policy_management
NODE_ENV=development
```
