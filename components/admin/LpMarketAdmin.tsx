import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import type { LpOffer, LpProduct } from '../../src/data/lpMarket';
import {
  LP_VENDOR_CHANNELS,
  DEFAULT_LP_PRODUCTS,
  calculateOfferFinalPrice,
  formatCurrency,
} from '../../src/data/lpMarket';
import { useLpProducts } from '../../src/hooks/useLpProducts';

const emptyOffer = (): LpOffer => ({
  id: `offer-${Date.now()}`,
  vendorName: '',
  channelId: 'mega-book',
  basePrice: 0,
  currency: 'KRW',
  shippingFee: 0,
  shippingPolicy: '',
  url: '',
  affiliateCode: '',
  affiliateParamKey: 'aff_id',
  inStock: true,
  lastChecked: new Date().toISOString(),
});

const createBlankProduct = (): LpProduct => {
  const template = DEFAULT_LP_PRODUCTS[0];
  return {
    ...template,
    id: `lp-${Date.now()}`,
    title: '',
    artist: '',
    discogsId: '',
    barcode: '',
    color: 'Black',
    colorVariants: ['Black'],
    edition: 'Remastered',
    editionVariants: ['Remastered'],
    country: 'US Press',
    summary: '',
    pressingNotes: '',
    listeningNotes: [],
    preferredSetups: [],
    careTips: [],
    priceHistory: [],
    offers: [emptyOffer()],
    tags: [],
  };
};

export function LpMarketAdmin() {
  const { products, isReady, updateProducts } = useLpProducts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LpProduct>(createBlankProduct());

  useEffect(() => {
    if (isReady && products.length > 0 && !selectedId) {
      setSelectedId(products[0].id);
    }
  }, [isReady, products, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const product = products.find((item) => item.id === selectedId);
    if (product) {
      setDraft(JSON.parse(JSON.stringify(product)));
    }
  }, [selectedId, products]);

  const handleFieldChange = (field: keyof LpProduct, value: unknown) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleOfferChange = (index: number, field: keyof LpOffer, value: unknown) => {
    setDraft((prev) => {
      const offers = [...prev.offers];
      offers[index] = { ...offers[index], [field]: value };
      return { ...prev, offers };
    });
  };

  const addOffer = () => {
    setDraft((prev) => ({ ...prev, offers: [...prev.offers, emptyOffer()] }));
  };

  const removeOffer = (index: number) => {
    setDraft((prev) => {
      const offers = prev.offers.filter((_, idx) => idx !== index);
      return { ...prev, offers: offers.length ? offers : [emptyOffer()] };
    });
  };

  const addPricePoint = () => {
    const today = new Date().toISOString().split('T')[0];
    setDraft((prev) => ({
      ...prev,
      priceHistory: [...prev.priceHistory, { date: today, price: prev.priceHistory.at(-1)?.price || 0 }],
    }));
  };

  const handlePriceChange = (index: number, field: 'date' | 'price', value: string) => {
    setDraft((prev) => {
      const priceHistory = [...prev.priceHistory];
      priceHistory[index] = {
        ...priceHistory[index],
        [field]: field === 'price' ? Number(value) : value,
      };
      return { ...prev, priceHistory };
    });
  };

  const handleSave = () => {
    if (!draft.title || !draft.discogsId) {
      toast.error('상품명과 Discogs ID는 필수입니다.');
      return;
    }

    updateProducts((prev) => {
      const index = prev.findIndex((item) => item.id === draft.id);
      if (index === -1) {
        toast.success('새로운 상품이 추가되었습니다.');
        return [...prev, draft];
      }
      const next = [...prev];
      next[index] = draft;
      toast.success('상품 정보가 저장되었습니다.');
      return next;
    });
  };

  const handleDuplicate = () => {
    const duplicated = {
      ...draft,
      id: `lp-${Date.now()}`,
      title: `${draft.title} (복제)`,
    };
    updateProducts((prev) => [...prev, duplicated]);
    toast.success('상품이 복제되었습니다.');
  };

  const handleDelete = () => {
    updateProducts((prev) => prev.filter((product) => product.id !== draft.id));
    toast.success('상품이 삭제되었습니다.');
    setSelectedId(null);
    setDraft(createBlankProduct());
  };

  const offerStats = useMemo(() => {
    if (!draft.offers.length) return null;
    const best = draft.offers.reduce((min, offer) => {
      const finalPrice = calculateOfferFinalPrice(offer);
      if (!min || finalPrice < min.price) {
        return { label: offer.vendorName, price: finalPrice };
      }
      return min;
    }, null as null | { label: string; price: number });
    return best;
  }, [draft.offers]);

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl text-slate-900">LP 데이터 관리자</h2>
          <p className="text-sm text-gray-500">
            Discogs/바코드 기준으로 상품을 관리하고 커미션 URL을 세팅하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-2xl border-slate-200 text-slate-700"
            onClick={handleDuplicate}
          >
            복제
          </Button>
          <Button className="rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={handleSave}>
            저장
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
        <aside className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <Button
            variant="outline"
            className="w-full rounded-2xl border-dashed border-slate-300 text-slate-600"
            onClick={() => {
              const blank = createBlankProduct();
              setDraft(blank);
              setSelectedId(blank.id);
            }}
          >
            + 새 상품 추가
          </Button>
          <div className="space-y-2">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => setSelectedId(product.id)}
                className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${
                  product.id === selectedId
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="font-medium">{product.title || '제목 미입력'}</div>
                <div className="text-xs opacity-70">{product.discogsId || 'Discogs 없음'}</div>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="상품명"
                value={draft.title}
                onChange={(event) => handleFieldChange('title', event.target.value)}
              />
              <InputField
                label="아티스트"
                value={draft.artist}
                onChange={(event) => handleFieldChange('artist', event.target.value)}
              />
              <InputField
                label="Discogs ID"
                value={draft.discogsId}
                onChange={(event) => handleFieldChange('discogsId', event.target.value)}
              />
              <InputField
                label="EAN / 바코드"
                value={draft.barcode}
                onChange={(event) => handleFieldChange('barcode', event.target.value)}
              />
              <InputField
                label="카테고리"
                value={draft.category}
                onChange={(event) => handleFieldChange('category', event.target.value)}
              />
              <InputField
                label="세부 카테고리"
                value={draft.subCategory}
                onChange={(event) => handleFieldChange('subCategory', event.target.value)}
              />
              <InputField
                label="색상"
                value={draft.color}
                onChange={(event) => handleFieldChange('color', event.target.value)}
              />
              <InputField
                label="에디션"
                value={draft.edition}
                onChange={(event) => handleFieldChange('edition', event.target.value)}
              />
              <InputField
                label="국가"
                value={draft.country}
                onChange={(event) => handleFieldChange('country', event.target.value)}
              />
              <InputField
                label="희소성 지수"
                value={draft.rarityIndex.toString()}
                onChange={(event) =>
                  handleFieldChange('rarityIndex', Number(event.target.value) || 0)
                }
              />
              <InputField
                label="투자 수익률 (LPR)"
                value={draft.lpr.toString()}
                onChange={(event) => handleFieldChange('lpr', Number(event.target.value) || 0)}
              />
            </div>
            <InputField
              label="요약 설명"
              value={draft.summary}
              textarea
              onChange={(event) => handleFieldChange('summary', event.target.value)}
            />
            <InputField
              label="프레싱 노트"
              value={draft.pressingNotes}
              textarea
              onChange={(event) => handleFieldChange('pressingNotes', event.target.value)}
            />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg text-slate-900">판매처/커미션</h3>
              <Button variant="outline" className="rounded-2xl text-sm" onClick={addOffer}>
                + 판매처 추가
              </Button>
            </div>
            <div className="space-y-4">
              {draft.offers.map((offer, index) => (
                <div key={offer.id} className="rounded-xl border border-slate-100 p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      {offer.vendorName || '판매처 미입력'} · 실구매가{' '}
                      {formatCurrency(calculateOfferFinalPrice(offer))}
                    </span>
                    <button
                      onClick={() => removeOffer(index)}
                      className="text-rose-500 hover:text-rose-600"
                    >
                      삭제
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InputField
                      label="판매처명"
                      value={offer.vendorName}
                      onChange={(event) => handleOfferChange(index, 'vendorName', event.target.value)}
                    />
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-gray-500">채널</label>
                      <select
                        value={offer.channelId}
                        onChange={(event) => handleOfferChange(index, 'channelId', event.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        {LP_VENDOR_CHANNELS.map((channel) => (
                          <option key={channel.id} value={channel.id}>
                            {channel.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <InputField
                      label="기준가"
                      value={offer.basePrice.toString()}
                      onChange={(event) =>
                        handleOfferChange(index, 'basePrice', Number(event.target.value) || 0)
                      }
                    />
                    <InputField
                      label="배송비"
                      value={offer.shippingFee.toString()}
                      onChange={(event) =>
                        handleOfferChange(index, 'shippingFee', Number(event.target.value) || 0)
                      }
                    />
                    <InputField
                      label="배송 정책"
                      value={offer.shippingPolicy}
                      onChange={(event) =>
                        handleOfferChange(index, 'shippingPolicy', event.target.value)
                      }
                    />
                    <InputField
                      label="구매 링크"
                      value={offer.url}
                      onChange={(event) => handleOfferChange(index, 'url', event.target.value)}
                    />
                    <InputField
                      label="파트너 코드"
                      value={offer.affiliateCode || ''}
                      onChange={(event) =>
                        handleOfferChange(index, 'affiliateCode', event.target.value)
                      }
                    />
                    <InputField
                      label="파라미터 키"
                      value={offer.affiliateParamKey || 'aff_id'}
                      onChange={(event) =>
                        handleOfferChange(index, 'affiliateParamKey', event.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg text-slate-900">가격 히스토리</h3>
              <Button variant="outline" className="rounded-2xl text-sm" onClick={addPricePoint}>
                + 포인트 추가
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {draft.priceHistory.map((point, index) => (
                <div key={`${point.date}-${index}`} className="rounded-xl border border-slate-100 p-3">
                  <InputField
                    label="날짜"
                    value={point.date}
                    onChange={(event) => handlePriceChange(index, 'date', event.target.value)}
                  />
                  <InputField
                    label="가격"
                    value={point.price.toString()}
                    onChange={(event) => handlePriceChange(index, 'price', event.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" className="rounded-2xl text-rose-600 border-rose-200" onClick={handleDelete}>
              상품 삭제
            </Button>
          </div>
        </div>
      </div>
      {offerStats && (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-600">
          최저 실구매가: {offerStats.label} · {formatCurrency(offerStats.price)}
        </div>
      )}
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  textarea?: boolean;
}

function InputField({ label, value, onChange, textarea }: InputFieldProps) {
  const commonClasses =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200';
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="text-gray-500">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={onChange} className={`${commonClasses} min-h-[100px]`} />
      ) : (
        <input value={value} onChange={onChange} className={commonClasses} />
      )}
    </div>
  );
}


