// frontend/src/utils/api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// ============================================================
// Types
// ============================================================

// API Product type - matches backend schema
export interface ApiProduct {
  id: number;
  name: string;
  price?: number;
  originalPrice?: number;
  image?: string;
  images_list?: string[];
  images?: Array<{
    id: number;
    url: string;
    width?: number;
    height?: number;
    variant_id?: number | null;
  }>;
  description?: string;
  category?: string;
  category_name?: string;
  brand?: string;
  brand_name?: string;
  size?: string;
  color?: string;
  inStock: boolean;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  variants?: Array<{
    id: number;
    sku?: string;
    color?: string;
    size?: string;
    material?: string;
    image_url?: string;
    stock_status?: string;
  }>;
}

// Frontend Product type - used in components
export interface Product {
  id: number;
  name: string;
  price?: number;
  originalPrice?: number;
  image?: string;
  images?: string[];
  description?: string;
  category?: string;
  brand?: string;
  size?: string;
  color?: string;
  inStock: boolean;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
}

export interface ProductListResponse {
  products: ApiProduct[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export function convertApiProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    originalPrice: p.originalPrice,
    image: p.image,
    images: p.images_list,
    description: p.description,
    category: p.category_name || p.category,
    brand: p.brand_name || p.brand,
    inStock: p.inStock,
    rating: p.rating,
    reviewCount: p.reviewCount,
    tags: p.tags,
  };
}

export interface BrandWithImage {
  id: number;
  name: string;
  productCount?: number | null;
  image?: string | null;
}

export interface BrandListResponse {
  brands: BrandWithImage[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
}

export interface ProductQueryParams {
  search?: string;
  category?: string;
  main_category?: string;
  sub_category?: string;
  gender?: string;
  brand?: string;
  page?: number;
  limit?: number;
}

export interface ClosetItem {
  id: number;
  product_id: number;
  variant_id: number | null;
}

export interface ClosetItemCard {
  item_id: number;
  added_at: string;
  product: Product;
}


export interface ClosetCollaborator {
  user_id: number;
  role: "viewer" | "editor" | "owner";
  username?: string;
  email?: string;
  profile_picture_url?: string | null;
}

export interface Closet {
  id: number;
  name: string;
  description?: string | null;
  slug?: string | null;
  items: ClosetItem[];

  // ✅ Collaboration
  role?: "owner" | "editor" | "viewer";
  view_token?: string | null;
  edit_token?: string | null;
  collaborators?: ClosetCollaborator[];
  owner?: {
    id: number;
    name: string | null;
    profile_picture_url?: string | null;
  };
}

export interface CreateClosetPayload {
  name: string;
  description?: string | null;
}

export interface UpdateClosetPayload {
  name?: string;
  description?: string | null;
}

export interface ClosetSummary {
  id: number;
  name: string;
  description: string | null;
  slug?: string | null;
  item_count: number;
  outfit_count: number;
  thumb_urls: string[]; // up to 3

  // ✅ Collaboration
  role: "owner" | "editor" | "viewer";
  collaborators?: ClosetCollaborator[];
  owner?: {
    id: number;
    name: string | null;
    profile_picture_url?: string | null;
  };
}


// ---- Cached search types (backend /search/*) ----
export interface SearchProductCard {
  id: number;
  product_id: number;
  variant_id?: number | null;
  name: string;
  image?: string | null;
  brand?: string | null;
  price?: number | null;
  originalPrice?: number | null;
  inStock: boolean;
  matched_variant_image?: string | null;
  matched_variant_label?: string | null;
  score?: number | null;
}

export interface CachedSearchResponse {
  search_id: string;
  session_id?: number;
  mode: string;
  page: number;
  page_size: number;
  total_products: number;
  has_more: boolean;
  products: SearchProductCard[];
}

// ✅ NEW: Recent searches from backend (/search/recent)
export interface RecentSearchItemOut {
  id: number; // SearchSession.id
  search_id?: string | null; // SearchResultCache UUID
  mode: "text" | "image" | "multimodal";
  query_text?: string | null;
  query_image_url?: string | null;
  created_at: string;
}

export type SearchEventType =
  | "impression"
  | "click"
  | "favorite"
  | "add_to_closet"
  | "purchase_click";

export type ClosetSortBy = "recently_updated" | "created_at" | "item_count" | "name";


export interface LogSearchEventPayload {
  session_id: number;
  event_type: SearchEventType;
  product_id: number;
  variant_id?: number | null;
  position?: number | null;
  impression_key?: string | null;
}

export interface CuratedClosetSummary {
  id: number;
  title: string;
  description?: string | null;
  hero_image_url?: string | null;
  product_count: number;
  thumb_urls: string[]; // up to 3
}

export interface CuratedClosetSummaryResponse {
  closets: CuratedClosetSummary[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface CuratedClosetDetail {
  id: number;
  title: string;
  description?: string | null;
  hero_image_url?: string | null;
  product_count: number;
  thumb_urls: string[];
}

export interface CuratedClosetItemCard {
  rank: number;
  product: Product; // reuse your existing Product type
}

export interface CuratedClosetItemsResponse {
  curated_closet_id: number;
  page: number;
  page_size: number;
  total_products: number;
  has_more: boolean;
  products: SearchProductCard[]; // reuse your cached search card type
}

export interface FavoriteBrandIdsResponse {
  brand_ids: number[];
}

export interface FavoriteBrandToggleResponse {
  ok: true;
}

type TokenGetter = () => Promise<string | null>;

// ============================================================
// Api Client
// ============================================================

class ApiClient {
  private baseUrl: string;
  private getToken: TokenGetter | null = null;

  // resolves once setTokenGetter is called
  private tokenGetterReadyResolve: (() => void) | null = null;
  private tokenGetterReady: Promise<void>;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.tokenGetterReady = new Promise<void>((resolve) => {
      this.tokenGetterReadyResolve = resolve;
    });
  }

  // Call this once after Auth0 initializes
  setTokenGetter(getToken: TokenGetter) {
    this.getToken = getToken;
    if (this.tokenGetterReadyResolve) {
      this.tokenGetterReadyResolve();
      this.tokenGetterReadyResolve = null;
    }
  }

  // ✅ NEW: Optional auth header (does not throw if missing)
  private async getAuthHeaderOptional(): Promise<Record<string, string>> {
    await this.tokenGetterReady;
    if (!this.getToken) return {};
    const token = await this.getToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
    requireAuth: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    let authHeader: Record<string, string> = {};
    if (requireAuth) {
      // Wait for ApiAuthBridge to register token getter (prevents reload race)
      await this.tokenGetterReady;

      if (!this.getToken) {
        throw new Error("Auth token getter not set on ApiClient");
      }

      const token = await this.getToken();
      if (!token) {
        throw new Error("UNAUTHORIZED");
      }

      authHeader = { Authorization: `Bearer ${token}` };
    }

    const isFormData = options?.body instanceof FormData;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...authHeader,
        ...options?.headers,
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("UNAUTHORIZED");
    }

    if (!response.ok) {
      // Try to parse JSON error, else fall back
      const error = await response.json().catch(() => ({
        detail: `HTTP error! status: ${response.status}`,
      }));
      throw new Error(error.detail || "An error occurred");
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();

  }

  // ============================================================
  // public endpoints (no auth)
  // ============================================================

  async getProducts(params?: ProductQueryParams): Promise<ProductListResponse> {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
      });
    }
    const endpoint = `/products${qs.toString() ? `?${qs.toString()}` : ""}`;
    return this.request<ProductListResponse>(endpoint, { method: "GET" });
  }

  async getBrands(page?: number, limit?: number): Promise<BrandListResponse> {
    const qs = new URLSearchParams();
    if (page != undefined) qs.append("page", String(page));
    if (limit != undefined) qs.append("limit", String(limit));
    const endpoint = `/brands${qs.toString() ? `?${qs.toString()}` : ""}`;
    return this.request<BrandListResponse>(endpoint, { method: "GET" });
  }

  async getFeaturedBrands(limit?: number): Promise<BrandWithImage[]> {
    const qs = new URLSearchParams();
    if (limit != undefined) qs.append("limit", String(limit));
    const endpoint = `/brands/featured${qs.toString() ? `?${qs.toString()}` : ""}`;
    return this.request<BrandWithImage[]>(endpoint, { method: "GET" });
  }

  async getBrandProducts(brandId: number, params?: ProductQueryParams): Promise<ProductListResponse> {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
      });
    }
    const endpoint = `/brands/${brandId}/products${qs.toString() ? `?${qs.toString()}` : ""}`;
    return this.request<ProductListResponse>(endpoint, { method: "GET" });
  }

  async getBrand(id: number): Promise<BrandWithImage> {
    return this.request<BrandWithImage>(`/brands/${id}`, { method: "GET" });
  }


  async getProduct(id: number): Promise<ApiProduct> {
    return this.request<ApiProduct>(`/products/${id}`, { method: "GET" });
  }

  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>("/categories", { method: "GET" });
  }

  async healthCheck(): Promise<{
    status: string;
    database: string;
    timestamp: string;
  }> {
    return this.request("/health", { method: "GET" });
  }

  async getPublicClosets(): Promise<Closet[]> {
    return this.request<Closet[]>("/closets/public", { method: "GET" });
  }

  async getCuratedClosetsSummary(opts?: {
    page?: number;
    limit?: number;
  }): Promise<CuratedClosetSummaryResponse> {
    const qs = new URLSearchParams();
    if (opts?.page != null) qs.set("page", String(opts.page));
    if (opts?.limit != null) qs.set("limit", String(opts.limit));

    return this.request<CuratedClosetSummaryResponse>(
      `/curated-closets/summary${qs.toString() ? `?${qs}` : ""}`,
      { method: "GET" }
    );
  }

  async getCuratedClosetById(curatedClosetId: number): Promise<CuratedClosetDetail> {
    return this.request<CuratedClosetDetail>(`/curated-closets/${curatedClosetId}`, {
      method: "GET",
    });
  }

  async getCuratedClosetItems(opts: {
    curated_closet_id: number;
    page?: number;
    page_size?: number;
  }): Promise<CuratedClosetItemsResponse> {
    const qs = new URLSearchParams();
    if (opts.page != null) qs.set("page", String(opts.page));
    if (opts.page_size != null) qs.set("limit", String(opts.page_size));

    return this.request<CuratedClosetItemsResponse>(
      `/curated-closets/${opts.curated_closet_id}/items?${qs.toString()}`,
      { method: "GET" }
    );
  }

  async searchMultimodalCached(opts: {
    file?: File;
    query_text?: string;

    // ✅ NEW (matches backend)
    w_img?: number;
    w_txt?: number;
    k_images?: number;
    max_products?: number;

    page_size?: number;
    ttl_minutes?: number;
  }): Promise<CachedSearchResponse> {
    const qs = new URLSearchParams();
    if (opts.query_text) qs.set("query_text", opts.query_text);

    // ✅ NEW query params
    if (opts.w_img != null) qs.set("w_img", String(opts.w_img));
    if (opts.w_txt != null) qs.set("w_txt", String(opts.w_txt));
    if (opts.k_images != null) qs.set("k_images", String(opts.k_images));
    if (opts.max_products != null) qs.set("max_products", String(opts.max_products));

    if (opts.page_size != null) qs.set("page_size", String(opts.page_size));
    if (opts.ttl_minutes != null) qs.set("ttl_minutes", String(opts.ttl_minutes));

    const endpoint = `/search/multimodal${qs.toString() ? `?${qs.toString()}` : ""}`;

    // ✅ Optional auth: if user is signed in, backend will create SearchSession + recents
    const optionalAuth = await this.getAuthHeaderOptional();

    // ✅ only send multipart if we truly have a File
    if (opts.file instanceof File) {
      const form = new FormData();
      form.append("file", opts.file);
      return this.request<CachedSearchResponse>(
        endpoint,
        { method: "POST", body: form, headers: { ...optionalAuth } },
        false
      );
    }

    // ✅ text-only: no FormData, no body
    return this.request<CachedSearchResponse>(
      endpoint,
      { method: "POST", headers: { ...optionalAuth } },
      false
    );
  }

  async paginateSearchCache(opts: {
    search_id: string;
    page: number;
    page_size?: number;
  }): Promise<CachedSearchResponse> {
    const qs = new URLSearchParams();
    qs.set("page", String(opts.page));
    if (opts.page_size != null) qs.set("page_size", String(opts.page_size));

    return this.request<CachedSearchResponse>(
      `/search/cache/${opts.search_id}?${qs.toString()}`,
      { method: "GET" },
      false
    );
  }


  async similarProductsCached(opts: {
    product_id: number;
    variant_id?: number | null;
    k_images?: number;
    max_products?: number;
    page_size?: number;
    ttl_minutes?: number;
  }): Promise<CachedSearchResponse> {
    const qs = new URLSearchParams();
    if (opts.variant_id != null) qs.set("variant_id", String(opts.variant_id));
    if (opts.k_images != null) qs.set("k_images", String(opts.k_images));
    if (opts.max_products != null) qs.set("max_products", String(opts.max_products));
    if (opts.page_size != null) qs.set("page_size", String(opts.page_size));
    if (opts.ttl_minutes != null) qs.set("ttl_minutes", String(opts.ttl_minutes));

    return this.request<CachedSearchResponse>(
      `/search/similar/product/${opts.product_id}${qs.toString() ? `?${qs.toString()}` : ""
      }`,
      { method: "GET" },
      false
    );
  }

  async closetRecommendationsCached(opts: {
    closet_id: number;
    k_images?: number;
    max_products?: number;
    page_size?: number;
    ttl_minutes?: number;
  }): Promise<CachedSearchResponse> {
    const qs = new URLSearchParams();
    if (opts.k_images != null) qs.set("k_images", String(opts.k_images));
    if (opts.max_products != null) qs.set("max_products", String(opts.max_products));
    if (opts.page_size != null) qs.set("page_size", String(opts.page_size));
    if (opts.ttl_minutes != null) qs.set("ttl_minutes", String(opts.ttl_minutes));

    return this.request<CachedSearchResponse>(
      `/search/closet/${opts.closet_id}/recommendations${qs.toString() ? `?${qs.toString()}` : ""
      }`,
      { method: "GET" },
      true
    );
  }

  async logSearchEvent(payload: LogSearchEventPayload): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(
      "/search/events",
      { method: "POST", body: JSON.stringify(payload) },
      false
    );
  }

  // ============================================================
  // authed endpoints (Bearer token)
  // ============================================================

  async getMe(): Promise<{
    id: number;
    auth0_id: string;
    email: string | null;
    name: string | null;
    profile_picture_url?: string | null;
  }> {
    return this.request("/users/me", { method: "GET" }, true);
  }

  async deleteAccount(): Promise<void> {
    return this.request("/users/me", { method: "DELETE" }, true);
  }





  async getMyClosets(): Promise<Closet[]> {
    return this.request<Closet[]>("/closets/me", { method: "GET" }, true);
  }

  async createCloset(payload: CreateClosetPayload): Promise<Closet> {
    return this.request<Closet>(
      "/closets",
      { method: "POST", body: JSON.stringify(payload) },
      true
    );
  }

  async getClosetById(closetId: number): Promise<Closet> {
    return this.request<Closet>(`/closets/${closetId}`, { method: "GET" }, true);
  }

  async updateCloset(closetId: number, payload: UpdateClosetPayload): Promise<Closet> {
    return this.request<Closet>(
      `/closets/${closetId}`,
      { method: "PATCH", body: JSON.stringify(payload) },
      true
    );
  }

  async removeItemFromCloset(closetId: number, itemId: number) {
    return this.request(
      `/closets/${closetId}/items/${itemId}`,
      { method: "DELETE" },
      true
    );
  }

  async deleteCloset(closetId: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/closets/${closetId}`,
      { method: "DELETE" },
      true
    );
  }

  async getClosetItemCards(closetId: number, limit = 48, offset = 0): Promise<ClosetItemCard[]> {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));

    return this.request<ClosetItemCard[]>(
      `/closets/${closetId}/items/cards?${qs.toString()}`,
      { method: "GET" },
      true
    );
  }

  async addItemToCloset(closetId: number, productId: number | string, variantId?: number | null) {
    const qs = new URLSearchParams();
    qs.set("product_id", String(productId));
    if (variantId != null) qs.set("variant_id", String(variantId));

    return this.request(`/closets/${closetId}/items?${qs.toString()}`, { method: "POST" }, true);
  }

  async getMyClosetsSummary(opts?: {
    sort_by?: ClosetSortBy;
    sort_order?: "asc" | "desc";
  }): Promise<ClosetSummary[]> {
    const qs = new URLSearchParams();
    if (opts?.sort_by) qs.set("sort_by", opts.sort_by);
    if (opts?.sort_order) qs.set("sort_order", opts.sort_order);

    return this.request<ClosetSummary[]>(
      `/closets/me/summary${qs.toString() ? `?${qs.toString()}` : ""}`,
      { method: "GET" },
      true
    );
  }


  // ✅ NEW: recent searches (authed)
  async getRecentSearches(opts?: { limit?: number }): Promise<RecentSearchItemOut[]> {
    const qs = new URLSearchParams();
    if (opts?.limit != null) qs.set("limit", String(opts.limit));
    return this.request<RecentSearchItemOut[]>(
      `/search/recent${qs.toString() ? `?${qs.toString()}` : ""}`,
      { method: "GET" },
      true
    );
  }

  async deleteRecentSearch(sessionId: number): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(`/search/recent/${sessionId}`, { method: "DELETE" }, true);
  }

  async clearRecentSearches(): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(`/search/recent`, { method: "DELETE" }, true);
  }


  async getMyFavoriteBrandIds(): Promise<FavoriteBrandIdsResponse> {
    return this.request<FavoriteBrandIdsResponse>(
      "/users/me/favorite-brands",
      { method: "GET" },
      true
    );
  }

  async favoriteBrand(brandId: number): Promise<FavoriteBrandToggleResponse> {
    return this.request<FavoriteBrandToggleResponse>(
      `/users/me/favorite-brands/${brandId}`,
      { method: "PUT" },
      true
    );
  }

  async unfavoriteBrand(brandId: number): Promise<FavoriteBrandToggleResponse> {
    return this.request<FavoriteBrandToggleResponse>(
      `/users/me/favorite-brands/${brandId}`,
      { method: "DELETE" },
      true
    );
  }

  // ✅ Collaboration
  async regenerateClosetTokens(closetId: number): Promise<Closet> {
    return this.request<Closet>(`/closets/${closetId}/tokens/regenerate`, {
      method: "POST",
    }, true);
  }

  async joinCloset(token: string): Promise<Closet> {
    return this.request<Closet>(`/closets/join/${token}`, {
      method: "GET",
    }, true);
  }

  async removeCollaborator(closetId: number, userId: number): Promise<void> {
    return this.request<void>(`/closets/${closetId}/collaborators/${userId}`, {
      method: "DELETE",
    }, true);
  }

  async updateCollaboratorRole(closetId: number, userId: number, role: "viewer" | "editor"): Promise<void> {
    return this.request<void>(
      `/closets/${closetId}/collaborators/${userId}?role=${role}`,
      { method: "PATCH" },
      true
    );
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
