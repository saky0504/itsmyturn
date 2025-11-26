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

export const DEFAULT_LP_PRODUCTS: LpProduct[] = [
  {
    id: 'kind-of-blue-legacy-uhqr',
    title: 'Miles Davis – Kind of Blue (2024 Legacy Remaster 180g)',
    artist: 'Miles Davis',
    cover:
      'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&auto=format&fit=crop',
    category: 'LP',
    subCategory: 'classic-jazz',
    color: 'Black',
    colorVariants: ['Black', 'Azure Blue'],
    edition: 'Remastered',
    editionVariants: ['Remastered', 'Half-Speed Mastered', 'Original Pressing'],
    country: 'US Press',
    discogsId: '24950446',
    barcode: '0194398665212',
    tags: ['Mono Transfer', 'Legacy 75', '180g'],
    rarityIndex: 0.74,
    lpr: 0.16,
    last30dChange: -0.05,
    priceFloorEstimate: 52000,
    priceCeilingEstimate: 78000,
    priceHistory: [
      { date: '2024-10-01', price: 64000 },
      { date: '2024-10-15', price: 62000 },
      { date: '2024-11-01', price: 61000 },
      { date: '2024-11-15', price: 60000 },
      { date: '2024-12-01', price: 63000 },
      { date: '2024-12-15', price: 61000 },
      { date: '2025-01-01', price: 59500 },
      { date: '2025-01-15', price: 59000 },
    ],
    offers: [
      {
        id: 'yes24-kindofblue',
        vendorName: 'YES24',
        channelId: 'mega-book',
        basePrice: 59000,
        currency: 'KRW',
        shippingFee: 0,
        shippingPolicy: '5만원 이상 무료배송 / T멤버십 10% 추가 할인',
        url: 'https://www.yes24.com/Product/Goods/117901377',
        affiliateCode: 'itsmyturn',
        affiliateParamKey: 'Acode',
        inStock: true,
        lastChecked: '2025-01-26T08:30:00+09:00',
        badge: 'lowest',
        notes: '한정 포스터 포함, 1인 2장 제한',
      },
      {
        id: 'hyang-kindofblue',
        vendorName: '향뮤직',
        channelId: 'indy-shop',
        basePrice: 72000,
        currency: 'KRW',
        shippingFee: 3000,
        shippingPolicy: '7만원 이상 무료배송 / 매장 픽업 가능',
        url: 'https://www.hyangmusic.com/?page=product&prod_id=50901',
        affiliateCode: 'cursor-track',
        affiliateParamKey: 'ref',
        inStock: true,
        lastChecked: '2025-01-26T07:55:00+09:00',
        badge: 'exclusive',
        notes: 'Azure Blue 컬러 바이닐, 넘버링 카드',
      },
      {
        id: 'lptown-kindofblue',
        vendorName: 'LP타운 (NM)',
        channelId: 'pro-used',
        basePrice: 68000,
        currency: 'KRW',
        shippingFee: 3500,
        shippingPolicy: '중고 상품 – 상태 사진 필수 확인',
        url: 'https://www.lptown.co.kr/product/detail.html?product_no=18503',
        affiliateCode: 'imt-vinyl',
        inStock: false,
        lastChecked: '2025-01-25T20:10:00+09:00',
        notes: '미개봉 보관, 폴리슬리브 포함',
      },
      {
        id: 'smartstore-kindofblue',
        vendorName: '네이버 스마트스토어 (로켓배송)',
        channelId: 'omni-mall',
        basePrice: 61000,
        currency: 'KRW',
        shippingFee: 0,
        shippingPolicy: '로켓배송 / 카드 청구할인 7% 적용 시 56730원',
        url: 'https://smartstore.naver.com/vinylwave/products/7755012391',
        affiliateCode: 'itsmyturn',
        affiliateParamKey: 'trackingId',
        inStock: true,
        lastChecked: '2025-01-26T09:00:00+09:00',
        badge: 'fresh',
        notes: '쿠폰팩 + 네이버페이 적립 5%',
      },
    ],
    summary:
      'Miles Davis의 대표작을 2024년 Legacy 75주년 사양으로 리마스터링한 180g 아날로그 음반. 노이즈 플로어가 낮고 브라스의 질감이 살아난 최신 커팅입니다.',
    pressingNotes:
      'Bernie Grundman이 AAA 체인으로 리컷, Optimal Media 프레스. 런아웃에 BG 각인 확인 가능.',
    listeningNotes: [
      'Blue In Green에서의 잔향이 길고 피아노 레벨이 기존 대비 +1.5dB 상승.',
      'So What 베이스 라인이 한층 탄력적으로 들림.',
    ],
    preferredSetups: [
      'Technics SL-1200GR + Ortofon 2M Bronze + Luxman EQ-500',
      'Rega Planar 6 + Ania Pro MC + Rega Aria',
    ],
    careTips: [
      '첫 재생 전 초음파 세척 권장 (모바일 제휴 B.A.S 연동 예정)',
      'RTI 프레스 특성상 스태틱이 높으므로 카본 브러시 2회 권장',
    ],
    inventoryStatus: 'in-stock',
    restockVendors: ['indy-shop', 'pro-used'],
    recommendedPairing: {
      turntable: 'Technics SL-1200GR2',
      cartridge: 'Audio-Technica AT-OC9XSL (MC)',
      phonoStage: 'McIntosh MP100',
    },
  },
];

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
    return `${offer.url}${separator}${offer.affiliateParamKey || 'aff_id'}=${
      offer.affiliateCode
    }`;
  }
};

export const getChannelById = (id: string) =>
  LP_VENDOR_CHANNELS.find((channel) => channel.id === id);


