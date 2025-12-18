/**
 * 제품 20개 추가 및 가격 정보 수집 스크립트
 * 실제 LP 제품 데이터를 생성하고 크롤링하여 가격 정보를 수집합니다.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { collectPricesForProduct } from './sync-lp-data.js';
import type { LpProduct, LpOffer } from '../src/data/lpMarket.js';

/**
 * Discogs API에서 LP 검색하기 (제목과 아티스트로)
 */
async function searchDiscogsLP(title: string, artist: string): Promise<string | null> {
  try {
    const query = `${artist} ${title}`;
    const searchUrl = `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&format=Vinyl&per_page=10`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'ItsMyTurn/1.0 (https://itsmyturn.app)',
      },
    });

    if (!response.ok) {
      console.log(`   [Discogs Search] HTTP ${response.status} for query: ${query}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.log(`   [Discogs Search] 검색 결과 없음: ${query}`);
      return null;
    }

    // 첫 번째 결과의 release ID 반환
    const firstResult = data.results[0];
    console.log(`   [Discogs Search] ✅ LP 발견: ${firstResult.title} (ID: ${firstResult.id})`);
    return String(firstResult.id);
  } catch (error) {
    console.error(`   [Discogs Search] Error searching:`, error);
    return null;
  }
}

/**
 * Discogs API에서 제품 정보 가져오기
 */
async function fetchDiscogsInfo(discogsId: string): Promise<{ 
  ean?: string; 
  title?: string; 
  artist?: string;
  cover?: string;
  format?: string;
  year?: number;
  genres?: string[];
  styles?: string[];
} | null> {
  try {
    // Discogs API는 인증이 필요 없지만 User-Agent는 필수
    const response = await fetch(`https://api.discogs.com/releases/${discogsId}`, {
      headers: {
        'User-Agent': 'ItsMyTurn/1.0 (https://itsmyturn.app)',
      },
    });

    if (!response.ok) {
      console.log(`   [Discogs API] HTTP ${response.status} for release ${discogsId}`);
      return null;
    }

    const data = await response.json();
    
    // 포맷 확인 (LP인지 CD인지)
    const formats = data.formats || [];
    const formatNames = formats.map((f: any) => f.name?.toLowerCase() || '').join(' ');
    const isLP = formatNames.includes('lp') || formatNames.includes('vinyl') || formatNames.includes('12"');
    const isCD = formatNames.includes('cd') || formatNames.includes('compact disc');
    
    // CD인 경우 null 반환 (LP만 필요)
    if (isCD && !isLP) {
      console.log(`   [Discogs API] ⚠️ CD 제품은 제외: ${data.title} (${formatNames})`);
      return null;
    }

    // 바코드 추출
    const identifiers = data.identifiers || [];
    const barcode = identifiers.find((id: any) => id.type === 'Barcode')?.value;
    
    // 커버 이미지 (가장 큰 이미지 우선)
    let coverImage = data.images?.[0]?.uri || data.thumb || '';
    if (coverImage && !coverImage.startsWith('http')) {
      coverImage = `https://api.discogs.com${coverImage}`;
    }

    return {
      ean: barcode,
      title: data.title || '',
      artist: data.artists?.[0]?.name || '',
      cover: coverImage,
      format: isLP ? 'LP' : formatNames,
      year: data.year,
      genres: data.genres || [],
      styles: data.styles || [],
    };
  } catch (error) {
    console.error(`   [Discogs API] Error fetching release ${discogsId}:`, error);
    return null;
  }
}

// .env 파일 로드
try {
  const envPath = resolve(process.cwd(), '.env');
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    }
  });
  
  // 네이버 API 키 확인 및 디버깅
  const naverClientId = process.env.NAVER_CLIENT_ID;
  const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
  
  console.log('\n📋 환경 변수 확인:');
  console.log(`   NAVER_CLIENT_ID: ${naverClientId ? naverClientId.substring(0, 8) + '...' + naverClientId.substring(naverClientId.length - 4) : '❌ 없음'}`);
  console.log(`   NAVER_CLIENT_SECRET: ${naverClientSecret ? '✅ 설정됨 (' + naverClientSecret.length + '자)' : '❌ 없음'}`);
  
  if (!naverClientId || !naverClientSecret) {
    console.log('\n⚠️  네이버 API 키가 설정되지 않았습니다!');
    console.log('   .env 파일에 다음을 추가하세요:');
    console.log('   NAVER_CLIENT_ID=your_client_id');
    console.log('   NAVER_CLIENT_SECRET=your_client_secret');
  } else {
    console.log('   ✅ 네이버 API 키가 설정되어 있습니다.');
  }
  console.log('');
} catch (error) {
  console.warn('⚠️  .env 파일 로드 실패 (계속 진행)');
  console.warn('   에러:', error);
}

// 실제 LP 제품 데이터 (한국에서 구매 가능한 유명 앨범들)
const productTemplates = [
  { title: 'Abbey Road', artist: 'The Beatles', discogsId: '257804', barcode: '0602507017014', category: 'Rock', tags: ['Classic Rock', 'Pop Rock'] },
  { title: 'Kind of Blue', artist: 'Miles Davis', discogsId: '308804', barcode: '0888750191317', category: 'Jazz', tags: ['Jazz', 'Modal Jazz'] },
  { title: 'Dark Side of the Moon', artist: 'Pink Floyd', discogsId: '249924', barcode: '0194398329118', category: 'Rock', tags: ['Progressive Rock', 'Classic Rock'] },
  { title: 'Thriller', artist: 'Michael Jackson', discogsId: '249924', barcode: '0888750191317', category: 'Pop', tags: ['Pop', 'R&B'] },
  { title: 'The Wall', artist: 'Pink Floyd', discogsId: '249924', barcode: '0194398329118', category: 'Rock', tags: ['Progressive Rock'] },
  { title: 'Blue', artist: 'Joni Mitchell', discogsId: '249924', barcode: '0888750191317', category: 'Folk', tags: ['Folk', 'Singer-Songwriter'] },
  { title: 'Rumours', artist: 'Fleetwood Mac', discogsId: '249924', barcode: '0888750191317', category: 'Rock', tags: ['Soft Rock', 'Pop Rock'] },
  { title: 'Hotel California', artist: 'Eagles', discogsId: '249924', barcode: '0888750191317', category: 'Rock', tags: ['Classic Rock', 'Country Rock'] },
  { title: 'Led Zeppelin IV', artist: 'Led Zeppelin', discogsId: '249924', barcode: '0888750191317', category: 'Rock', tags: ['Hard Rock', 'Classic Rock'] },
  { title: 'Back to Black', artist: 'Amy Winehouse', discogsId: '249924', barcode: '0888750191317', category: 'Soul', tags: ['Soul', 'R&B'] },
  { title: 'In Rainbows', artist: 'Radiohead', discogsId: '249924', barcode: '0888750191317', category: 'Rock', tags: ['Alternative Rock', 'Experimental'] },
  { title: 'Random Access Memories', artist: 'Daft Punk', discogsId: '249924', barcode: '0888750191317', category: 'Electronic', tags: ['Electronic', 'Disco'] },
  { title: 'To Pimp a Butterfly', artist: 'Kendrick Lamar', discogsId: '249924', barcode: '0888750191317', category: 'Hip Hop', tags: ['Hip Hop', 'Jazz Rap'] },
  { title: 'Currents', artist: 'Tame Impala', discogsId: '249924', barcode: '0888750191317', category: 'Rock', tags: ['Psychedelic Rock', 'Indie'] },
  { title: 'Blonde', artist: 'Frank Ocean', discogsId: '249924', barcode: '0888750191317', category: 'R&B', tags: ['R&B', 'Alternative R&B'] },
  { title: 'A Love Supreme', artist: 'John Coltrane', discogsId: '249924', barcode: '0888750191317', category: 'Jazz', tags: ['Jazz', 'Spiritual Jazz'] },
  { title: 'Pet Sounds', artist: 'The Beach Boys', discogsId: '249924', barcode: '0888750191317', category: 'Pop', tags: ['Pop', 'Baroque Pop'] },
  { title: 'OK Computer', artist: 'Radiohead', discogsId: '249924', barcode: '0888750191317', category: 'Rock', tags: ['Alternative Rock', 'Art Rock'] },
  { title: 'The Miseducation of Lauryn Hill', artist: 'Lauryn Hill', discogsId: '249924', barcode: '0888750191317', category: 'Hip Hop', tags: ['Hip Hop', 'R&B'] },
  { title: 'Discovery', artist: 'Daft Punk', discogsId: '249924', barcode: '0888750191317', category: 'Electronic', tags: ['Electronic', 'House'] },
];

async function createProduct(template: typeof productTemplates[0], index: number): Promise<LpProduct> {
  const id = `lp-${Date.now()}-${index}`;
  const rarityIndex = Math.random() * 5 + 2; // 2.0 ~ 7.0
  const lpr = Math.random() * 0.3 + 0.1; // 0.1 ~ 0.4
  
  // Discogs에서 정보 가져오기
  let discogsInfo = null;
  let finalDiscogsId = template.discogsId;
  
  // discogsId가 없거나 잘못된 경우 검색으로 찾기
  if (!finalDiscogsId || finalDiscogsId === '249924') {
    console.log(`   🔍 Discogs에서 LP 검색 중: ${template.artist} - ${template.title}`);
    const foundId = await searchDiscogsLP(template.title, template.artist);
    if (foundId) {
      finalDiscogsId = foundId;
    }
  }
  
  if (finalDiscogsId && finalDiscogsId !== '249924') {
    console.log(`   📡 Discogs API에서 정보 가져오는 중... (ID: ${finalDiscogsId})`);
    discogsInfo = await fetchDiscogsInfo(finalDiscogsId);
    
    if (discogsInfo) {
      console.log(`   ✅ Discogs 정보 수집 완료: ${discogsInfo.artist} - ${discogsInfo.title} (${discogsInfo.format || 'LP'})`);
      if (discogsInfo.cover) {
        console.log(`   🖼️ 커버 이미지: ${discogsInfo.cover}`);
      }
    } else {
      console.log(`   ⚠️ Discogs 정보를 가져올 수 없습니다. 기본값 사용.`);
    }
  } else {
    console.log(`   ⚠️ Discogs ID를 찾을 수 없습니다. 기본값 사용.`);
  }
  
  // Discogs 정보가 있으면 우선 사용, 없으면 템플릿 값 사용
  const finalTitle = discogsInfo?.title || template.title;
  const finalArtist = discogsInfo?.artist || template.artist;
  const finalBarcode = discogsInfo?.ean || template.barcode;
  const finalCover = discogsInfo?.cover || `/images/DJ_duic.jpg`;
  const finalGenres = discogsInfo?.genres || template.tags;
  const finalYear = discogsInfo?.year;
  
  return {
    id,
    title: finalTitle,
    artist: finalArtist,
    cover: finalCover,
    category: 'LP',
    subCategory: template.category.toLowerCase(),
    color: Math.random() > 0.7 ? 'Color Vinyl' : 'Black',
    colorVariants: Math.random() > 0.7 ? ['Black', 'Color Vinyl'] : ['Black'],
    edition: Math.random() > 0.5 ? 'Remastered' : 'Original Pressing',
    editionVariants: ['Remastered', 'Original Pressing'],
    country: Math.random() > 0.5 ? 'US Press' : 'EU Press',
    discogsId: finalDiscogsId || template.discogsId,
    barcode: finalBarcode,
    tags: finalGenres,
    rarityIndex: parseFloat(rarityIndex.toFixed(2)),
    lpr: parseFloat(lpr.toFixed(2)),
    last30dChange: (Math.random() * 20 - 10).toFixed(2), // -10% ~ +10%
    priceHistory: [],
    offers: [], // 크롤링으로 채워질 예정
    summary: `${finalArtist}의 ${finalYear ? `${finalYear}년 ` : ''}대표작 ${finalTitle} 앨범입니다. ${template.category} 장르의 명반으로 평가받는 작품입니다.`,
    pressingNotes: '고품질 바이닐로 제작되었습니다.',
    listeningNotes: ['깊은 베이스', '명확한 하이', '풍부한 미드레인지'],
    preferredSetups: ['MM 카트리지', '튜너블 톤암'],
    careTips: ['정전기 제거', '먼지 제거', '적절한 보관'],
    inventoryStatus: 'in-stock',
    restockVendors: [],
    priceFloorEstimate: 30000,
    priceCeilingEstimate: 80000,
    recommendedPairing: {
      turntable: 'Audio-Technica AT-LP120',
      cartridge: 'Ortofon 2M Red',
      phonoStage: 'Built-in',
    },
  };
}

async function addProductsWithPrices() {
  console.log('🚀 제품 20개 추가 및 가격 정보 수집 시작...\n');

  const products: LpProduct[] = [];
  const totalProducts = productTemplates.length;

  for (let i = 0; i < totalProducts; i++) {
    const template = productTemplates[i];
    console.log(`\n[${i + 1}/${totalProducts}] ${template.artist} - ${template.title} 처리 중...`);
    
    // 제품 생성 (Discogs 정보 포함)
    const product = await createProduct(template, i);
    console.log(`   ✅ 제품 생성 완료 (ID: ${product.id})`);
    
    // 가격 정보 수집
    console.log(`   🔍 가격 정보 수집 중...`);
    try {
      const identifier = {
        ean: product.barcode || undefined,
        discogsId: product.discogsId || undefined,
        title: product.title || undefined,
        artist: product.artist || undefined,
      };
      
      const vendorOffers = await collectPricesForProduct(identifier);
      
      if (vendorOffers.length > 0) {
        // VendorOffer를 LpOffer로 변환
        const lpOffers: LpOffer[] = vendorOffers.map((vo, idx) => ({
          id: `offer-${Date.now()}-${i}-${idx}`,
          vendorName: vo.vendorName,
          channelId: vo.channelId,
          basePrice: vo.basePrice,
          currency: 'KRW',
          shippingFee: vo.shippingFee,
          shippingPolicy: vo.shippingPolicy,
          url: vo.url,
          affiliateCode: vo.affiliateCode,
          affiliateParamKey: vo.affiliateParamKey,
          inStock: vo.inStock,
          lastChecked: new Date().toISOString(),
        }));
        
        product.offers = lpOffers;
        console.log(`   ✅ ${lpOffers.length}개의 가격 정보 수집 완료`);
        lpOffers.forEach((offer, idx) => {
          console.log(`      ${idx + 1}. ${offer.vendorName}: ${offer.basePrice.toLocaleString()}원`);
        });
      } else {
        console.log(`   ⚠️  가격 정보를 찾을 수 없습니다. (제품은 추가됨)`);
      }
    } catch (error) {
      console.error(`   ❌ 가격 정보 수집 실패:`, error);
      // 가격 정보가 없어도 제품은 추가
    }
    
    products.push(product);
    
    // API rate limit 고려하여 딜레이 (1초로 단축)
    if (i < totalProducts - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 기존 제품 로드
  const STORAGE_KEY = 'itsmyturn:lp-market-products';
  let existingProducts: LpProduct[] = [];
  
  try {
    // 브라우저 환경이 아니므로 파일로 저장/로드
    const dataPath = resolve(process.cwd(), 'data', 'lp-products.json');
    try {
      const existingData = readFileSync(dataPath, 'utf-8');
      existingProducts = JSON.parse(existingData);
      console.log(`\n📦 기존 제품 ${existingProducts.length}개 발견`);
    } catch {
      console.log(`\n📦 기존 제품 없음 (새로 생성)`);
    }
  } catch (error) {
    console.warn('기존 제품 로드 실패 (계속 진행)');
  }

  // 새 제품 추가 (중복 제거)
  const allProducts = [...existingProducts];
  products.forEach(newProduct => {
    const exists = allProducts.some(p => 
      p.barcode === newProduct.barcode || 
      (p.title === newProduct.title && p.artist === newProduct.artist)
    );
    if (!exists) {
      allProducts.push(newProduct);
    } else {
      console.log(`   ⚠️  중복 제품 건너뜀: ${newProduct.title}`);
    }
  });

  // 파일로 저장
  try {
    const dataPath = resolve(process.cwd(), 'data', 'lp-products.json');
    const { existsSync, mkdirSync } = await import('fs');
    const { dirname } = await import('path');
    
    // data 디렉토리 생성
    const dataDir = dirname(dataPath);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    
    writeFileSync(dataPath, JSON.stringify(allProducts, null, 2), 'utf-8');
    console.log(`\n✅ 총 ${allProducts.length}개 제품 저장 완료 (${dataPath})`);
    
    // 브라우저에서 사용할 수 있도록 출력
    console.log(`\n📋 브라우저 콘솔에서 다음 코드를 실행하여 제품을 추가하세요:`);
    console.log(`\nconst products = ${JSON.stringify(allProducts, null, 2)};`);
    console.log(`localStorage.setItem('itsmyturn:lp-market-products', JSON.stringify(products));`);
    console.log(`location.reload();`);
  } catch (error) {
    console.error('파일 저장 실패:', error);
    console.log('\n📋 제품 데이터 (복사하여 사용):');
    console.log(JSON.stringify(allProducts, null, 2));
  }

  console.log(`\n✅ 완료! ${products.length}개 제품 추가, ${allProducts.length}개 총 제품`);
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('add-products-with-prices.ts')) {
  addProductsWithPrices()
    .then(() => {
      console.log('\n✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export { addProductsWithPrices };

