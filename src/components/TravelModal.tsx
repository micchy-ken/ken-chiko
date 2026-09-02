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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2824]/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#FAF8F4] sketch-card overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#ECE7DC] px-6 py-4 border-b-1.5 border-[#3E3833] flex items-center justify-between text-[#2E2824]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sketch-tag bg-[#3E3833] text-white shadow-sm">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#2E2824] font-handwriting">おでかけ先を提案する</h3>
              <p className="text-xs text-[#7A726A] font-handwriting">
                行き先と移動手段を選んで、けんちこを旅立たせます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sketch-tag bg-[#FAF8F4] hover:bg-white text-[#5A524A] hover:text-[#2E2824] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Choose Location */}
          <div>
            <h4 className="text-xs font-bold text-[#7A726A] font-handwriting mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#487560]" />
              1. 行き先を選択
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {locEntries.map(([id, info]) => {
                const isCurrent = kenchiko.currentLocation === id && kenchiko.currentActivity !== 'transit';
                const isSelected = selectedLoc === id;

                return (
                  <button
                    key={id}
                    disabled={isCurrent}
                    onClick={() => setSelectedLoc(id)}
                    className={`p-3 text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#FFFDF9] sketch-border shadow-sm'
                        : isCurrent
                        ? 'bg-[#EAE6DC]/60 sketch-card-subtle opacity-50 cursor-not-allowed'
                        : 'bg-[#FAF8F4] sketch-card-subtle hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{info.bgIcon}</span>
                      {isCurrent && (
                        <span className="text-[10px] bg-[#3E3833] text-white px-1.5 py-0.5 rounded font-handwriting">
                          現在地
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-bold text-[#2E2824] font-handwriting">{info.name}</p>
                      <p className="text-[10px] text-[#7A726A] line-clamp-1">{info.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Choose Transport */}
          <div>
            <h4 className="text-xs font-bold text-[#7A726A] font-handwriting mb-2 flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-[#3C5C7A]" />
              2. 移動手段を選択
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {TRANSPORT_METHODS.map((t) => {
                const isSelected = selectedTransport === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTransport(t.id)}
                    className={`p-3 text-left transition flex items-center gap-2.5 ${
                      isSelected
                        ? 'bg-[#FFFDF9] sketch-border shadow-sm'
                        : 'bg-[#FAF8F4] sketch-card-subtle hover:bg-white'
                    }`}
                  >
                    <div className={`p-2 sketch-tag ${isSelected ? 'bg-[#3E3833] text-white' : 'bg-[#EAE6DC] text-[#3E3833]'}`}>
                      {getTransportIcon(t.id)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#2E2824] font-handwriting">{t.name}</p>
                      <p className="text-[10px] text-[#7A726A]">{t.speedMultiplier}x スピード</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleGo}
            className="w-full py-3 bg-[#3E3833] hover:bg-[#2E2824] text-white text-sm font-bold sketch-tag shadow-sm transition active:translate-y-0.5 font-handwriting flex items-center justify-center gap-2"
          >
            <Compass className="w-4 h-4 text-white" />
            <span>{LOCATIONS[selectedLoc]?.name || 'そこ'} へ出発する！</span>
          </button>
        </div>
      </div>
    </div>
  );
};
