import { lazy, Suspense } from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import Home from "./pages/Home";

const Shop = lazy(() => import("./pages/Shop"));
const Product = lazy(() => import("./pages/Product"));
const Studio = lazy(() => import("./pages/Studio"));
const Looks = lazy(() => import("./pages/Looks"));

export default function App() {
  const { pathname } = useLocation();
  return (
    <Layout>
      <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
        <div className="route" key={pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop/:cat" element={<Shop />} />
          <Route path="/p/:slug" element={<Product />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/looks" element={<Looks />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </Suspense>
    </Layout>
  );
}
