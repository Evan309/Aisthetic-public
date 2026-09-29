# FastAPI Backend Setup Guide

This guide will help you set up and run the FastAPI backend that connects to your NeonDB database and serves your frontend.

## Prerequisites

- Python 3.9 or higher
- NeonDB database connection string
- All dependencies installed

## Installation

1. **Install Python dependencies:**

```bash
cd backend
pip install -r requirements.txt
```

2. **Set up environment variables:**

Create a `.env` file in the project root (if you don't have one already) with:

```env
DATABASE_URL=your_neondb_connection_string
FRONTEND_URL=http://localhost:5173
GLOBAL_CATEGORY_MAP=backend/utils/maps/global_category_rules.json
```

## Running the Backend

### Development Mode (with auto-reload)

```bash
cd backend
python main.py
```

Or using uvicorn directly:

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API Base URL**: `http://localhost:8000`
- **API Documentation**: `http://localhost:8000/docs` (Swagger UI)
- **Alternative Docs**: `http://localhost:8000/redoc` (ReDoc)

## API Endpoints

### Health Check
- `GET /api/health` - Check API and database connectivity

### Products
- `GET /api/products` - List products with filtering, searching, and pagination
  - Query parameters:
    - `search` - Search term
    - `category` - Category filter
    - `main_category` - Main category filter
    - `sub_category` - Sub category filter
    - `gender` - Gender filter
    - `brand` - Brand filter
    - `min_price` - Minimum price
    - `max_price` - Maximum price
    - `page` - Page number (default: 1)
    - `limit` - Items per page (default: 20, max: 100)
    - `sort_by` - Sort field: `name`, `price`, or `created_at`
    - `sort_order` - Sort order: `asc` or `desc`

- `GET /api/products/{product_id}` - Get product details by ID

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/main` - Get main categories
- `GET /api/categories/main/{main_category}/sub` - Get sub categories for a main category

## Frontend Configuration

The frontend is configured to connect to the backend API. Make sure to:

1. **Set the API URL** in your frontend environment:

Create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:8000/api
```

2. **Start the frontend:**

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173` by default.

## CORS Configuration

CORS is configured to allow requests from:
- `http://localhost:5173` (Vite default)
- `http://localhost:3000` (Alternative React dev server)
- `http://127.0.0.1:5173`
- `http://127.0.0.1:3000`
- The URL specified in `FRONTEND_URL` environment variable

## Testing the Connection

1. **Test the health endpoint:**
```bash
curl http://localhost:8000/api/health
```

2. **Test products endpoint:**
```bash
curl http://localhost:8000/api/products
```

3. **View API documentation:**
Open `http://localhost:8000/docs` in your browser to see the interactive API documentation.

## Troubleshooting

### Database Connection Issues
- Verify your `DATABASE_URL` in the `.env` file is correct
- Ensure your NeonDB database is accessible
- Check that the database schema is migrated (run migrations if needed)

### CORS Issues
- Make sure the frontend URL matches one of the allowed origins
- Check the `FRONTEND_URL` environment variable

### Import Errors
- Ensure you're running from the project root or have the correct Python path
- The backend uses relative imports, so make sure the project structure is correct

## Project Structure

```
backend/
├── api/
│   ├── routers/
│   │   ├── products.py      # Product endpoints
│   │   ├── categories.py   # Category endpoints
│   │   └── health.py       # Health check endpoint
│   ├── schemas.py          # Pydantic models
│   └── dependencies.py     # Database dependency injection
├── db/
│   ├── models.py           # SQLAlchemy models
│   ├── session.py          # Database session
│   └── ...
├── main.py                 # FastAPI application entry point
└── requirements.txt       # Python dependencies
```

## Next Steps

1. Ensure your database has product data (import products if needed)
2. Test the API endpoints using the Swagger UI at `/docs`
3. Verify the frontend can connect and fetch data
4. Add authentication if needed
5. Implement additional features as required

