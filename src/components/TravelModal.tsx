import React, { useState, useEffect, useCallback } from 'react';
import { LocationId, TransportMethod, KenchikoState } from '../types';
import { LOCATIONS, TRANSPORT_METHODS } from '../data/locations';
import { X, Compass, Footprints, Bike, Car, CloudSun, Train, RefreshCw, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface TravelModalProps {
  kenchiko: KenchikoState;
  onClose: () => void;
  onStartTravel: (destination: LocationId, transport: TransportMethod) => void;
  onStartRandomTravel?: () => void;
}

export const TravelModal: React.FC<TravelModalProps> = ({
  kenchiko,
  onClose,
  onStartTravel,
}) => {
  // Available locations strictly excluding current location (9 registered locations in locations.ts)
  const getEligibleLocations = useCallback((): LocationId[] => {
    const allKeys = Object.keys(LOCATIONS) as LocationId[];
    return allKeys.filter((locId) => locId !== kenchiko.currentLocation);
  }, [kenchiko.currentLocation]);

  // Pick 3 unique random candidate locations
  const pick3RandomCandidates = useCallback((): LocationId[] => {
    const eligible = getEligibleLocations();
    const shuffled = [...eligible].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  }, [getEligibleLocations]);

  // 3 candidates state
  const [candidates, setCandidates] = useState<LocationId[]>([]);
  const [isRerolling, setIsRerolling] = useState(false);

  // Selected destination & lottery state
  const [selectedDestination, setSelectedDestination] = useState<LocationId | null>(null);
  const [decidedTransport, setDecidedTransport] = useState<TransportMethod | null>(null);
  const [isRollingTransport, setIsRollingTransport] = useState(false);

  // Initialize candidates on open
  useEffect(() => {
    setCandidates(pick3RandomCandidates());
  }, [pick3RandomCandidates]);

  // Reroll 3 candidates
  const handleReroll = () => {
    setIsRerolling(true);
    setTimeout(() => {
      setCandidates(pick3RandomCandidates());
      setIsRerolling(false);
    }, 200);
  };

  // Get Transport Icon helper
  const getTransportIcon = (id: TransportMethod) => {
    switch (id) {
      case 'walk':
        return <Footprints className="w-4 h-4 text-[#7A6B5D]" />;
      case 'bicycle':
        return <Bike className="w-4 h-4 text-[#3D7053]" />;
      case 'car':
        return <Car className="w-4 h-4 text-[#2E6088]" />;
      case 'jinbei_nyan':
        return <CloudSun className="w-4 h-4 text-[#D9822B]" />;
      case 'train':
        return <Train className="w-4 h-4 text-[#5A4582]" />;
    }
  };

  // When user clicks one of the 3 candidate locations:
  const handleSelectCandidate = (destination: LocationId) => {
    if (isRollingTransport) return;

    setSelectedDestination(destination);
    setIsRollingTransport(true);

    // Randomly select one of the transport methods
    const randomTransport =
      TRANSPORT_METHODS[Math.floor(Math.random() * TRANSPORT_METHODS.length)].id;
    setDecidedTransport(randomTransport);

    // Little celebration sparkle
    try {
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }

    // Auto depart after 1.1 seconds so user can see what was chosen
    setTimeout(() => {
      onStartTravel(destination, randomTransport);
      onClose();
    }, 1100);
  };

  const currentLocationInfo = LOCATIONS[kenchiko.currentLocation] || LOCATIONS.living;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2824]/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#FAF8F4] sketch-card overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-[#ECE7DC] px-5 py-3.5 border-b-1.5 border-[#3E3833] flex items-center justify-between text-[#2E2824]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sketch-tag bg-[#3E3833] text-white shadow-sm">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#2E2824] font-handwriting">
                お出かけ先を選ぶ（3つの候補）
              </h3>
              <p className="text-[11px] text-[#7A726A] font-handwriting">
                現在地: <span className="font-bold text-[#3E3833]">{currentLocationInfo.name}</span>
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
        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Instruction Note */}
          <div className="bg-[#FAF2EB] p-3 rounded-2xl border border-[#F0D5C3] text-xs font-handwriting text-[#874A2E] flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#D97706] shrink-0" />
              <span>
                行きたい場所を1つタップすると、<strong>ランダムな移動手段</strong>が決まって出発します！
              </span>
            </div>
            <button
              onClick={handleReroll}
              disabled={isRerolling || isRollingTransport}
              title="別の3つの候補を引き直す"
              className="px-2.5 py-1 bg-white hover:bg-[#FAF8F4] border border-[#E0BC9E] text-[#874A2E] rounded-xl text-[11px] font-bold flex items-center gap-1 transition shrink-0 active:scale-95 shadow-xs"
            >
              <RefreshCw className={`w-3 h-3 ${isRerolling ? 'animate-spin' : ''}`} />
              <span>引き直す</span>
            </button>
          </div>

          {/* Lottery Reveal Animation (when chosen) */}
          {isRollingTransport && selectedDestination && decidedTransport && (
            <div className="p-4 bg-[#EAF2F8] border-2 border-[#5B9BBF] rounded-2xl text-center space-y-2 animate-bounce">
              <div className="text-xs text-[#2A4D69] font-bold font-handwriting">
                ✨ 行き先：【{LOCATIONS[selectedDestination]?.name}】に決定！
              </div>
              <div className="flex items-center justify-center gap-2 text-base font-black text-[#1E3A52] font-handwriting">
                <span className="p-1.5 bg-white rounded-full shadow-xs">
                  {getTransportIcon(decidedTransport)}
                </span>
                <span>
                  移動手段：【
                  {TRANSPORT_METHODS.find((t) => t.id === decidedTransport)?.name || 'とほ'}
                  】で出発します！💨
                </span>
              </div>
            </div>
          )}

          {/* The 3 Random Candidate Destination Cards */}
          <div className="space-y-3">
            {candidates.map((locId, idx) => {
              const info = LOCATIONS[locId];
              if (!info) return null;
              const isSelected = selectedDestination === locId;

              return (
                <button
                  key={locId}
                  disabled={isRollingTransport}
                  onClick={() => handleSelectCandidate(locId)}
                  className={`w-full p-4 text-left transition rounded-2xl border-2 flex items-start gap-3.5 relative overflow-hidden group active:scale-[0.98] ${
                    isSelected
                      ? 'bg-[#FFFDF9] border-[#3E3833] shadow-md ring-2 ring-[#487560]'
                      : 'bg-white hover:bg-[#FAF8F4] border-[#DDD7C8] hover:border-[#8C7E72] shadow-xs'
                  }`}
                >
                  {/* Badge Number */}
                  <div className="absolute top-2.5 right-3 px-2 py-0.5 bg-[#EAE5D9] text-[#5A524A] text-[10px] font-bold rounded-full font-handwriting">
                    候補 {idx + 1}
                  </div>

                  {/* Icon */}
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF8F4] border border-[#DDD7C8] flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                    {info.bgIcon}
                  </div>

                  {/* Text Details */}
                  <div className="flex-1 pr-10">
                    <h4 className="text-sm font-black text-[#2E2824] font-handwriting group-hover:text-[#487560] transition-colors flex items-center gap-1.5">
                      <span>{info.name}</span>
                    </h4>
                    <p className="text-xs text-[#7A726A] mt-1 line-clamp-2 leading-relaxed font-handwriting">
                      {info.description}
                    </p>

                    <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#487560] font-bold font-handwriting">
                      <span>ここへお出かけする</span>
                      <span>→</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Random transport explanation pills */}
          <div className="pt-2 border-t border-[#EAE5D9]">
            <p className="text-[11px] text-[#7A726A] font-handwriting text-center mb-2">
              🎲 移動手段は以下のいずれかがランダムに選ばれます（一律20秒）
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {TRANSPORT_METHODS.map((t) => (
                <div
                  key={t.id}
                  className="px-2.5 py-1 bg-[#FAF8F4] border border-[#DDD7C8] rounded-xl text-[10px] font-bold text-[#4A423B] flex items-center gap-1 font-handwriting"
                >
                  {getTransportIcon(t.id)}
                  <span>{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
