import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_BRAND, fetchPublicBrand, type BrandConfig } from '../api';

const BrandContext = createContext<{ brand: BrandConfig; reload: () => void }>({
  brand: DEFAULT_BRAND,
  reload: () => undefined,
});

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);

  const reload = () => {
    fetchPublicBrand().then(setBrand).catch(() => undefined);
  };

  useEffect(() => {
    reload();
  }, []);

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

  const value = useMemo(() => ({ brand, reload }), [brand]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
