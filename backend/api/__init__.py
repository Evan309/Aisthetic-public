from api.routers.brands import router as brands_router
from api.routers.categories import router as categories_router
from api.routers.closets import router as closets_router
from api.routers.health import router as health_router
from api.routers.products import router as products_router
from api.routers.users import router as users_router
from api.routers.search import router as search_router
from api.routers.curated_closets import router as curated_closets_router
from api.routers.favorite_brands import router as favorite_brands_router

all_routers = [
    brands_router,
    categories_router,
    closets_router,
    health_router,
    products_router,
    users_router,
    search_router,
    curated_closets_router,
    favorite_brands_router
]
