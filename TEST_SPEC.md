# API Reference

This document describes the public API for the system.

## Authentication

**BREAKING CHANGE**: API key authentication has been replaced with OAuth 2.0. All existing API keys are now invalid.

Users must now authenticate using OAuth 2.0 tokens. Obtain a token from the authentication endpoint.

```
Authorization: Bearer YOUR_OAUTH_TOKEN
```

## Endpoints

### GET /users

Retrieve a list of all users in the system. This endpoint supports pagination and filtering.

**Parameters:**
- limit (optional): Maximum number of results to return (default: 100)
- offset (optional): Number of results to skip (default: 0)
- status (optional): Filter users by status (active, inactive, suspended)

**Response:**
```json
{
  "users": [
    {"id": "user123", "name": "John Doe", "status": "active"}
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

## Advanced Features

### Rate Limiting

The API implements rate limiting to prevent abuse. Each authenticated user is limited to 1000 requests per hour.

### Response Codes

- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden (rate limit exceeded)
- 404: Not Found
- 500: Internal Server Error

