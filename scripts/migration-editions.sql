-- ===========================================
-- LP Edition Grouping Migration
-- ===========================================
-- 1. lp_products에 master_id 컬럼 추가
-- 2. lp_editions 테이블 생성
-- 3. lp_offers에 edition_id 컬럼 추가
-- ===========================================

-- Step 1: lp_products에 master_id 추가 (Discogs Master Release ID)
ALTER TABLE lp_products
ADD COLUMN IF NOT EXISTS master_id TEXT DEFAULT NULL;

-- master_id 인덱스
CREATE INDEX IF NOT EXISTS idx_lp_products_master_id ON lp_products (master_id);

-- Step 2: lp_editions 테이블 생성
CREATE TABLE IF NOT EXISTS lp_editions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES lp_products(id) ON DELETE CASCADE,
  discogs_id TEXT,               -- 개별 Release ID
  ean TEXT,                      -- 바코드
  label TEXT NOT NULL,           -- 에디션 라벨 ("초판", "컬러 (Purple)", "일본" 등)
  country TEXT,                  -- 발매 국가 (Korea, Japan, US 등)
  year INTEGER,                  -- 발매 연도
  format_detail TEXT,            -- 포맷 상세 ("180g", "2LP", "Limited Edition" 등)
  cover_url TEXT,                -- 에디션별 커버 이미지 (없으면 product의 cover 사용)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_lp_editions_product_id ON lp_editions (product_id);
CREATE INDEX IF NOT EXISTS idx_lp_editions_discogs_id ON lp_editions (discogs_id);
CREATE INDEX IF NOT EXISTS idx_lp_editions_ean ON lp_editions (ean);

-- Step 3: lp_offers에 edition_id 추가 (nullable, 기존 데이터 호환)
ALTER TABLE lp_offers
ADD COLUMN IF NOT EXISTS edition_id UUID DEFAULT NULL REFERENCES lp_editions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lp_offers_edition_id ON lp_offers (edition_id);

-- Step 4: RLS 정책 (lp_editions)
ALTER TABLE lp_editions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on lp_editions" ON lp_editions FOR SELECT USING (true);
CREATE POLICY "Allow service role all on lp_editions" ON lp_editions FOR ALL USING (true);
