import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import ClosetsPage from './pages/ClosetsPage';
import ClosetDetails from './pages/ClosetDetails';
import About from './pages/About';
import PrivacyPolicy from './pages/PrivacyPolicy';
import NotFound from './pages/NotFound';

void React;

function App() {
  return (
    <Layout>
      <ScrollToTop />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/closets" element={<ClosetsPage />} />
          <Route path="/closets/:id" element={<ClosetDetails />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

export default App;
