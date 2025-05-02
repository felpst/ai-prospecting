# Saved Companies API Documentation

This document provides information about the Saved Companies API endpoints, which allow users to manage their list of saved companies.

## Authentication

For the MVP implementation, a simple identification mechanism is used. The API creates or uses a default user with a demo email ('demo@example.com'). In a production environment, this would be replaced with proper authentication.

## Endpoints

### Get All Saved Companies

Retrieves a list of all companies saved by the user.

- **URL**: `/api/saved`
- **Method**: `GET`
- **URL Params**: None
- **Success Response**:
  - **Code**: 200
  - **Content**: An array of company objects
    ```json
    [
      {
        "id": "company-123",
        "name": "Example Company",
        "industry": "Technology",
        "description": "This is an example company"
      }
    ]
    ```
  - If no companies are saved, an empty array is returned.

### Check If Company Is Saved

Checks if a specific company is in the user's saved list.

- **URL**: `/api/saved/:companyId/check`
- **Method**: `GET`
- **URL Params**:
  - `:companyId` - ID of the company to check
- **Success Response**:
  - **Code**: 200
  - **Content**:
    ```json
    {
      "isSaved": true,
      "companyId": "company-123"
    }
    ```
  - `isSaved` will be `false` if the company is not in the saved list.

### Save Company

Adds a company to the user's saved list.

- **URL**: `/api/saved/:companyId`
- **Method**: `POST`
- **URL Params**:
  - `:companyId` - ID of the company to save
- **Success Response**:
  - **Code**: 200
  - **Content**:
    ```json
    {
      "message": "Company saved successfully",
      "companyId": "company-123"
    }
    ```
- **Error Response**:
  - **Code**: 404
  - **Content**:
    ```json
    {
      "error": "Company with ID company-123 not found"
    }
    ```
  - This occurs if the company ID doesn't exist in the database.

### Remove Company from Saved List

Removes a company from the user's saved list.

- **URL**: `/api/saved/:companyId`
- **Method**: `DELETE`
- **URL Params**:
  - `:companyId` - ID of the company to remove
- **Success Response**:
  - **Code**: 200
  - **Content**:
    ```json
    {
      "message": "Company removed from saved list",
      "companyId": "company-123"
    }
    ```
  - If the company is not in the saved list, the operation is still considered successful.

## Error Handling

The API uses a standardized error response format:

```json
{
  "error": {
    "message": "Error message",
    "statusCode": 404
  }
}
```

Common HTTP status codes:
- 200: Success
- 404: Resource not found
- 500: Server error

## Implementation Notes

- The User model stores an array of company IDs in the `saved_companies` field
- The API prevents duplicate entries when saving companies
- No validation is needed when removing companies - if the company is not in the list, the operation is still successful
- The API returns full company objects when fetching the saved list, not just IDs 