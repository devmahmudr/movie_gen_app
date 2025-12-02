# Project Structure

```
movie_app/
├── src/
│   ├── entities/                 # TypeORM entities
│   │   ├── user.entity.ts       # User entity
│   │   ├── movie-history.entity.ts  # Movie history entity
│   │   ├── watchlist.entity.ts  # Watchlist entity
│   │   └── index.ts
│   │
│   ├── database/                 # Database configuration
│   │   ├── database.module.ts   # TypeORM module setup
│   │   ├── data-source.ts       # TypeORM data source for migrations
│   │   └── migrations/          # Migration files (generated)
│   │
│   ├── auth/                     # Authentication module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts   # POST /auth/register, /auth/login
│   │   ├── auth.service.ts      # Password hashing, JWT generation
│   │   ├── jwt.strategy.ts      # Passport JWT strategy
│   │   ├── jwt-auth.guard.ts    # JWT guard for protected routes
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       └── login.dto.ts
│   │
│   ├── users/                    # User profile module
│   │   ├── users.module.ts
│   │   ├── users.controller.ts  # GET /users/me
│   │   └── users.service.ts
│   │
│   ├── recommendations/          # Movie recommendations module
│   │   ├── recommendations.module.ts
│   │   ├── recommendations.controller.ts  # POST /recommend
│   │   ├── recommendations.service.ts     # Core recommendation logic
│   │   ├── dto/
│   │   │   └── recommend.dto.ts
│   │   ├── interfaces/
│   │   │   └── movie.interface.ts
│   │   └── services/
│   │       ├── openai.service.ts    # OpenAI API integration
│   │       └── tmdb.service.ts      # TMDb API integration
│   │
│   ├── history/                  # Movie history module
│   │   ├── history.module.ts
│   │   ├── history.controller.ts   # GET /history, PUT /history/:id
│   │   ├── history.service.ts
│   │   └── dto/
│   │       └── update-history.dto.ts
│   │
│   ├── common/                   # Shared utilities
│   │   └── decorators/
│   │       └── current-user.decorator.ts
│   │
│   ├── app.module.ts            # Root application module
│   └── main.ts                  # Application entry point
│
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── nest-cli.json                # NestJS CLI configuration
├── .env.example                 # Environment variables template
├── .gitignore
├── README.md                    # Project overview
├── INSTALLATION.md              # Detailed installation guide
├── API_DOCUMENTATION.md         # Complete API documentation
└── PROJECT_STRUCTURE.md         # This file

```

## Key Features

### 1. Authentication & Authorization
- JWT-based authentication
- Password hashing with bcrypt
- Protected routes using JWT guards
- User registration and login endpoints

### 2. Database Layer
- TypeORM entities for Users, MovieHistory, and Watchlist
- PostgreSQL database support
- UUID primary keys
- Foreign key relationships
- Timestamps (createdAt, updatedAt)

### 3. Recommendations System
- OpenAI GPT-4 integration for personalized recommendations
- TMDb API integration for movie metadata
- User history-based recommendations
- Automatic saving of recommendations to history

### 4. Movie History
- Track all recommended movies
- User ratings (1-10)
- User feedback/comments
- Pagination support

## Technology Stack

- **Framework**: NestJS 10.x
- **Database**: PostgreSQL (via TypeORM)
- **Authentication**: JWT (passport-jwt)
- **AI Service**: OpenAI API (GPT-4)
- **Movie Data**: TMDb API
- **Validation**: class-validator, class-transformer
- **Password Hashing**: bcrypt

## Module Dependencies

```
AppModule
├── ConfigModule (global)
├── DatabaseModule
├── AuthModule
│   ├── UsersModule (implicit via User entity)
│   └── JwtModule
├── UsersModule
├── RecommendationsModule
│   ├── OpenAIService
│   └── TMDbService
└── HistoryModule
```

## Environment Variables

Required environment variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `JWT_EXPIRATION_TIME` - JWT token expiration (e.g., "24h")
- `OPENAI_API_KEY` - OpenAI API key
- `TMDB_API_KEY` - TMDb API key
- `TMDB_BASE_URL` - TMDb API base URL (optional)

## Next Steps for Development

1. Set up environment variables in `.env`
2. Create database tables (see INSTALLATION.md)
3. Install dependencies: `npm install`
4. Run the application: `npm run start:dev`
5. Test endpoints using API_DOCUMENTATION.md

## Future Enhancements

- Watchlist endpoints (entity exists but endpoints not implemented)
- Movie search functionality
- Genre filtering
- Advanced recommendation algorithms
- Rate limiting
- Caching for API responses
- WebSocket support for real-time updates

