-- 1. lp_offers 테이블 보안 설정
ALTER TABLE lp_offers ENABLE ROW LEVEL SECURITY;

-- 2. 누구나 가격 정보를 볼 수 있도록 허용 (SELECT)
-- 기존 정책이 있다면 삭제 후 재생성 (충돌 방지)
DROP POLICY IF EXISTS "가격 정보 공개 조회" ON lp_offers;
CREATE POLICY "가격 정보 공개 조회" ON lp_offers 
FOR SELECT USING (true);

-- 3. 서비스 롤(관리자/스크립트)만 모든 권한 허용
DROP POLICY IF EXISTS "시스템 스크립트 전용 관리" ON lp_offers;
CREATE POLICY "시스템 스크립트 전용 관리" ON lp_offers 
FOR ALL TO service_role USING (true) WITH CHECK (true);


-- comments 테이블 보안 설정
-- (테이블이 없다면 생성을 시도하지 않고 오류가 날 수 있으므로 확인 필요)
-- 만약 테이블이 없다면 아래 주석을 해제하여 생성하세요.
-- CREATE TABLE IF NOT EXISTS comments ( ... );

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 누구나 댓글을 볼 수 있도록 허용
DROP POLICY IF EXISTS "댓글 공개 조회" ON comments;
CREATE POLICY "댓글 공개 조회" ON comments 
FOR SELECT USING (true);

-- 인증된 사용자 또는 시스템만 수정 가능하도록 설정
DROP POLICY IF EXISTS "시스템 전용 관리" ON comments;
CREATE POLICY "시스템 전용 관리" ON comments 
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 일반 사용자 댓글 작성 허용 (Author가 본인인 경우? 현재 익명/로컬스토리지 기반이라 별도 인증 없음)
-- 현재 로직 상 누구나 쓸 수 있어야 함 (service_role만 쓰기 가능하면 프론트에서 에러남)
-- 프론트엔드에서 직접 insert 하므로 public insert 허용 필요
DROP POLICY IF EXISTS "댓글 작성 허용" ON comments;
CREATE POLICY "댓글 작성 허용" ON comments 
FOR INSERT WITH CHECK (true);

-- 댓글 좋아요/수정 등은 RPC나 추가 정책 필요할 수 있음
-- 현재 코드는 insert만 프론트에서 하고, update는 없는듯? 좋아요는 RPC로 함.
-- 따라서 INSERT 정책 추가가 필수.
