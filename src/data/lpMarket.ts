export type InventorySignal = 'in-stock' | 'limited' | 'pre-order' | 'sold-out';

export interface LpVendorChannel {
  id: string;
  label: string;
  sampleSellers: string[];
  description: string;
  shippingTip: string;
  updateCadence: string;
  differentiator: string;
}

export interface LpOffer {
  id: string;
  vendorName: string;
  channelId: string;
  basePrice: number;
  currency: 'KRW';
  shippingFee: number;
  shippingPolicy: string;
  url: string;
  affiliateCode?: string;
  affiliateParamKey?: string;
  inStock: boolean;
  lastChecked: string;
  badge?: 'fresh' | 'lowest' | 'exclusive';
  notes?: string;
}

export interface PriceHistoryPoint {
  date: string;
  price: number;
}

export interface LpProduct {
  id: string;
  title: string;
  artist: string;
  cover: string;
  category: string;
  subCategory: string;
  color: string;
  colorVariants: string[];
  edition: string;
  editionVariants: string[];
  country: string;
  discogsId: string;
  barcode: string;
  tags: string[];
  rarityIndex: number;
  lpr: number;
  last30dChange: number;
  priceHistory: PriceHistoryPoint[];
  offers: LpOffer[];
  summary: string;
  pressingNotes: string;
  listeningNotes: string[];
  preferredSetups: string[];
  careTips: string[];
  inventoryStatus: InventorySignal;
  restockVendors: string[];
  priceFloorEstimate: number;
  priceCeilingEstimate: number;
  recommendedPairing: {
    turntable: string;
    cartridge: string;
    phonoStage: string;
  };
}

export interface LpCategoryNode {
  id: string;
  label: string;
  children: { id: string; label: string }[];
}

export const LP_VENDOR_CHANNELS: LpVendorChannel[] = [
  {
    id: 'mega-book',
    label: '대형 온라인 서점',
    sampleSellers: ['YES24', '알라딘', '교보문고', '인터파크'],
    description:
      '신보 입고가 빠르고 대량 재고를 보유해 초판/재발매를 가장 안정적으로 확보할 수 있는 채널입니다.',
    shippingTip: '5만원 이상 무료배송, 시즌별 청음/굿즈 번들 여부 꼭 확인.',
    updateCadence: '일 3회 재고 스캔 + 타임세일 모니터링',
    differentiator:
      '프로모션/회원등급 할인까지 겹치면 최저가가 자주 갱신되므로 자동 트래킹이 필수입니다.',
  },
  {
    id: 'indy-shop',
    label: '전문 레코드샵',
    sampleSellers: ['향뮤직', '김밥레코드', '마장뮤직앤픽쳐스'],
    description:
      '장르 특화 바잉을 진행하는 샵으로, 특정 레이블 단독 입고나 컬러 바이닐 한정판을 확보하기 좋습니다.',
    shippingTip: '기본 배송비 3,000원, 합배송 시 묶음 가능. 예약금 정책을 반드시 확인.',
    updateCadence: '입고 공지 즉시 푸시, SNS/뉴스레터 모니터링',
    differentiator:
      '샵별 한정 스탬프/굿즈가 있어 소장가치가 높고, 프리오더 변동이 심해 속도가 중요합니다.',
  },
  {
    id: 'pro-used',
    label: '중고 · 전문몰',
    sampleSellers: ['LP타운', 'LP25'],
    description:
      '절판된 초반, 중고 NM~VG+ 등급 LP를 찾기 좋은 채널로, 동일 타이틀이라도 컨디션별 가격 편차가 큽니다.',
    shippingTip: '상태별 가격차가 10배 이상이므로 골드마인 기준 이미지를 꼭 확인.',
    updateCadence: '일 1회 전체 스캔 + 알림 신청 고객 리스트 우선 푸시',
    differentiator:
      '희귀 매물 비중이 높아 재고 알림 기능과 가격 추적이 핵심 무기입니다.',
  },
  {
    id: 'omni-mall',
    label: '소셜 · 종합몰',
    sampleSellers: ['네이버 스마트스토어', '쿠팡', '11번가'],
    description:
      '쿠폰/카드 프로모션이 수시로 열려 특정 시점에 최저가가 형성되는 채널입니다.',
    shippingTip: '로켓/익일 배송 여부와 카드 청구할인 범위를 함께 표기.',
    updateCadence: '실시간 API 감시 + 가격 변동 1시간 이내 반영',
    differentiator:
      '빠른 배송과 쿠폰이 강점이므로 최종 결제 금액을 즉시 계산해 보여줘야 합니다.',
  },
  {
    id: 'naver-api',
    label: '네이버 쇼핑 검색',
    sampleSellers: ['네이버쇼핑 파트너'],
    description: '네이버 쇼핑 검색 API를 통해 수집된 다양한 판매처의 결과입니다.',
    shippingTip: '판매자별 상이, 상세 페이지 확인 필수.',
    updateCadence: '실시간 검색 API 연동',
    differentiator: '다양한 소규모 샵과 오픈마켓의 최저가를 한눈에 확인할 수 있습니다.',
  },
  {
    id: 'aladin-api',
    label: '알라딘 (API)',
    sampleSellers: ['알라딘'],
    description: '알라딘 Open API를 통해 실시간으로 조회된 상품 정보입니다.',
    shippingTip: '알라딘 배송 정책 (우주배송 등) 적용.',
    updateCadence: '실시간 검색 API 연동',
    differentiator: '알라딘의 방대한 신품/중고 재고를 직접 조회하여 정확도가 높습니다.',
  },
];

export const LP_CATEGORY_TREE: LpCategoryNode[] = [
  {
    id: 'lp',
    label: 'LP',
    children: [
      { id: 'classic-jazz', label: '재즈 클래식' },
      { id: 'modern-pop', label: '모던 팝' },
      { id: 'soundtrack', label: '사운드트랙' },
    ],
  },
  {
    id: 'turntable',
    label: '턴테이블',
    children: [
      { id: 'entry', label: '엔트리 레벨' },
      { id: 'mid', label: '미드 레인지' },
      { id: 'reference', label: '레퍼런스' },
    ],
  },
  {
    id: 'consumables',
    label: '소모품',
    children: [
      { id: 'stylus', label: '스타일러스' },
      { id: 'cleaner', label: '클리너' },
      { id: 'sleeve', label: '슬리브' },
    ],
  },
  {
    id: 'care',
    label: '관리용품',
    children: [
      { id: 'brush', label: '카본 브러시' },
      { id: 'fluid', label: '세척액' },
      { id: 'mat', label: '턴테이블 매트' },
    ],
  },
];

// 더미 데이터 제거 - 실제 데이터는 Supabase에서 가져옴
export const DEFAULT_LP_PRODUCTS: LpProduct[] = [];

export const LP_FILTER_DIMENSIONS = {
  colors: ['All', 'Black', 'Color Vinyl', 'Azure Blue'],
  editions: ['All', 'Remastered', 'Half-Speed Mastered', 'Original Pressing'],
  countries: ['All', 'US Press', 'EU Press', '국내 라이선스'],
};

export const currencyFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

export const formatCurrency = (value: number) =>
  currencyFormatter.format(Math.round(value));

export const calculateOfferFinalPrice = (offer: LpOffer) =>
  offer.basePrice + (offer.shippingFee || 0);

export const buildAffiliateUrl = (offer: LpOffer) => {
  if (!offer.affiliateCode) {
    return offer.url;
  }

  try {
    const url = new URL(offer.url);
    const key = offer.affiliateParamKey || 'aff_id';
    url.searchParams.set(key, offer.affiliateCode);
    return url.toString();
  } catch {
    const separator = offer.url.includes('?') ? '&' : '?';
    return `${offer.url}${separator}${offer.affiliateParamKey || 'aff_id'}=${offer.affiliateCode
      }`;
  }
};

export const getChannelById = (id: string) =>
  LP_VENDOR_CHANNELS.find((channel) => channel.id === id);


