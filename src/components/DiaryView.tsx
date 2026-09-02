import React from 'react';
import { DiaryEntry } from '../types';
import { BookOpen, Calendar, MapPin, Sparkles, Heart } from 'lucide-react';

interface DiaryViewProps {
  diary: DiaryEntry[];
}

export const DiaryView: React.FC<DiaryViewProps> = ({ diary }) => {
  return (
    <div className="sketch-card overflow-hidden flex flex-col bg-[#FAF8F4]">
      {/* Header */}
      <div className="bg-[#ECE7DC] text-[#3E3833] p-5 border-b-1.5 border-[#3E3833] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#3E3833] text-[#FAF8F4] flex items-center justify-center font-bold shadow-sm border border-[#2E2824]">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#2E2824] tracking-tight font-handwriting">けんちこのおもいで絵日記</h2>
            <p className="text-xs text-[#7A726A] font-handwriting">
              これまでに訪れた場所、食べたおやつ、出会ったにゃん達との記録
            </p>
          </div>
        </div>
        <div className="text-xs font-mono font-bold bg-[#FAF8F4] text-[#8C5A3E] px-3 py-1.5 sketch-tag font-handwriting">
          全 {diary.length} ページ
        </div>
      </div>

      {/* Diary Entries List */}
      <div className="p-6 max-h-[560px] overflow-y-auto space-y-4">
        {diary.length === 0 ? (
          <div className="py-16 text-center text-[#7A726A]">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50 text-[#487560]" />
            <p className="font-bold text-sm text-[#2E2824] font-handwriting">まだ絵日記が書かれていません</p>
            <p className="text-xs text-[#7A726A] mt-1 font-handwriting">
              けんちこがセカイを旅したり、おやつを食べたりすると自動で記録されます。
            </p>
          </div>
        ) : (
          diary.map((entry) => (
            <div
              key={entry.id}
              className="relative p-5 bg-[#FFFDF9] sketch-card-subtle transition hover:-translate-y-0.5"
            >
              {/* Top metadata */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#7A726A] mb-2 border-b border-[#EAE6DC] pb-2 font-handwriting">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[#2E2824]">
                    <Calendar className="w-3.5 h-3.5 text-[#487560]" />
                    {entry.dateFormatted}
                  </span>
                  <span className="text-[#C4BCAB]">•</span>
                  <span className="flex items-center gap-1 text-[#3C5C7A]">
                    <MapPin className="w-3.5 h-3.5 text-[#3C5C7A]" />
                    {entry.locationName}
                  </span>
                </div>

                {entry.nyanName && (
                  <span className="bg-[#FAF8F4] text-[#487560] text-[11px] px-2.5 py-0.5 sketch-tag flex items-center gap-1">
                    <Heart className="w-3 h-3 fill-[#C85A53] text-[#C85A53]" />
                    {entry.nyanName}と遊んだ
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-base font-bold text-[#2E2824] mb-1.5 flex items-center gap-2 font-handwriting">
                <Sparkles className="w-4 h-4 text-[#D97543] shrink-0" />
                {entry.activityTitle}
              </h3>

              {/* Diary Text Content */}
              <p className="text-sm font-medium text-[#3E3833] leading-relaxed whitespace-pre-wrap bg-[#FAF8F4] p-3.5 rounded-xl border border-[#EAE6DC] font-handwriting">
                {entry.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
