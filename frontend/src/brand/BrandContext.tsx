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
    document.title = brand.productName;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (brand.favicon) link.href = brand.favicon;
  }, [brand.productName, brand.favicon]);

  const value = useMemo(() => ({ brand, reload, slug }), [brand, slug]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
