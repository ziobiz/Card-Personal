import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_BRAND, fetchPublicBrand, type BrandConfig } from '../api';
import { solutionSlugFromPath } from '../tenant';

const BrandContext = createContext<{ brand: BrandConfig; reload: () => void; slug: string }>({
  brand: DEFAULT_BRAND,
  reload: () => undefined,
  slug: '',
});

export function BrandProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const slug = solutionSlugFromPath(pathname);
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);

  const reload = () => {
    fetchPublicBrand(slug).then(setBrand).catch(() => undefined);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    const title = (brand.browserTitle || '').trim() || brand.productName;
    document.title = title;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (brand.favicon) link.href = brand.favicon;
    let apple = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (!apple) {
      apple = document.createElement('meta');
      apple.name = 'apple-mobile-web-app-title';
      document.head.appendChild(apple);
    }
    apple.content = title;
  }, [brand.productName, brand.browserTitle, brand.favicon]);

  const value = useMemo(() => ({ brand, reload, slug }), [brand, slug]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
