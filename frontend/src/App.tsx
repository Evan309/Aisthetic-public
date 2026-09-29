import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ClosetsPage from "./pages/ClosetsPage";
import ClosetDetailPage from "./pages/ClosetDetailPage";
import AboutPage from "./pages/AboutPage";
import CuratedClosetDetailPage from "./pages/CuratedClosetDetailPage";
import BrandsPage from "./pages/BrandsPage";
import BrandDetailPage from "./pages/BrandDetailPage";
import AuthCallback from "./pages/AuthCallback";
import AccountsPage from "./pages/AccountsPage";
import JoinClosetPage from "./pages/JoinClosetPage";

import { useEffect } from "react";
import { restoreScrollIfNeeded } from "./components/AuthButtons";
import ScrollToTop from "./components/ScrollToTop";


function App() {
  useEffect(() => {
    restoreScrollIfNeeded();
  }, []);

  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:productid" element={<ProductDetailPage />} />
          <Route path="closets" element={<ClosetsPage />} />
          <Route path="closets/:closetId" element={<ClosetDetailPage />} />
          <Route path="join/:token" element={<JoinClosetPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="brands" element={<BrandsPage />} />
          <Route path="/brands/:brandId" element={<BrandDetailPage />} />
          <Route path="/curated-closets/:curatedClosetId" element={<CuratedClosetDetailPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="account" element={<AccountsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
