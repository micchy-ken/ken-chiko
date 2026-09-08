import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  BookOpen,
  Calendar,
  MessageCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { NyanCharacter, NyankoStory, NyankoStoryDay } from '../types';
import { fetchNyankoStory } from '../services/nyankoStoryService';
import { NyanIllustration } from './NyanIllustration';

interface NyankoStoryModalProps {
  nyan: NyanCharacter;
  isOpen: boolean;
  onClose: () => void;
  onStoryReadCompleted?: (nyanNo: number) => void;
  isStoryAlreadyRead?: boolean;
}

export const NyankoStoryModal: React.FC<NyankoStoryModalProps> = ({
  nyan,
  isOpen,
  onClose,
  onStoryReadCompleted,
  isStoryAlreadyRead = false,
}) => {
  const [story, setStory] = useState<NyankoStory | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [showAllDays, setShowAllDays] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const conversationSectionRef = useRef<HTMLDivElement | null>(null);

  /**
   * Smoothly scrolls to the top of the conversation section.
   * Compatible with desktop modals and mobile touch browsers (iOS Safari / Android Chrome).
   */
  const scrollToConversationTop = () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        // 1. Direct inner modal container scroll
        if (scrollContainerRef.current && conversationSectionRef.current) {
          const container = scrollContainerRef.current;
          const target = conversationSectionRef.current;
          const containerRect = container.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const relativeTop = targetRect.top - containerRect.top + container.scrollTop;

          container.scrollTo({
            top: Math.max(0, relativeTop - 8),
            behavior: 'smooth',
          });
        }

        // 2. scrollIntoView fallback for mobile viewport / parent wrapper
        if (conversationSectionRef.current) {
          try {
            conversationSectionRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
              inline: 'nearest',
            });
          } catch {
            conversationSectionRef.current.scrollIntoView(true);
          }
        }
      }, 40);
    });
  };

  const handleSelectDay = (idx: number) => {
    if (idx === selectedDayIndex) return;
    setSelectedDayIndex(idx);
    scrollToConversationTop();
  };

  const handlePrevDay = () => {
    if (selectedDayIndex > 0) {
      setSelectedDayIndex((prev) => prev - 1);
      scrollToConversationTop();
    }
  };

  const handleNextDay = () => {
    if (selectedDayIndex < days.length - 1) {
      setSelectedDayIndex((prev) => prev + 1);
      scrollToConversationTop();
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setSelectedDayIndex(0);

    fetchNyankoStory(nyan.no)
      .then((res) => {
        if (!isMounted) return;
        if (res.story) {
          setStory(res.story);
        } else {
          setError(res.error || '物語のデータが見つかりませんでした');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err?.message || '物語の取得中にエラーが発生しました');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, nyan.no]);

  // Check if final story day reached to grant completion points
  useEffect(() => {
    if (!isOpen || !story) return;
    const daysCount = story.week_info?.days?.length || 0;
    if (daysCount > 0 && (selectedDayIndex === daysCount - 1 || showAllDays)) {
      if (onStoryReadCompleted) {
        onStoryReadCompleted(nyan.no);
      }
    }
  }, [isOpen, story, selectedDayIndex, showAllDays, onStoryReadCompleted, nyan.no]);

  if (!isOpen) return null;

  const days: NyankoStoryDay[] = story?.week_info?.days || [];
  const currentDay: NyankoStoryDay | undefined = days[selectedDayIndex];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-3xl bg-[#FDFBF7] border-3 border-[#2E2824] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto"
        >
          {/* Header Bar */}
          <div className="p-3.5 sm:p-4 bg-[#F2EDE4] border-b-2 border-[#2E2824] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#FFFDF9] border-2 border-[#2E2824] flex items-center justify-center shadow-[1px_1px_0px_#2E2824] shrink-0">
                <BookOpen className="w-5 h-5 text-[#8C5A3E]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#8C5A3E] font-mono bg-[#E8DFC8] px-1.5 py-0.5 rounded border border-[#2E2824]/30">
                    No.{nyan.no}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-[#2E2824] font-handwriting truncate">
                    {story?.name || nyan.name}の物語
                  </h3>
                </div>
                {story?.week_info?.week_title && (
                  <p className="text-xs text-[#7A726A] font-handwriting truncate mt-0.5">
                    {story.week_info.week_title}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl border-2 border-[#2E2824] bg-[#FFFDF9] hover:bg-[#F0EBE1] active:translate-y-0.5 text-[#2E2824] transition-colors shrink-0 shadow-[2px_2px_0px_#2E2824]"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 font-sans scroll-smooth"
          >
            {/* Loading State */}
            {isLoading && (
              <div className="py-16 text-center space-y-3">
                <Loader2 className="w-8 h-8 mx-auto text-[#8C5A3E] animate-spin" />
                <p className="text-sm font-bold text-[#7A726A] font-handwriting">
                  Firebaseから物語を読み込み中...
                </p>
                <p className="text-xs text-[#A8A096]">
                  （初回のみ数KBの通信で読み込み、次回以降はキャッシュで即時表示されます）
                </p>
              </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
              <div className="p-6 bg-[#FFF2F0] border-2 border-[#E07A5F] rounded-xl text-center space-y-2.5">
                <AlertCircle className="w-8 h-8 mx-auto text-[#E07A5F]" />
                <p className="text-sm font-bold text-[#2E2824] font-handwriting">{error}</p>
                <p className="text-xs text-[#7A726A]">
                  ネットワーク環境を確認するか、時間をおいて再度お試しください。
                </p>
              </div>
            )}

            {/* Success Content */}
            {!isLoading && story && (
              <>
                {/* Character Summary Hero Card */}
                <div className="p-3.5 sm:p-4 bg-[#FFFDF9] border-2 border-[#2E2824] rounded-xl shadow-[3px_3px_0px_#2E2824] flex flex-col sm:flex-row gap-4 items-start">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-[#F6F1E8] border-2 border-[#2E2824] flex items-center justify-center p-1.5 shrink-0 mx-auto sm:mx-0 shadow-[2px_2px_0px_#2E2824]">
                    <NyanIllustration
                      nyan={nyan}
                      className="w-full h-full object-contain"
                      canvasClassName="w-full h-full"
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-2 text-left">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base sm:text-lg font-bold text-[#2E2824] font-handwriting">
                          {story.name}
                        </h4>
                        {story.kana && story.kana !== story.name && (
                          <span className="text-xs text-[#7A726A] font-handwriting">
                            （{story.kana}）
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#7A726A] flex-wrap mt-0.5">
                        <span>モチーフ: <strong className="text-[#2E2824]">{story.motif || nyan.motif}</strong></span>
                        {story.debut_date && (
                          <span>初登場: <strong className="text-[#2E2824]">{story.debut_date}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Cat Voice & Translation */}
                    {(story.voice || story.translation) && (
                      <div className="p-2.5 bg-[#FAF7F0] rounded-lg border border-[#E0D8C8] text-xs space-y-1">
                        {story.voice && (
                          <p className="font-bold text-[#8C5A3E] font-handwriting flex items-center gap-1.5">
                            <span className="text-sm">🐾</span>
                            <span>鳴き声: {story.voice}</span>
                          </p>
                        )}
                        {story.translation && (
                          <p className="text-[#5C544E] font-handwriting">
                            翻訳: {story.translation}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Episode Summary */}
                    {story.episode_summary && (
                      <div className="text-xs sm:text-sm text-[#3E3833] font-handwriting leading-relaxed bg-[#FFF9E6] p-2.5 rounded-lg border border-[#E8DFC8]">
                        <span className="font-bold text-[#8C5A3E]">【エピソード要約】</span>{' '}
                        {story.episode_summary}
                      </div>
                    )}
                  </div>
                </div>

                {/* Dialogue Conversation Section */}
                <div ref={conversationSectionRef} id="story-conversation-section" className="space-y-3 scroll-mt-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b-2 border-[#2E2824]/20 pb-2">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-[#8C5A3E]" />
                      <h4 className="text-sm sm:text-base font-bold text-[#2E2824] font-handwriting">
                        日記・会話劇アーカイブ
                      </h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#8C5A3E]/10 text-[#8C5A3E] font-mono font-bold">
                        全{days.length}日
                      </span>
                    </div>

                    {days.length > 1 && (
                      <button
                        onClick={() => {
                          setShowAllDays(!showAllDays);
                          scrollToConversationTop();
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg border border-[#2E2824] font-handwriting transition-all shadow-[1px_1px_0px_#2E2824] ${
                          showAllDays
                            ? 'bg-[#8C5A3E] text-white font-bold'
                            : 'bg-[#FFFDF9] text-[#2E2824] hover:bg-[#F2EDE4]'
                        }`}
                      >
                        {showAllDays ? '📅 1日ずつ表示に戻す' : '📖 全日まとめて通読する'}
                      </button>
                    )}
                  </div>

                  {/* Day Navigation Tabs (when not showing all) */}
                  {!showAllDays && days.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                      {days.map((day, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSelectDay(idx)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold font-handwriting whitespace-nowrap border-2 border-[#2E2824] transition-all shrink-0 ${
                            selectedDayIndex === idx
                              ? 'bg-[#8C5A3E] text-white shadow-[2px_2px_0px_#2E2824] translate-y-[-1px]'
                              : 'bg-[#FFFDF9] text-[#5C544E] hover:bg-[#F2EDE4] shadow-[1px_1px_0px_#2E2824]'
                          }`}
                        >
                          {day.date_header.replace(/（[月火水木金土日]）/g, '') || `Day ${idx + 1}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Messages Timeline */}
                  <div className="space-y-4 pt-1">
                    {(showAllDays ? days : currentDay ? [currentDay] : []).map((day, dIdx) => (
                      <div
                        key={dIdx}
                        className="bg-[#FFFDF9] border-2 border-[#2E2824] rounded-xl p-3.5 sm:p-4 shadow-[2px_2px_0px_#2E2824] space-y-3"
                      >
                        {/* Day Header */}
                        <div className="flex items-center justify-between border-b border-[#2E2824]/15 pb-2">
                          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#8C5A3E] font-handwriting">
                            <Calendar className="w-4 h-4 text-[#8C5A3E]" />
                            <span>{day.date_header}</span>
                          </div>
                          <span className="text-[11px] text-[#7A726A] font-mono">
                            {day.messages.length}件のやりとり
                          </span>
                        </div>

                        {/* Dialogue Bubbles */}
                        <div className="space-y-3">
                          {day.messages.map((msg, mIdx) => {
                            const isYumi = msg.sender.includes('由美') || msg.sender.includes('ゆみ');
                            const isKensuke = msg.sender.includes('健介') || msg.sender.includes('けんちこ');
                            const messageText = msg.body || msg.content || '';

                            return (
                              <div
                                key={mIdx}
                                className="flex gap-2.5 items-start"
                              >
                                {/* Speaker Badge */}
                                <div
                                  className={`w-14 sm:w-18 px-1.5 py-1.5 rounded-xl border-2 border-[#2E2824] text-[11px] sm:text-xs font-bold font-handwriting text-center shrink-0 shadow-[2px_2px_0px_#2E2824] ${
                                    isYumi
                                      ? 'bg-[#FDE8E8] text-[#9E2A2B]'
                                      : isKensuke
                                      ? 'bg-[#E3EBF8] text-[#2B4C7E]'
                                      : 'bg-[#F2EDE4] text-[#4A443E]'
                                  }`}
                                >
                                  {msg.sender}
                                </div>

                                {/* Message Bubble */}
                                <div
                                  className={`flex-1 min-w-0 border-2 border-[#2E2824] rounded-2xl p-3 sm:p-3.5 space-y-1.5 shadow-[2px_2px_0px_#2E2824] ${
                                    isYumi
                                      ? 'bg-[#FFF9F9]'
                                      : isKensuke
                                      ? 'bg-[#F8FAFF]'
                                      : 'bg-[#FFFDF9]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 text-[11px] text-[#8C847B] font-mono border-b border-[#2E2824]/10 pb-1">
                                    <span className="flex items-center gap-1 font-bold">
                                      <Clock className="w-3 h-3 text-[#8C5A3E]" />
                                      {msg.time}
                                    </span>
                                  </div>
                                  <p className="text-xs sm:text-sm font-medium text-[#2E2824] font-handwriting leading-relaxed whitespace-pre-wrap">
                                    {messageText || '（メッセージなし）'}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Day Navigation Controls (Footer) */}
                  {!showAllDays && days.length > 1 && (
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <button
                        onClick={handlePrevDay}
                        disabled={selectedDayIndex === 0}
                        className="px-3 py-1.5 rounded-xl border-2 border-[#2E2824] bg-[#FFFDF9] hover:bg-[#F2EDE4] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold font-handwriting flex items-center gap-1 shadow-[2px_2px_0px_#2E2824] active:translate-y-0.5 transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>前の日</span>
                      </button>

                      <span className="text-xs font-mono font-bold text-[#7A726A]">
                        {selectedDayIndex + 1} / {days.length}
                      </span>

                      <button
                        onClick={handleNextDay}
                        disabled={selectedDayIndex === days.length - 1}
                        className="px-3 py-1.5 rounded-xl border-2 border-[#2E2824] bg-[#FFFDF9] hover:bg-[#F2EDE4] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold font-handwriting flex items-center gap-1 shadow-[2px_2px_0px_#2E2824] active:translate-y-0.5 transition-all"
                      >
                        <span>次の日</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* External Document Link */}
                  {story.doc_link && (
                    <div className="pt-2 text-center">
                      <a
                        href={story.doc_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#8C5A3E] hover:underline font-handwriting bg-[#FFFDF9] px-3 py-1.5 rounded-lg border border-[#8C5A3E]/30"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Google Docs 原本記録を見る</span>
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-3 bg-[#F2EDE4] border-t-2 border-[#2E2824] flex items-center justify-between shrink-0">
            <div className="text-[11px] text-[#7A726A] font-handwriting flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#8C5A3E]" />
                <span>物語記録</span>
              </span>
              {isStoryAlreadyRead && (
                <span className="bg-[#FEF3C7] text-[#B45309] font-bold px-2 py-0.5 rounded-full border border-[#D97706]/40 text-[10px]">
                  ✨ 最終話読了ボーナス (+20pt) 獲得済み
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border-2 border-[#2E2824] bg-[#FFFDF9] hover:bg-[#F0EBE1] active:translate-y-0.5 text-xs font-bold text-[#2E2824] font-handwriting transition-all shadow-[2px_2px_0px_#2E2824]"
            >
              閉じる
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
