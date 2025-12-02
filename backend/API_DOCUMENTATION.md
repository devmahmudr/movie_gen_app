# API Documentation

Base URL: `http://localhost:3000`

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <accessToken>
```

## Authentication Endpoints

### POST /auth/register

Register a new user.

**Request Body:**
```json
{
  "email": "user@email.com",
  "password": "strongpassword123"
}
```

**Response:**
```json
{
  "accessToken": "jwt.token.string"
}
```

**Status Codes:**
- `201 Created` - User registered successfully
- `409 Conflict` - User with this email already exists
- `400 Bad Request` - Validation error

---

### POST /auth/login

Login with existing credentials.

**Request Body:**
```json
{
  "email": "user@email.com",
  "password": "strongpassword123"
}
```

**Response:**
```json
{
  "accessToken": "jwt.token.string"
}
```

**Status Codes:**
- `200 OK` - Login successful
- `401 Unauthorized` - Invalid credentials
- `400 Bad Request` - Validation error

---

## User Endpoints

### GET /users/me

Get the current authenticated user's profile.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:**
```json
{
  "id": "uuid-string",
  "email": "user@email.com"
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - User not found

---

## Recommendations Endpoints

### POST /recommend

Get personalized movie recommendations based on user preferences and history.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Request Body:**
```json
{
  "context": "С девушкой/парнем",
  "moods": ["Расслабиться", "Посмеяться"],
  "tags": ["Загадочность", "Неожиданный финал"],
  "similarTo": "Inception",
  "format": "Фильм"
}
```

**Field Descriptions:**
- `context` (required): Enum - One of:
  - `"Один"` (Alone)
  - `"С девушкой/парнем"` (With partner)
  - `"С друзьями"` (With friends)
  - `"С семьёй"` (With family)
  - `"Хочу фоновый фильм"` (Background movie)

- `moods` (required): Array of up to 2 strings - Desired moods/emotions
- `tags` (required): Array of up to 2 strings - Preferred movie tags/genres
- `similarTo` (optional): String - Title of a similar movie
- `format` (required): Enum - One of:
  - `"Фильм"` (Movie)
  - `"Сериал"` (Series)
  - `"Оба"` (Both)

**Response:**
```json
[
  {
    "movieId": "550",
    "title": "Fight Club",
    "posterPath": "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"
  },
  {
    "movieId": "13",
    "title": "Forrest Gump",
    "posterPath": "https://image.tmdb.org/t/p/w500/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg"
  },
  {
    "movieId": "680",
    "title": "Pulp Fiction",
    "posterPath": "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg"
  }
]
```

**Status Codes:**
- `200 OK` - Recommendations retrieved successfully
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - Could not find matching movies
- `500 Internal Server Error` - OpenAI or TMDb API error

**Note:** The recommended movies are automatically saved to the user's movie history.

---

## History Endpoints

### GET /history

Get paginated movie history for the authenticated user.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Query Parameters:**
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Number of items per page

**Example:**
```
GET /history?page=1&limit=20
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid-string",
      "userId": "uuid-string",
      "movieId": "550",
      "title": "Fight Club",
      "posterPath": "https://image.tmdb.org/t/p/w500/...",
      "userRating": 9,
      "userFeedback": "Отличный фильм!",
      "shownAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Invalid or missing token

---

### PUT /history/:historyId

Update a movie history entry (rating and/or feedback).

**Headers:**
- `Authorization: Bearer <token>` (required)

**Path Parameters:**
- `historyId` (required): UUID of the history record

**Request Body:**
```json
{
  "userRating": 9,
  "userFeedback": "Отличный фильм!"
}
```

Both fields are optional. Only provided fields will be updated.

**Response:**
```json
{
  "id": "uuid-string",
  "userId": "uuid-string",
  "movieId": "550",
  "title": "Fight Club",
  "posterPath": "https://image.tmdb.org/t/p/w500/...",
  "userRating": 9,
  "userFeedback": "Отличный фильм!",
  "shownAt": "2024-01-15T10:30:00.000Z",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

**Status Codes:**
- `200 OK` - Update successful
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - History record does not belong to user
- `404 Not Found` - History record not found
- `400 Bad Request` - Validation error (rating must be 1-10)

---

## Error Responses

All error responses follow this format:

```json
{
  "statusCode": 400,
  "message": "Error message or array of validation errors",
  "error": "Error type"
}
```

**Common Status Codes:**
- `400 Bad Request` - Validation error or bad request
- `401 Unauthorized` - Authentication required or invalid token
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate email)
- `500 Internal Server Error` - Server error

---

## Example Flow

1. **Register a new user:**
```bash
POST /auth/register
Body: {"email": "user@example.com", "password": "password123"}
Response: {"accessToken": "eyJhbGc..."}
```

2. **Get recommendations:**
```bash
POST /recommend
Headers: {"Authorization": "Bearer eyJhbGc..."}
Body: {
  "context": "С девушкой/парнем",
  "moods": ["Расслабиться"],
  "tags": ["Романтика"],
  "format": "Фильм"
}
Response: [{"movieId": "...", "title": "...", "posterPath": "..."}, ...]
```

3. **View history:**
```bash
GET /history?page=1&limit=10
Headers: {"Authorization": "Bearer eyJhbGc..."}
```

4. **Update rating:**
```bash
PUT /history/uuid-here
Headers: {"Authorization": "Bearer eyJhbGc..."}
Body: {"userRating": 8, "userFeedback": "Хороший фильм"}
```

