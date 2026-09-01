import React, { useState } from 'react';
import { LocationId, TransportMethod, KenchikoState } from '../types';
import { LOCATIONS, TRANSPORT_METHODS } from '../data/locations';
import { X, Compass, Footprints, Bike, Car, CloudSun, Train, MapPin } from 'lucide-react';

interface TravelModalProps {
  kenchiko: KenchikoState;
  onClose: () => void;
  onStartTravel: (destination: LocationId, transport: TransportMethod) => void;
}

export const TravelModal: React.FC<TravelModalProps> = ({
  kenchiko,
  onClose,
  onStartTravel,
}) => {
  const [selectedLoc, setSelectedLoc] = useState<LocationId>(
    (Object.keys(LOCATIONS) as LocationId[]).find((l) => l !== kenchiko.currentLocation) || 'living'
  );
  const [selectedTransport, setSelectedTransport] = useState<TransportMethod>('bicycle');

  const locEntries = Object.entries(LOCATIONS) as [LocationId, typeof LOCATIONS.living][];

  const handleGo = () => {
    onStartTravel(selectedLoc, selectedTransport);
    onClose();
  };

  const getTransportIcon = (id: TransportMethod) => {
    switch (id) {
      case 'walk':
        return <Footprints className="w-4 h-4" />;
      case 'bicycle':
        return <Bike className="w-4 h-4" />;
      case 'car':
        return <Car className="w-4 h-4" />;
      case 'jinbei_nyan':
        return <CloudSun className="w-4 h-4" />;
      case 'train':
        return <Train className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3A342F]/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#FAF8F5] rounded-3xl border border-[#DDD7C8] shadow-[0_8px_30px_rgba(74,68,63,0.15)] overflow-hidden flex flex-col font-['M_PLUS_Rounded_1c',sans-serif]">
        {/* Header */}
        <div className="bg-[#4A443F] px-6 py-4 border-b border-[#3A342F] flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#728C7E] text-white shadow-sm">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">おでかけ先を提案する</h3>
              <p className="text-xs font-bold text-[#CCC4B2]">
                行き先と移動手段を選んで、けんちこを旅立たせます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#3A342F] hover:bg-[#2B2724] text-[#CCC4B2] hover:text-white border border-[#5A524A] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Choose Location */}
          <div>
            <h4 className="text-xs font-black text-[#6B6259] tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#728C7E]" />
              1. 行き先を選択
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {locEntries.map(([id, info]) => {
                const isCurrent = kenchiko.currentLocation === id && kenchiko.currentActivity !== 'transit';
                const isSelected = selectedLoc === id;

                return (
                  <button
                    key={id}
                    onClick={() => !isCurrent && setSelectedLoc(id)}
                    disabled={isCurrent}
                    className={`p-3 rounded-2xl border transition text-left ${
                      isSelected
                        ? 'bg-[#FAF8F5] border-[#728C7E] ring-2 ring-[#728C7E]/40 shadow-sm'
                        : isCurrent
                        ? 'bg-[#EFECE4]/50 border-[#DDD7C8] opacity-50 cursor-not-allowed'
                        : 'bg-[#F5F2EA] border-[#DDD7C8] hover:border-[#8C837A]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-[#3A342F]">{info.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] bg-[#DDD7C8] text-[#4A443F] px-1.5 py-0.5 rounded font-bold">
                          現在地
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#7D756D] line-clamp-2">{info.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Choose Transport Method */}
          <div>
            <h4 className="text-xs font-black text-[#6B6259] tracking-wider mb-2 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#728C7E]" />
              2. 移動手段を選択（所要時間：5〜10分）
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TRANSPORT_METHODS.map((t) => {
                const isSelected = selectedTransport === t.id;

                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTransport(t.id)}
                    className={`p-3 rounded-2xl border transition text-left flex items-start gap-3 ${
                      isSelected
                        ? 'bg-[#FAF8F5] border-[#728C7E] ring-2 ring-[#728C7E]/40 shadow-sm'
                        : 'bg-[#F5F2EA] border-[#DDD7C8] hover:border-[#8C837A]'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-[#EAF0EC] text-[#3D5447] border border-[#C6D8CD] shrink-0">
                      {getTransportIcon(t.id)}
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#3A342F]">{t.name}</span>
                        <span className="text-[10px] font-mono font-bold text-[#5C7E6B]">
                          {t.speedMultiplier}x 速い
                        </span>
                      </div>
                      <p className="text-[10px] text-[#7D756D] mt-0.5">{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#EFECE4] px-6 py-4 border-t border-[#DDD7C8] flex items-center justify-between">
          <div className="text-xs font-bold text-[#7D756D]">
            目的地: <span className="text-[#3A342F] font-black">{LOCATIONS[selectedLoc]?.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#FAF8F5] hover:bg-white text-[#6B6259] font-bold text-xs rounded-xl border border-[#DDD7C8] transition"
            >
              キャンセル
            </button>

            <button
              onClick={handleGo}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-black text-xs bg-[#728C7E] hover:bg-[#5E786A] text-white shadow-sm transition active:translate-y-0.5"
            >
              <Compass className="w-4 h-4" />
              <span>しゅっぱつ！</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
