# API Reference

This document describes the public API for the system.

## Authentication

Users must authenticate using an API key. The API key should be passed in the Authorization header.

```
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### GET /users

Retrieve a list of all users in the system.

**Parameters:**
- limit (optional): Maximum number of results to return (default: 100)
- offset (optional): Number of results to skip (default: 0)

**Response:**
```json
{
  "users": [
    {"id": "user123", "name": "John Doe"}
  ]
}
```

### POST /users

Create a new user.

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com"
}
```

## Response Codes

- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Internal Server Error
