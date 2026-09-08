import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  X,
  Sparkles,
  Ticket,
  HelpCircle,
  History,
  AlertTriangle,
  RotateCw,
  Gift,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import {
  UserRewardState,
  RewardTicket,
  GARAPON_COST,
  TICKET_DEFINITIONS,
  GaraponBallColor,
} from '../types/rewards';
import { NyanCharacter } from '../types';
import { spinGarapon, markTicketAsUsed, GaraponResult } from '../services/rewardService';
import { TicketItemView } from './TicketItemView';

interface GaraponModalProps {
  isOpen: boolean;
  onClose: () => void;
  rewardState: UserRewardState;
  characters: NyanCharacter[];
  onUpdateRewards: (
    updatedRewards: UserRewardState,
    updatedCharacters?: NyanCharacter[],
    newToastMessage?: string
  ) => void;
  onOpenStory?: (nyan: NyanCharacter) => void;
}

type TabType = 'garapon' | 'tickets' | 'rules';

export const GaraponModal: React.FC<GaraponModalProps> = ({
  isOpen,
  onClose,
  rewardState,
  characters,
  onUpdateRewards,
  onOpenStory,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('garapon');
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [spinRotation, setSpinRotation] = useState<number>(0);
  const [chuteBallColor, setChuteBallColor] = useState<GaraponBallColor | null>(null);
  const [lastResult, setLastResult] = useState<GaraponResult | null>(null);
  const [ticketToUse, setTicketToUse] = useState<RewardTicket | null>(null);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'active' | 'used'>('active');

  const resultRef = React.useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const points = rewardState.points || 0;
  const tickets = rewardState.tickets || [];
  const unusedTickets = tickets.filter((t) => !t.isUsed);
  const usedTickets = tickets.filter((t) => t.isUsed);
  const canSpin = points >= GARAPON_COST && !isSpinning;

  // Sound effect synthesizer (shopping district bell chime)
  const playChimeSound = (isWin: boolean) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      if (isWin) {
        // Brass handbell ringing (Shopping district style: カランカランカラーン！)
        const notes = [1046.5, 1318.5, 1567.98, 2093.0];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.09);
          gain.gain.setValueAtTime(0.22, now + idx * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.09);
          osc.stop(now + idx * 0.09 + 0.65);
        });
      } else {
        // Drop chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch {}
  };

  // Handle Garapon Spin
  const handleSpinClick = () => {
    if (!canSpin) return;

    setIsSpinning(true);
    setLastResult(null);
    setChuteBallColor(null);

    // Calculate outcome beforehand
    const outcome = spinGarapon(rewardState, characters);

    // Rotate Garapon wheel 3-4 full turns
    const nextRot = spinRotation + 360 * 3 + Math.floor(Math.random() * 90 + 45);
    setSpinRotation(nextRot);

    // Ball emerges from chute at 1100ms
    setTimeout(() => {
      if (outcome.success && outcome.result) {
        setChuteBallColor(outcome.result.ballColor);
      }
    }, 1100);

    // Stop wheel and show result in-place at 1600ms
    setTimeout(() => {
      setIsSpinning(false);

      if (outcome.success && outcome.result) {
        setLastResult(outcome.result);
        onUpdateRewards(outcome.updatedState, outcome.updatedCharacters);

        // Sound effect
        playChimeSound(outcome.result.ballColor !== 'white');

        // Scroll result into view smoothly
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);

        // Confetti celebrations based on ball color
        if (outcome.result.ballColor === 'gold') {
          try {
            confetti({
              particleCount: 80,
              spread: 100,
              origin: { y: 0.5 },
              colors: ['#D97706', '#F59E0B', '#FDE68A', '#FFFBEB'],
            });
          } catch {}
        } else if (outcome.result.ballColor === 'silver') {
          try {
            confetti({
              particleCount: 60,
              spread: 80,
              origin: { y: 0.5 },
              colors: ['#64748B', '#94A3B8', '#CBD5E1', '#F8FAFC'],
            });
          } catch {}
        } else if (outcome.result.ballColor === 'red') {
          try {
            confetti({
              particleCount: 50,
              spread: 70,
              origin: { y: 0.5 },
              colors: ['#EF4444', '#F87171', '#FCA5A5'],
            });
          } catch {}
        } else if (outcome.result.ballColor === 'blue') {
          try {
            confetti({
              particleCount: 50,
              spread: 75,
              origin: { y: 0.5 },
              colors: ['#3B82F6', '#60A5FA', '#93C5FD', '#FDE68A'],
            });
          } catch {}
        }
      }
    }, 1600);
  };

  // Confirm Ticket Usage
  const handleConfirmUseTicket = () => {
    if (!ticketToUse) return;

    const res = markTicketAsUsed(rewardState, ticketToUse.id);
    if (res.success) {
      onUpdateRewards(res.updatedState);
      try {
        confetti({
          particleCount: 30,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#B91C1C', '#D97706', '#2E2824'],
        });
      } catch {}
    }
    setTicketToUse(null);
  };

  const filteredTickets =
    ticketFilter === 'active'
      ? unusedTickets
      : ticketFilter === 'used'
      ? usedTickets
      : tickets;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#2E2824]/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#FAF8F4] border-2 border-[#2E2824] rounded-3xl shadow-[4px_4px_0px_#2E2824] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#EAE3D2] border-b-2 border-[#2E2824] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#8C5A3E] text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 text-[#FDE68A]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-handwriting text-[#2E2824] leading-tight">
                🎪 けんちこ商店街 ガラポン福引所
              </h2>
              <p className="text-[11px] text-[#7A726A] font-handwriting">
                ポイントで福引を回して、実際のお菓子や本のご褒美引換券を当てよう！
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#DDD5C3] text-[#2E2824] border border-[#2E2824] transition-all"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Points Bar & Navigation Tabs */}
        <div className="bg-[#FFFDF9] border-b-2 border-[#2E2824] px-4 py-2 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 bg-[#F5EFE6] px-3 py-1.5 rounded-xl border border-[#2E2824]">
            <span className="text-xs font-bold text-[#7A726A] font-handwriting">
              所持ポイント:
            </span>
            <span className="text-base font-black font-handwriting text-[#B45309]">
              {points.toLocaleString()} pt
            </span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1.5 font-handwriting text-xs font-bold">
            <button
              onClick={() => setActiveTab('garapon')}
              className={`px-3 py-1.5 rounded-xl border transition-all ${
                activeTab === 'garapon'
                  ? 'bg-[#8C5A3E] text-white border-[#2E2824] shadow-[1px_1px_0px_#2E2824]'
                  : 'bg-[#FAF8F4] text-[#5A524A] hover:bg-[#F2EDE4] border-[#7A726A]/40'
              }`}
            >
              🎪 ガラポン
            </button>

            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1 ${
                activeTab === 'tickets'
                  ? 'bg-[#8C5A3E] text-white border-[#2E2824] shadow-[1px_1px_0px_#2E2824]'
                  : 'bg-[#FAF8F4] text-[#5A524A] hover:bg-[#F2EDE4] border-[#7A726A]/40'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>チケット ({unusedTickets.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-1.5 rounded-xl border transition-all ${
                activeTab === 'rules'
                  ? 'bg-[#8C5A3E] text-white border-[#2E2824] shadow-[1px_1px_0px_#2E2824]'
                  : 'bg-[#FAF8F4] text-[#5A524A] hover:bg-[#F2EDE4] border-[#7A726A]/40'
              }`}
            >
              📜 確率・ルール
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: GARAPON SPIN */}
          {activeTab === 'garapon' && (
            <div className="flex flex-col items-center justify-center space-y-5 py-2">
              {/* Garapon Machine Stage Visual */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
                {/* Background wood grain stage pedestal */}
                <div className="absolute bottom-2 w-52 h-10 bg-[#C89D7C] border-2 border-[#2E2824] rounded-xl shadow-[3px_3px_0px_#2E2824]" />
                <div className="absolute bottom-0 w-60 h-4 bg-[#8C5A3E] border-2 border-[#2E2824] rounded-lg shadow-[2px_2px_0px_#2E2824]" />

                {/* Triangular Stand Brackets */}
                <div className="absolute bottom-10 left-12 w-4 h-32 bg-[#8C5A3E] border-2 border-[#2E2824] rotate-[18deg] origin-bottom shadow-xs" />
                <div className="absolute bottom-10 right-12 w-4 h-32 bg-[#8C5A3E] border-2 border-[#2E2824] -rotate-[18deg] origin-bottom shadow-xs" />

                {/* Rotating Hexagonal Wheel */}
                <motion.div
                  className="relative w-44 h-44 rounded-[36px] bg-gradient-to-br from-[#F5DFB3] via-[#E2B778] to-[#C89352] border-4 border-[#2E2824] shadow-[4px_4px_0px_#2E2824] flex items-center justify-center z-10"
                  animate={{ rotate: spinRotation }}
                  transition={{
                    duration: isSpinning ? 1.8 : 0.3,
                    ease: isSpinning ? [0.25, 0.1, 0.25, 1] : 'easeOut',
                  }}
                >
                  {/* Wheel inner segments / decorative brass lines */}
                  <div className="absolute inset-2 border-2 border-dashed border-[#8C5A3E]/70 rounded-[28px]" />
                  <div className="w-12 h-12 rounded-full bg-[#E5C38E] border-2 border-[#2E2824] shadow-inner flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-[#8C5A3E] border border-[#2E2824]" />
                  </div>

                  {/* Ball inlet cover screw */}
                  <div className="absolute top-2 w-4 h-4 rounded-full bg-[#FAF8F4] border border-[#2E2824]" />
                </motion.div>

                {/* Crank Handle (Rotates slightly with wheel) */}
                <motion.div
                  className="absolute z-20 top-1/2 left-1/2 -translate-y-1/2 ml-14 flex items-center origin-left"
                  animate={{ rotate: spinRotation }}
                  transition={{ duration: isSpinning ? 1.8 : 0.3, ease: 'linear' }}
                >
                  <div className="w-10 h-3 bg-[#4A3B32] border border-[#2E2824] rounded-sm" />
                  <div className="w-4 h-10 bg-[#B91C1C] border border-[#2E2824] rounded-full shadow-xs" />
                </motion.div>

                {/* Chute & Outlet Tray at Bottom Right */}
                <div className="absolute bottom-8 right-6 w-16 h-8 bg-[#EAE3D2] border-2 border-[#2E2824] rounded-b-xl rounded-tr-xl flex items-center justify-center z-15 shadow-sm">
                  <div className="w-10 h-3 bg-[#3E3833] rounded-full" />
                </div>

                {/* Ejected rolling ball coming out of chute */}
                {chuteBallColor && (
                  <motion.div
                    initial={{ y: -30, x: -16, scale: 0.3, opacity: 0 }}
                    animate={{ y: 0, x: 0, scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 220 }}
                    className={`absolute bottom-8 right-9 w-7 h-7 rounded-full border-2 border-[#2E2824] shadow-md z-25 flex items-center justify-center ${
                      chuteBallColor === 'gold'
                        ? 'bg-[#F59E0B] shadow-[0_0_12px_rgba(245,158,11,0.9)]'
                        : chuteBallColor === 'silver'
                        ? 'bg-[#CBD5E1] shadow-[0_0_10px_rgba(203,213,225,0.9)]'
                        : chuteBallColor === 'red'
                        ? 'bg-[#EF4444] shadow-[0_0_10px_rgba(239,68,68,0.9)]'
                        : chuteBallColor === 'blue'
                        ? 'bg-[#3B82F6] shadow-[0_0_10px_rgba(59,130,246,0.9)]'
                        : 'bg-white shadow-[0_0_6px_rgba(0,0,0,0.2)]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-white/70 self-start ml-1 mt-0.5" />
                  </motion.div>
                )}

                {/* Spinning rattle indicator */}
                {isSpinning && (
                  <motion.div
                    className="absolute -top-3 px-3 py-1 bg-[#F59E0B] text-white font-black font-handwriting text-xs rounded-full border border-[#2E2824] shadow-md z-30 flex items-center gap-1"
                    animate={{ scale: [1, 1.1, 1], y: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 0.3 }}
                  >
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>ガラガラガラ…！</span>
                  </motion.div>
                )}

                {/* Top quick banner after spin */}
                {!isSpinning && lastResult && (
                  <div className="absolute -top-3 px-3.5 py-1 bg-[#FFFDF9] text-[#2E2824] font-black font-handwriting text-xs rounded-full border-2 border-[#2E2824] shadow-md z-30 flex items-center gap-1.5">
                    <span>
                      {lastResult.ballColor === 'gold'
                        ? '🥇 特賞！'
                        : lastResult.ballColor === 'silver'
                        ? '🥈 1等！'
                        : lastResult.ballColor === 'red'
                        ? '🥉 2等！'
                        : lastResult.ballColor === 'blue'
                        ? '🐾 にゃんこ賞！'
                        : '⚪ ハズレ'}
                    </span>
                    <span className="text-[#8C5A3E] truncate max-w-[160px]">
                      {lastResult.title}
                    </span>
                  </div>
                )}
              </div>

              {/* RESULT DISPLAY CARD - Direct In-Place (NO POPUPS / NO SHADOW OVERLAYS) */}
              <AnimatePresence>
                {lastResult && (
                  <motion.div
                    ref={resultRef}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-md bg-[#FFFDF9] border-3 border-[#2E2824] rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_#2E2824] space-y-3 relative overflow-hidden"
                  >
                    {/* Ball Color & Rank Emblem */}
                    <div className="flex items-center justify-between border-b border-[#2E2824]/20 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full border-2 border-[#2E2824] shadow-xs flex items-center justify-center font-bold text-xs ${
                            lastResult.ballColor === 'gold'
                              ? 'bg-gradient-to-br from-[#FDE68A] to-[#D97706] text-white shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                              : lastResult.ballColor === 'silver'
                              ? 'bg-gradient-to-br from-[#F8FAFC] to-[#64748B] text-white shadow-[0_0_8px_rgba(203,213,225,0.6)]'
                              : lastResult.ballColor === 'red'
                              ? 'bg-gradient-to-br from-[#FCA5A5] to-[#B91C1C] text-white shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                              : lastResult.ballColor === 'blue'
                              ? 'bg-gradient-to-br from-[#93C5FD] to-[#1D4ED8] text-white shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                              : 'bg-white text-[#7A726A]'
                          }`}
                        >
                          ●
                        </div>
                        <div>
                          <p className="font-handwriting font-bold text-[11px] text-[#8C5A3E] leading-none">
                            {lastResult.ballColor === 'gold'
                              ? '🥇 特賞（金の玉）'
                              : lastResult.ballColor === 'silver'
                              ? '🥈 1等（銀の玉）'
                              : lastResult.ballColor === 'red'
                              ? '🥉 2等（赤の玉）'
                              : lastResult.ballColor === 'blue'
                              ? '🐾 にゃんこ賞（青の玉）'
                              : '⚪ ざんねん賞（白の玉）'}
                          </p>
                          <h3 className="text-base sm:text-lg font-black font-handwriting text-[#2E2824] mt-0.5">
                            {lastResult.title}
                          </h3>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setLastResult(null)}
                        className="text-xs font-bold text-[#7A726A] hover:text-[#2E2824] font-handwriting px-2 py-1 rounded-md hover:bg-[#EAE5D9] transition cursor-pointer"
                        title="閉じる"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Result Description */}
                    <p className="text-xs sm:text-sm font-handwriting text-[#5A524A] leading-relaxed">
                      {lastResult.description}
                    </p>

                    {/* If Ticket Won */}
                    {lastResult.ticket && (
                      <div className="pt-1 space-y-2">
                        <TicketItemView ticket={lastResult.ticket} disabled={true} />
                        <div className="p-2.5 bg-[#F0FDF4] border border-[#86EFAC] rounded-xl flex items-center justify-between gap-2">
                          <p className="text-[11px] font-handwriting font-bold text-[#166534]">
                            🎟️ チケット入れに大切に保管しました！
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('tickets')}
                            className="text-xs font-bold font-handwriting px-3 py-1 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg transition shrink-0 cursor-pointer"
                          >
                            チケットを見る
                          </button>
                        </div>
                      </div>
                    )}

                    {/* If Undiscovered Nyan Won */}
                    {lastResult.discoveredNyan && (
                      <div className="bg-[#FAF8F4] border-2 border-[#2E2824] rounded-xl p-3 flex items-center gap-3">
                        <div className="w-14 h-14 rounded-lg bg-[#EAE5D9] border border-[#2E2824] flex items-center justify-center overflow-hidden shrink-0">
                          {lastResult.discoveredNyan.customImageUrl ? (
                            <img
                              src={lastResult.discoveredNyan.customImageUrl}
                              alt={lastResult.discoveredNyan.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="text-2xl">🐱</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold bg-[#8C5A3E] text-white px-1.5 py-0.5 rounded">
                              No.{lastResult.discoveredNyan.no}
                            </span>
                            <h4 className="font-handwriting font-bold text-sm text-[#2E2824] truncate">
                              {lastResult.discoveredNyan.name}
                            </h4>
                          </div>
                          <p className="text-[11px] text-[#7A726A] font-handwriting line-clamp-2 mt-0.5">
                            {lastResult.discoveredNyan.motif}
                          </p>
                          <span className="inline-block mt-1 text-[10px] font-bold font-handwriting px-2 py-0.5 bg-[#FEF3C7] text-[#B45309] border border-[#F59E0B] rounded-full">
                            ✨ 新発見ボーナス +50pt 獲得！
                          </span>
                        </div>
                        {onOpenStory && (
                          <button
                            type="button"
                            onClick={() => {
                              if (lastResult.discoveredNyan) {
                                onOpenStory(lastResult.discoveredNyan);
                              }
                            }}
                            className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold font-handwriting bg-[#487560] text-white border border-[#2E2824] cursor-pointer hover:bg-[#3B624F]"
                          >
                            物語へ
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Spin Action Button */}
              <div className="text-center space-y-2 w-full max-w-sm">
                <button
                  type="button"
                  onClick={handleSpinClick}
                  disabled={!canSpin}
                  className={`w-full py-3.5 px-6 rounded-2xl font-black font-handwriting text-base sm:text-lg border-2 border-[#2E2824] transition-all flex items-center justify-center gap-2 ${
                    canSpin
                      ? 'bg-[#B45309] hover:bg-[#92400E] text-white shadow-[3px_3px_0px_#2E2824] active:translate-y-0.5 active:shadow-[1px_1px_0px_#2E2824] cursor-pointer'
                      : 'bg-[#E5DFD5] text-[#8C827A] border-[#A89F91] cursor-not-allowed'
                  }`}
                >
                  <Sparkles className={`w-5 h-5 ${canSpin ? 'text-[#FDE68A]' : 'text-gray-400'}`} />
                  <span>
                    {isSpinning
                      ? '抽選中…！'
                      : lastResult
                      ? `もう1回まわす（1回 ${GARAPON_COST}pt）`
                      : points >= GARAPON_COST
                      ? `ガラポンを回す（1回 ${GARAPON_COST}pt）`
                      : `ポイント不足（あと ${GARAPON_COST - points}pt）`}
                  </span>
                </button>

                <p className="text-xs text-[#7A726A] font-handwriting">
                  新発見(+50pt)、物語読了(+20pt)、毎日なでる(+10pt)でポイントが貯まります
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: TICKETS HOLDER */}
          {activeTab === 'tickets' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1 bg-[#EAE3D2] p-1 rounded-xl border border-[#2E2824] font-handwriting text-xs font-bold">
                  <button
                    onClick={() => setTicketFilter('active')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      ticketFilter === 'active'
                        ? 'bg-[#8C5A3E] text-white shadow-xs'
                        : 'text-[#5A524A] hover:text-[#2E2824]'
                    }`}
                  >
                    使えるチケット ({unusedTickets.length})
                  </button>
                  <button
                    onClick={() => setTicketFilter('used')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      ticketFilter === 'used'
                        ? 'bg-[#8C5A3E] text-white shadow-xs'
                        : 'text-[#5A524A] hover:text-[#2E2824]'
                    }`}
                  >
                    使用済み ({usedTickets.length})
                  </button>
                  <button
                    onClick={() => setTicketFilter('all')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      ticketFilter === 'all'
                        ? 'bg-[#8C5A3E] text-white shadow-xs'
                        : 'text-[#5A524A] hover:text-[#2E2824]'
                    }`}
                  >
                    すべて ({tickets.length})
                  </button>
                </div>

                <span className="text-xs text-[#7A726A] font-handwriting">
                  ※家族や買ってくれる人の前で「使う」を押してね
                </span>
              </div>

              {/* Tickets List */}
              {filteredTickets.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {filteredTickets.map((t) => (
                    <TicketItemView
                      key={t.id}
                      ticket={t}
                      onUse={(target) => setTicketToUse(target)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center space-y-3 bg-[#FFFDF9] rounded-2xl border-2 border-dashed border-[#8C827A]/40 p-6">
                  <Ticket className="w-10 h-10 text-[#A89F91] mx-auto" />
                  <div className="space-y-1">
                    <p className="font-handwriting font-bold text-sm text-[#5A524A]">
                      {ticketFilter === 'active'
                        ? '現在使える引換券はありません'
                        : ticketFilter === 'used'
                        ? 'まだ使ったチケットはありません'
                        : 'チケットをまだ獲得していません'}
                    </p>
                    <p className="text-xs text-[#7A726A] font-handwriting">
                      ポイントを貯めて「ガラポン」を回してみよう！
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('garapon')}
                    className="px-4 py-2 rounded-xl text-xs font-bold font-handwriting bg-[#8C5A3E] text-white border border-[#2E2824] shadow-[2px_2px_0px_#2E2824]"
                  >
                    ガラポンへ行く
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RULES, RATES & HISTORY */}
          {activeTab === 'rules' && (
            <div className="space-y-5 font-sans">
              {/* How to Earn Points Card */}
              <div className="bg-[#FFFDF9] border-2 border-[#2E2824] rounded-2xl p-4 shadow-[2px_2px_0px_#2E2824] space-y-2.5">
                <h3 className="font-handwriting font-black text-sm sm:text-base text-[#2E2824] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#B45309]" />
                  <span>ポイントの貯め方</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-handwriting">
                  <div className="p-2.5 rounded-xl bg-[#FAF8F4] border border-[#2E2824]/20 space-y-1">
                    <div className="font-bold text-[#8C5A3E] flex items-center justify-between">
                      <span>にゃんこ新発見</span>
                      <span className="font-black text-[#B45309]">+50 pt</span>
                    </div>
                    <p className="text-[11px] text-[#7A726A]">
                      まだ出会っていないにゃんこと初めて遭遇したとき
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FAF8F4] border border-[#2E2824]/20 space-y-1">
                    <div className="font-bold text-[#8C5A3E] flex items-center justify-between">
                      <span>物語を最終話まで読了</span>
                      <span className="font-black text-[#B45309]">+20 pt</span>
                    </div>
                    <p className="text-[11px] text-[#7A726A]">
                      各にゃんこの会話劇・日記を最後まで読んだとき（各にゃんこ初回）
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FAF8F4] border border-[#2E2824]/20 space-y-1">
                    <div className="font-bold text-[#8C5A3E] flex items-center justify-between">
                      <span>けんちこを撫でる</span>
                      <span className="font-black text-[#B45309]">+10 pt</span>
                    </div>
                    <p className="text-[11px] text-[#7A726A]">
                      画面のけんちこを撫でると1日1回だけもらえるデイリーボーナス
                    </p>
                  </div>
                </div>
              </div>

              {/* Rate Table */}
              <div className="bg-[#FFFDF9] border-2 border-[#2E2824] rounded-2xl p-4 shadow-[2px_2px_0px_#2E2824] space-y-2.5">
                <h3 className="font-handwriting font-black text-sm sm:text-base text-[#2E2824] flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-[#8C5A3E]" />
                  <span>ガラポン福引の当選確率（1回 {GARAPON_COST}pt）</span>
                </h3>

                <div className="space-y-2 text-xs font-handwriting">
                  {/* Gold: Karuchieratan */}
                  <div className="p-2.5 rounded-xl bg-[#FFFBEB] border border-[#D97706] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#F59E0B] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        ●
                      </span>
                      <div>
                        <span className="font-bold text-[#B45309]">
                          🥇 かるちぇらたん引換券
                        </span>
                        <p className="text-[11px] text-[#78350F]">
                          カルチェラタンのお菓子が買ってもらえるよ！🍰
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-sm text-[#B45309] shrink-0">15%</span>
                  </div>

                  {/* Silver: Nyanko Book */}
                  <div className="p-2.5 rounded-xl bg-[#F1F5F9] border border-[#64748B] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#94A3B8] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        ●
                      </span>
                      <div>
                        <span className="font-bold text-[#334155]">
                          🥈 にゃんこ関連本引換券
                        </span>
                        <p className="text-[11px] text-[#475569]">
                          にゃんこが主役の本を買ってもらえるよ！📚
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-sm text-[#334155] shrink-0">10%</span>
                  </div>

                  {/* Red: Convenience Snack */}
                  <div className="p-2.5 rounded-xl bg-[#FEF2F2] border border-[#EF4444] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        ●
                      </span>
                      <div>
                        <span className="font-bold text-[#B91C1C]">
                          🥉 こんびにおかし引換券
                        </span>
                        <p className="text-[11px] text-[#991B1B]">
                          コンビニお菓子を買ってもらえるよ！🍫
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-sm text-[#B91C1C] shrink-0">30%</span>
                  </div>

                  {/* Blue: Undiscovered Nyan */}
                  <div className="p-2.5 rounded-xl bg-[#EFF6FF] border border-[#3B82F6] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#3B82F6] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        ●
                      </span>
                      <div>
                        <span className="font-bold text-[#1D4ED8]">
                          🐾 未発見にゃんこ発見！
                        </span>
                        <p className="text-[11px] text-[#1E40AF]">
                          まだ出会っていないにゃんこを即時発見＆新発見ボーナス(+50pt)も入る！✨
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-sm text-[#1D4ED8] shrink-0">20%</span>
                  </div>

                  {/* White: Miss */}
                  <div className="p-2.5 rounded-xl bg-[#FAF8F4] border border-[#7A726A]/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-white border border-[#2E2824] text-[#7A726A] flex items-center justify-center font-bold text-xs shrink-0">
                        ●
                      </span>
                      <div>
                        <span className="font-bold text-[#5A524A]">
                          ⚪ ざんねん賞（ハズレ）
                        </span>
                        <p className="text-[11px] text-[#7A726A]">
                          けんちこのほのぼの心温まるメッセージ
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-sm text-[#7A726A] shrink-0">25%</span>
                  </div>
                </div>
              </div>

              {/* Past Roll History */}
              <div className="bg-[#FFFDF9] border-2 border-[#2E2824] rounded-2xl p-4 shadow-[2px_2px_0px_#2E2824] space-y-2.5">
                <h3 className="font-handwriting font-black text-sm sm:text-base text-[#2E2824] flex items-center gap-1.5">
                  <History className="w-4 h-4 text-[#8C5A3E]" />
                  <span>福引履歴（直近50件）</span>
                </h3>

                {rewardState.history && rewardState.history.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {rewardState.history.map((h) => (
                      <div
                        key={h.id}
                        className="text-xs font-handwriting p-2 rounded-lg bg-[#FAF8F4] border border-[#2E2824]/10 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-3.5 h-3.5 rounded-full inline-block shrink-0 ${
                              h.ballColor === 'gold'
                                ? 'bg-[#F59E0B]'
                                : h.ballColor === 'silver'
                                ? 'bg-[#94A3B8]'
                                : h.ballColor === 'red'
                                ? 'bg-[#EF4444]'
                                : h.ballColor === 'blue'
                                ? 'bg-[#3B82F6]'
                                : 'bg-white border border-gray-400'
                            }`}
                          />
                          <span className="font-bold text-[#2E2824] truncate">
                            {h.prizeTitle}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#7A726A] font-mono shrink-0">
                          {new Date(h.timestamp).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#7A726A] font-handwriting text-center py-4">
                    まだ福引の履歴はありません
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* USE TICKET CONFIRMATION MODAL */}
        <AnimatePresence>
          {ticketToUse && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2824]/75 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm bg-[#FFFDF9] border-2 border-[#2E2824] rounded-2xl p-5 shadow-[4px_4px_0px_#2E2824] space-y-4 font-sans"
              >
                <div className="flex items-center gap-2 text-[#B91C1C]">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h3 className="font-handwriting font-black text-base text-[#B91C1C]">
                    チケットを使用しますか？
                  </h3>
                </div>

                <div className="p-3 bg-[#FAF8F4] border border-[#2E2824]/30 rounded-xl space-y-1">
                  <p className="font-handwriting font-bold text-sm text-[#2E2824]">
                    {ticketToUse.title}
                  </p>
                  <p className="font-handwriting text-xs text-[#7A726A]">
                    {ticketToUse.description}
                  </p>
                </div>

                <div className="text-xs text-[#5A524A] font-handwriting leading-relaxed space-y-1 bg-[#FFFBEB] p-3 rounded-xl border border-[#D97706]/40">
                  <p className="font-bold text-[#B45309]">【お家の方へ】</p>
                  <p>
                    このチケットは実際に使う金券代わりのチケットです。
                    買ってくれる人の目の前で「使用済みにする」を押してね！
                  </p>
                  <p className="text-[11px] text-[#B91C1C] font-bold pt-1">
                    ※一度使用済みにすると、元に戻すことはできません。
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTicketToUse(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold font-handwriting bg-[#FAF8F4] text-[#5A524A] border border-[#2E2824] hover:bg-[#F2EDE4]"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmUseTicket}
                    className="px-4 py-2 rounded-xl text-xs font-bold font-handwriting bg-[#B91C1C] text-white border-2 border-[#2E2824] shadow-[2px_2px_0px_#2E2824] active:translate-y-0.5"
                  >
                    使用済みにする
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
