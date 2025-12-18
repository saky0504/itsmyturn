-- LP 마켓 데이터베이스 스키마 (Refined Version)
-- Supabase SQL Editor에서 실행하세요

-- 확장 기능 활성화 (Fuzzy Search & UUID)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 0. 기존 테이블 삭제 (스키마 초기화)
DROP TABLE IF EXISTS lp_offers CASCADE;
DROP TABLE IF EXISTS lp_products CASCADE;

-- 1. LP 상품 정보 테이블 (Master Catalog)
-- 전역 상품 카탈로그이므로 auth.uid() 대신 UUID/DiscogsID를 사용합니다.
CREATE TABLE IF NOT EXISTS lp_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ean TEXT, -- 바코드 (식별자, Nullable)
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  release_date TEXT, -- YYYY-MM-DD 형식이 아닐 수도 있어서 TEXT 권장
  label TEXT,
  cover TEXT, -- 썸네일 URL
  thumbnail_url TEXT, -- 작은 썸네일 (Optional)
  format TEXT, -- LP, Vinyl, etc.
  genres TEXT[], -- 장르 배열
  styles TEXT[], -- 스타일 배열
  track_list JSONB, -- 트랙 정보 (JSON)
  discogs_id TEXT UNIQUE, -- 중복 방지용 핵심 키
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);

-- 2. 쇼핑몰별 가격 제안 테이블 (Real-time Offers)
CREATE TABLE IF NOT EXISTS lp_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES lp_products(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL, -- 예: 'Yes24', 'Aladdin'
  channel_id TEXT NOT NULL, -- 내부 관리용 ID (예: 'mega-book')
  price INTEGER NOT NULL, -- 현재 판매가
  base_price INTEGER, -- 정가 (Optional)
  currency TEXT NOT NULL DEFAULT 'KRW',
  shipping_fee INTEGER DEFAULT 0,
  shipping_policy TEXT, -- 예: '5만원 이상 무료'
  url TEXT NOT NULL, -- 구매 링크
  affiliate_url TEXT, -- 수익화 링크
  is_stock_available BOOLEAN DEFAULT true,
  badge TEXT CHECK (badge IN ('fresh', 'lowest', 'exclusive', 'best')),
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 검색 및 성능 최적화 인덱스
-- 바코드 및 식별자 검색
CREATE INDEX IF NOT EXISTS idx_lp_products_ean ON lp_products(ean);
CREATE INDEX IF NOT EXISTS idx_lp_products_discogs_id ON lp_products(discogs_id);

-- Fuzzy Search (유사 검색) - 제목 + 아티스트
-- pg_trgm GIN 인덱스를 사용하여 LIKE 검색보다 훨씬 빠르고 정확한 검색 지원
CREATE INDEX IF NOT EXISTS idx_lp_products_title_trgm ON lp_products USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lp_products_artist_trgm ON lp_products USING gin (artist gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lp_products_search_composite ON lp_products USING gin ((title || ' ' || artist) gin_trgm_ops);

-- 필터링 및 조인 최적화
CREATE INDEX IF NOT EXISTS idx_lp_offers_product_id ON lp_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_lp_offers_vendor ON lp_offers(vendor_name);
CREATE INDEX IF NOT EXISTS idx_lp_offers_price ON lp_offers(price);

-- 4. 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lp_products_timestamp
  BEFORE UPDATE ON lp_products
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_lp_offers_timestamp
  BEFORE UPDATE ON lp_offers
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- 5. 보안 정책 (RLS)
ALTER TABLE lp_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE lp_offers ENABLE ROW LEVEL SECURITY;

-- 읽기는 모두 허용
CREATE POLICY "Public Read Access Products" ON lp_products FOR SELECT USING (true);
CREATE POLICY "Public Read Access Offers" ON lp_offers FOR SELECT USING (true);

-- 쓰기는 Service Role (Backend API)만 허용
CREATE POLICY "Service Role Write Products" ON lp_products 
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Write Offers" ON lp_offers 
  FOR ALL USING (auth.role() = 'service_role');
