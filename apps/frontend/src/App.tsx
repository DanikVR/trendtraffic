/**
 * Корневой компонент приложения VibeVox.
 *
 * - HelmetProvider оборачивает дерево, чтобы SeoMeta мог менять <head>.
 * - RouterProvider держит роуты приложения.
 */

import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { router } from './router';
import { SeoMeta } from './components/SeoMeta';
import { LangPathSync } from './components/LangPathSync';
import { ReferralTracker } from './components/ReferralTracker';
import { ToastContainer } from './components/Toast';
import { SiteScripts } from './components/SiteScripts';

export default function App() {
  return (
    <HelmetProvider>
      <SiteScripts />
      <ReferralTracker />
      <LangPathSync />
      <SeoMeta />
      <RouterProvider router={router} />
      <ToastContainer />
    </HelmetProvider>
  );
}
