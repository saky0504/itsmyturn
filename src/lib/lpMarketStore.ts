import { DEFAULT_LP_PRODUCTS, type LpProduct } from '../data/lpMarket';

const STORAGE_KEY = 'itsmyturn:lp-market-products';
const isBrowser = typeof window !== 'undefined';

const cloneProducts = (products: LpProduct[]): LpProduct[] =>
  JSON.parse(JSON.stringify(products));

const mergeWithDefaults = (stored: LpProduct[] | null): LpProduct[] => {
  // 더미 데이터 제거 - 실제 데이터만 사용
  const safeStored = stored ? cloneProducts(stored) : [];
  
  // 더미 데이터와 병합하지 않고 저장된 데이터만 반환
  return safeStored;
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

// JSON 파일에서 제품 로드 (비동기)
export const loadProductsFromJSON = async (): Promise<LpProduct[]> => {
  if (!isBrowser) {
    return getDefaultProducts();
  }

  try {
    const response = await fetch('/data/lp-products.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const jsonProducts = await response.json();
    if (jsonProducts && jsonProducts.length > 0) {
      // localStorage에 저장
      saveProducts(jsonProducts);
      return mergeWithDefaults(jsonProducts);
    }
  } catch (error) {
    console.warn('JSON 파일 로드 실패:', error);
  }
  
  // 실패 시 기존 localStorage 데이터 반환
  return loadProducts();
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





