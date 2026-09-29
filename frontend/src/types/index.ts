export interface Product {
  id: number;
  productId?: number;
  variantId?: number;
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
  matchedVariantLabel?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  shippingAddress: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  parentId?: string;
}

export interface BrandWithImage {
  id: string;                   
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
