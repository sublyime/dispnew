# API Documentation

## Overview

The Chemical Water Dispersion API provides RESTful endpoints for managing chemical spill data, chemical substances, and related environmental information. All endpoints return JSON data and follow standard HTTP status codes.

## Base URL

- **Development**: `https://localhost:5001/api`
- **Production**: `https://your-domain.com/api`

## Authentication

Currently, the API does not require authentication. This may change in future versions.

## Error Handling

The API uses standard HTTP status codes:

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `204 No Content` - Request successful, no content returned
- `400 Bad Request` - Invalid request data
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

Error responses include a JSON object with error details:

```json
{
  "message": "Error description",
  "details": "Additional error information"
}
```

## Endpoints

### Spills Management

#### Get All Spills

**GET** `/api/spill`

Returns a list of all chemical spills with associated chemical information.

**Response:**
```json
[
  {
    "id": 1,
    "chemicalId": 1,
    "volume": 100.5,
    "location": {
      "type": "Point",
      "coordinates": [-122.4194, 37.7749]
    },
    "timestamp": "2025-09-21T10:30:00Z",
    "chemical": {
      "id": 1,
      "name": "Benzene",
      "description": "Aromatic hydrocarbon",
      "casNumber": "71-43-2"
    }
  }
]
```

#### Get Spill by ID

**GET** `/api/spill/{id}`

Returns a specific spill by its ID.

**Parameters:**
- `id` (int, required): The spill ID

**Response:**
```json
{
  "id": 1,
  "chemicalId": 1,
  "volume": 100.5,
  "location": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "timestamp": "2025-09-21T10:30:00Z",
  "chemical": {
    "id": 1,
    "name": "Benzene",
    "description": "Aromatic hydrocarbon",
    "casNumber": "71-43-2"
  }
}
```

**Error Responses:**
- `404 Not Found` - Spill with specified ID does not exist

#### Create New Spill

**POST** `/api/spill`

Creates a new chemical spill record.

**Request Body:**
```json
{
  "chemicalId": 1,
  "volume": 100.5,
  "location": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "timestamp": "2025-09-21T10:30:00Z"
}
```

**Field Descriptions:**
- `chemicalId` (int, required): ID of the chemical involved in the spill
- `volume` (double, required): Volume of the spill in liters
- `location` (GeoJSON Point, required): Geographic location of the spill
- `timestamp` (DateTime, required): When the spill occurred

**Response:**
```json
{
  "id": 2,
  "chemicalId": 1,
  "volume": 100.5,
  "location": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "timestamp": "2025-09-21T10:30:00Z",
  "chemical": {
    "id": 1,
    "name": "Benzene",
    "description": "Aromatic hydrocarbon",
    "casNumber": "71-43-2"
  }
}
```

**Status:** `201 Created`

**Error Responses:**
- `400 Bad Request` - Invalid request data

#### Update Spill

**PUT** `/api/spill/{id}`

Updates an existing spill record.

**Parameters:**
- `id` (int, required): The spill ID to update

**Request Body:**
```json
{
  "id": 1,
  "chemicalId": 1,
  "volume": 150.0,
  "location": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "timestamp": "2025-09-21T10:30:00Z"
}
```

**Response:** `204 No Content`

**Error Responses:**
- `400 Bad Request` - ID in URL doesn't match ID in request body
- `404 Not Found` - Spill with specified ID does not exist

#### Delete Spill

**DELETE** `/api/spill/{id}`

Deletes a spill record.

**Parameters:**
- `id` (int, required): The spill ID to delete

**Response:** `204 No Content`

**Error Responses:**
- `404 Not Found` - Spill with specified ID does not exist

### Data Models

#### Spill Model

```json
{
  "id": "integer (auto-generated)",
  "chemicalId": "integer (required)",
  "volume": "double (required, in liters)",
  "location": "GeoJSON Point (required)",
  "timestamp": "DateTime (required, ISO 8601 format)",
  "chemical": "Chemical object (navigation property)"
}
```

#### Chemical Model

```json
{
  "id": "integer (auto-generated)",
  "name": "string (required, max 64 characters)",
  "description": "string (optional)",
  "casNumber": "string (optional, Chemical Abstracts Service number)"
}
```

#### Location Format

Locations are stored as GeoJSON Point objects:

```json
{
  "type": "Point",
  "coordinates": [longitude, latitude]
}
```

**Important:** Coordinates are in [longitude, latitude] order (x, y), not the more common latitude, longitude order.

## Rate Limiting

Currently, there are no rate limits implemented. This may change in future versions.

## Versioning

The API is currently at version 1.0. Future versions will be indicated in the URL path (e.g., `/api/v2/spill`).

## SDKs and Libraries

### .NET Client

For .NET applications, you can use the shared DTOs from the `ChemicalDispersionWater.SharedModels` package:

```csharp
using ChemicalDispersionWater.SharedModels.DTOs;

// Example usage
var spillDto = new SpillDto
{
    ChemicalId = 1,
    Volume = 100.5,
    Latitude = 37.7749,
    Longitude = -122.4194,
    Timestamp = DateTime.UtcNow
};
```

### HTTP Client Example

```csharp
using HttpClient client = new();
client.BaseAddress = new Uri("https://localhost:5001/");

// Get all spills
var spills = await client.GetFromJsonAsync<List<SpillDto>>("api/spill");

// Create a new spill
var newSpill = new SpillDto { /* ... */ };
var response = await client.PostAsJsonAsync("api/spill", newSpill);
```

## Support

For API support:
- Check the main project documentation
- Report issues on GitHub
- Contact the development team

## Changelog

### Version 1.0.0 (2025-09-21)
- Initial API release
- Basic CRUD operations for spills
- GeoJSON support for locations
- Entity Framework integration