import { DEFAULT_LP_PRODUCTS, type LpProduct } from '../data/lpMarket';

const STORAGE_KEY = 'itsmyturn:lp-market-products';
const isBrowser = typeof window !== 'undefined';

const cloneProducts = (products: LpProduct[]): LpProduct[] =>
  JSON.parse(JSON.stringify(products));

const mergeWithDefaults = (stored: LpProduct[] | null): LpProduct[] => {
  const safeStored = stored ? cloneProducts(stored) : [];
  const storedMap = new Map(safeStored.map((product) => [product.id, product]));

  const merged = DEFAULT_LP_PRODUCTS.map((defaultProduct) => {
    const storedProduct = storedMap.get(defaultProduct.id);
    if (!storedProduct) {
      return { ...defaultProduct };
    }

    return {
      ...defaultProduct,
      ...storedProduct,
      offers:
        storedProduct.offers && storedProduct.offers.length > 0
          ? storedProduct.offers
          : defaultProduct.offers,
      priceHistory:
        storedProduct.priceHistory && storedProduct.priceHistory.length > 0
          ? storedProduct.priceHistory
          : defaultProduct.priceHistory,
      colorVariants: storedProduct.colorVariants || defaultProduct.colorVariants,
      editionVariants:
        storedProduct.editionVariants || defaultProduct.editionVariants,
      restockVendors: storedProduct.restockVendors || defaultProduct.restockVendors,
    };
  });

  safeStored.forEach((product) => {
    const exists = merged.some((mergedProduct) => mergedProduct.id === product.id);
    if (!exists) {
      merged.push(product);
    }
  });

  return merged;
};

export const getDefaultProducts = (): LpProduct[] =>
  cloneProducts(DEFAULT_LP_PRODUCTS);

export const loadProducts = (): LpProduct[] => {
  if (!isBrowser) {
    return getDefaultProducts();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return getDefaultProducts();
  }

  try {
    const parsed = JSON.parse(raw) as LpProduct[];
    return mergeWithDefaults(parsed);
  } catch {
    return getDefaultProducts();
  }
};

export const saveProducts = (products: LpProduct[]) => {
  if (!isBrowser) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
};

export const upsertProduct = (product: LpProduct) => {
  const products = loadProducts();
  const index = products.findIndex((item) => item.id === product.id);
  if (index === -1) {
    products.push(product);
  } else {
    products[index] = product;
  }
  saveProducts(products);
  return products;
};

export const deleteProduct = (id: string) => {
  const products = loadProducts().filter((product) => product.id !== id);
  saveProducts(products);
  return products;
};




