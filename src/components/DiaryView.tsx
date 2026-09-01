import React from 'react';
import { DiaryEntry } from '../types';
import { BookOpen, Calendar, MapPin, Sparkles, Heart } from 'lucide-react';

interface DiaryViewProps {
  diary: DiaryEntry[];
}

export const DiaryView: React.FC<DiaryViewProps> = ({ diary }) => {
  return (
    <div className="bg-[#FAF8F5] rounded-3xl border border-[#DDD7C8] shadow-[0_4px_16px_rgba(74,68,63,0.06)] overflow-hidden flex flex-col font-['M_PLUS_Rounded_1c',sans-serif]">
      {/* Header */}
      <div className="bg-[#4A443F] text-[#FAF8F5] p-5 border-b border-[#3A342F] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#728C7E] text-white flex items-center justify-center font-bold shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">けんちこのおもいで絵日記</h2>
            <p className="text-xs text-[#CCC4B2] font-medium">
              これまでに訪れた場所、食べたおやつ、出会ったにゃん達との記録
            </p>
          </div>
        </div>
        <div className="text-xs font-mono font-bold bg-[#3A342F] text-[#D4B996] px-3 py-1.5 rounded-xl border border-[#5A524A]">
          全 {diary.length} ページ
        </div>
      </div>

      {/* Diary Entries List */}
      <div className="p-6 max-h-[560px] overflow-y-auto space-y-4">
        {diary.length === 0 ? (
          <div className="py-16 text-center text-[#8C837A]">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50 text-[#728C7E]" />
            <p className="font-bold text-sm text-[#4A443F]">まだ絵日記が書かれていません</p>
            <p className="text-xs text-[#8C837A] mt-1">
              けんちこがセカイを旅したり、おやつを食べたりすると自動で記録されます。
            </p>
          </div>
        ) : (
          diary.map((entry) => (
            <div
              key={entry.id}
              className="relative p-5 rounded-2xl bg-[#F5F2EA] border border-[#DDD7C8] shadow-[0_2px_8px_rgba(74,68,63,0.04)] transition hover:-translate-y-0.5"
            >
              {/* Top metadata */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#7D756D] mb-2 border-b border-[#DDD7C8] pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[#4A443F]">
                    <Calendar className="w-3.5 h-3.5 text-[#728C7E]" />
                    {entry.dateFormatted}
                  </span>
                  <span className="text-[#CCC4B2]">•</span>
                  <span className="flex items-center gap-1 text-[#4B6882]">
                    <MapPin className="w-3.5 h-3.5 text-[#4B6882]" />
                    {entry.locationName}
                  </span>
                </div>

                {entry.nyanName && (
                  <span className="bg-[#EAF0EC] text-[#3D5447] text-[11px] px-2.5 py-0.5 rounded-full border border-[#C6D8CD] flex items-center gap-1">
                    <Heart className="w-3 h-3 fill-[#D4736A] text-[#D4736A]" />
                    {entry.nyanName}と遊んだ
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-base font-black text-[#3A342F] mb-1.5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C8744E] shrink-0" />
                {entry.activityTitle}
              </h3>

              {/* Diary Text Content */}
              <p className="text-xs font-medium text-[#4A443F] leading-relaxed whitespace-pre-wrap bg-[#FAF8F5] p-3 rounded-xl border border-[#DDD7C8]">
                {entry.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
