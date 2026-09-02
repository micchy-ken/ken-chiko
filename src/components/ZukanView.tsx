import React, { useState, useMemo } from 'react';
import { NyanCharacter } from '../types';
import { NyanIllustration } from './NyanIllustration';
import { Search, BookOpen, HelpCircle } from 'lucide-react';

interface ZukanViewProps {
  characters: NyanCharacter[];
  onSelectCharacter: (nyan: NyanCharacter) => void;
}

export const ZukanView: React.FC<ZukanViewProps> = ({
  characters,
  onSelectCharacter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'discovered' | 'undiscovered'>('all');

  const discoveredCount = characters.filter((c) => c.discovered).length;
  const totalCount = characters.length;
  const discoveryPercent = Math.round((discoveredCount / totalCount) * 100);

  const filteredCharacters = useMemo(() => {
    return characters.filter((char) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        char.name.toLowerCase().includes(q) ||
        char.reading.toLowerCase().includes(q) ||
        char.motif.toLowerCase().includes(q) ||
        char.episode.toLowerCase().includes(q) ||
        String(char.no).includes(q);

      if (!matchesQuery) return false;

      if (filterType === 'discovered') return char.discovered;
      if (filterType === 'undiscovered') return !char.discovered;
      return true;
    });
  }, [characters, searchQuery, filterType]);

  return (
    <div className="sketch-card overflow-hidden flex flex-col bg-[#FAF8F4]">
      {/* Header Bar in Sketchbook Style */}
      <div className="bg-[#ECE7DC] text-[#3E3833] p-5 border-b-1.5 border-[#3E3833] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#3E3833] text-[#FAF8F4] flex items-center justify-center font-bold shadow-sm border border-[#2E2824]">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#2E2824] tracking-tight font-handwriting">◯◯にゃん図鑑</h2>
            <p className="text-xs text-[#6A625A] font-handwriting">
              セカイで出会った脱力キャラクターたちの記録（全{totalCount}種類）
            </p>
          </div>
        </div>

        {/* Discovery Progress Meter */}
        <div className="bg-[#FAF8F4] px-4 py-2 sketch-tag flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-[#7A726A] font-bold font-handwriting">発見率</div>
            <div className="font-mono font-bold text-[#D97543] text-base">
              {discoveredCount} / {totalCount} ({discoveryPercent}%)
            </div>
          </div>
          <div className="w-16 bg-[#EAE6DC] rounded-full h-2.5 overflow-hidden border border-[#3E3833]">
            <div
              className="bg-[#487560] h-full rounded-full transition-all duration-500"
              style={{ width: `${discoveryPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#F4F1EA] border-b-1.5 border-[#3E3833] flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#7A726A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="にゃんの名前、モチーフ、番号で検索…"
            className="w-full pl-9 pr-4 py-2 bg-[#FAF8F4] sketch-tag text-xs font-bold text-[#2E2824] placeholder:text-[#8C837A] focus:outline-none focus:border-[#487560]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-bold transition font-handwriting ${
              filterType === 'all'
                ? 'bg-[#3E3833] text-[#FAF8F4] sketch-border shadow-sm'
                : 'bg-[#FAF8F4] text-[#5A524A] sketch-tag hover:bg-white'
            }`}
          >
            すべて ({totalCount})
          </button>
          <button
            onClick={() => setFilterType('discovered')}
            className={`px-3 py-1.5 text-xs font-bold transition font-handwriting ${
              filterType === 'discovered'
                ? 'bg-[#487560] text-[#FAF8F4] sketch-border shadow-sm'
                : 'bg-[#FAF8F4] text-[#5A524A] sketch-tag hover:bg-white'
            }`}
          >
            発見済み ({discoveredCount})
          </button>
          <button
            onClick={() => setFilterType('undiscovered')}
            className={`px-3 py-1.5 text-xs font-bold transition font-handwriting ${
              filterType === 'undiscovered'
                ? 'bg-[#7A726A] text-[#FAF8F4] sketch-border shadow-sm'
                : 'bg-[#FAF8F4] text-[#5A524A] sketch-tag hover:bg-white'
            }`}
          >
            未発見 ({totalCount - discoveredCount})
          </button>
        </div>
      </div>

      {/* Character Grid */}
      <div className="p-5 max-h-[600px] overflow-y-auto">
        {filteredCharacters.length === 0 ? (
          <div className="py-12 text-center text-[#7A726A]">
            <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-50 text-[#487560]" />
            <p className="font-bold text-sm text-[#2E2824] font-handwriting">該当するにゃんが見つかりませんでした</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {filteredCharacters.map((nyan) => {
              const isDiscovered = nyan.discovered;

              return (
                <button
                  key={nyan.no}
                  onClick={() => {
                    if (isDiscovered) {
                      onSelectCharacter(nyan);
                    }
                  }}
                  disabled={!isDiscovered}
                  className={`group relative flex flex-col items-center p-3 transition text-center ${
                    isDiscovered
                      ? 'bg-[#FAF8F4] hover:bg-[#FFFDF9] sketch-card-subtle cursor-pointer hover:-translate-y-0.5 active:translate-y-0'
                      : 'bg-[#EAE6DC]/60 border-2 border-dashed border-[#C4BCAB] rounded-2xl opacity-60 cursor-not-allowed'
                  }`}
                >
                  {/* Number Badge */}
                  <div className="w-full flex items-center justify-between text-[10px] font-mono font-bold text-[#7A726A] mb-1">
                    <span>No.{String(nyan.no).padStart(3, '0')}</span>
                    {isDiscovered && (
                      <span className="text-[#D97543] font-bold">★{nyan.playCount}</span>
                    )}
                  </div>

                  {/* Character Illustration / Silhouette (Organic pencil rendering) */}
                  <div className="my-1.5 flex items-center justify-center">
                    <NyanIllustration
                      nyan={nyan}
                      size={80}
                      isDiscovered={isDiscovered}
                    />
                  </div>

                  {/* Character Name */}
                  <div className="w-full mt-1">
                    <p
                      className={`text-xs font-bold truncate font-handwriting ${
                        isDiscovered ? 'text-[#2E2824]' : 'text-[#7A726A]'
                      }`}
                    >
                      {isDiscovered ? nyan.name : '？？？？'}
                    </p>
                    <p className="text-[10px] text-[#7A726A] truncate">
                      {isDiscovered ? nyan.motif : '未遭遇'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
