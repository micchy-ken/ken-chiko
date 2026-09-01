import React, { useState, useMemo } from 'react';
import { NyanCharacter } from '../types';
import { NyanIllustration } from './NyanIllustration';
import { Search, Filter, Sparkles, BookOpen, CheckCircle2, HelpCircle } from 'lucide-react';

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
      // Search text filter
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
    <div className="bg-[#FAF8F5] rounded-3xl border border-[#DDD7C8] shadow-[0_4px_16px_rgba(74,68,63,0.06)] overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="bg-[#4A443F] text-[#FAF8F5] p-5 border-b border-[#3A342F] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#728C7E] text-white flex items-center justify-center font-bold shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">◯◯にゃん図鑑</h2>
            <p className="text-xs text-[#CCC4B2] font-medium">
              セカイで出会った脱力キャラクターたちの記録（全{totalCount}種類）
            </p>
          </div>
        </div>

        {/* Discovery Progress Meter */}
        <div className="bg-[#3A342F] px-4 py-2 rounded-2xl border border-[#5A524A] flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-[#CCC4B2] font-bold">発見率</div>
            <div className="font-mono font-black text-[#D4B996] text-base">
              {discoveredCount} / {totalCount} ({discoveryPercent}%)
            </div>
          </div>
          <div className="w-16 bg-[#2B2724] rounded-full h-2.5 overflow-hidden border border-[#5A524A]">
            <div
              className="bg-[#728C7E] h-full rounded-full transition-all duration-500"
              style={{ width: `${discoveryPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#F5F2EA] border-b border-[#DDD7C8] flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#8C837A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="にゃんの名前、モチーフ、番号で検索…"
            className="w-full pl-9 pr-4 py-2 bg-[#FAF8F5] border border-[#DDD7C8] rounded-xl text-xs font-bold text-[#4A443F] placeholder:text-[#8C837A] focus:outline-none focus:border-[#728C7E]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              filterType === 'all'
                ? 'bg-[#4A443F] text-white border-[#3A342F] shadow-sm'
                : 'bg-[#FAF8F5] text-[#6B6259] border-[#DDD7C8] hover:bg-white'
            }`}
          >
            すべて ({totalCount})
          </button>
          <button
            onClick={() => setFilterType('discovered')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              filterType === 'discovered'
                ? 'bg-[#728C7E] text-white border-[#5C7366] shadow-sm'
                : 'bg-[#FAF8F5] text-[#6B6259] border-[#DDD7C8] hover:bg-white'
            }`}
          >
            発見済み ({discoveredCount})
          </button>
          <button
            onClick={() => setFilterType('undiscovered')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              filterType === 'undiscovered'
                ? 'bg-[#8C837A] text-white border-[#756E66]'
                : 'bg-[#FAF8F5] text-[#6B6259] border-[#DDD7C8] hover:bg-white'
            }`}
          >
            未発見 ({totalCount - discoveredCount})
          </button>
        </div>
      </div>

      {/* Character Grid */}
      <div className="p-5 max-h-[600px] overflow-y-auto">
        {filteredCharacters.length === 0 ? (
          <div className="py-12 text-center text-[#8C837A]">
            <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-50 text-[#728C7E]" />
            <p className="font-bold text-sm text-[#4A443F]">該当するにゃんが見つかりませんでした</p>
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
                  className={`group relative flex flex-col items-center p-3 rounded-2xl border transition text-center ${
                    isDiscovered
                      ? 'bg-[#FAF8F5] hover:bg-[#F5F2EA] border-[#DDD7C8] shadow-[0_2px_8px_rgba(74,68,63,0.04)] cursor-pointer hover:-translate-y-0.5 active:translate-y-0'
                      : 'bg-[#EFECE4]/60 border-dashed border-[#CCC4B2] opacity-60 cursor-not-allowed'
                  }`}
                >
                  {/* Number Badge */}
                  <div className="w-full flex items-center justify-between text-[10px] font-mono font-bold text-[#7D756D] mb-1">
                    <span>No.{String(nyan.no).padStart(3, '0')}</span>
                    {isDiscovered && (
                      <span className="text-[#C8744E] font-bold">★{nyan.playCount}</span>
                    )}
                  </div>

                  {/* Character Illustration / Silhouette */}
                  <div className="my-1.5 flex items-center justify-center">
                    <NyanIllustration
                      nyan={nyan}
                      size={76}
                      isDiscovered={isDiscovered}
                    />
                  </div>

                  {/* Character Name */}
                  <div className="w-full mt-1">
                    <p
                      className={`text-xs font-black truncate ${
                        isDiscovered ? 'text-[#3A342F]' : 'text-[#8C837A]'
                      }`}
                    >
                      {isDiscovered ? nyan.name : '？？？？'}
                    </p>
                    <p className="text-[10px] text-[#8C837A] truncate">
                      {isDiscovered ? nyan.motif : '未遭遇'}
                    </p>
                  </div>

                  {isDiscovered && (
                    <div className="absolute top-2 right-2">
                      <span className="w-2 h-2 rounded-full bg-[#728C7E] inline-block" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
