import React from 'react';
import { RewardTicket, TICKET_DEFINITIONS } from '../types/rewards';
import { Check, Sparkles, Clock, AlertCircle } from 'lucide-react';

interface TicketItemViewProps {
  ticket: RewardTicket;
  onUse?: (ticket: RewardTicket) => void;
  disabled?: boolean;
}

export const TicketItemView: React.FC<TicketItemViewProps> = ({
  ticket,
  onUse,
  disabled = false,
}) => {
  const def = TICKET_DEFINITIONS[ticket.type] || {
    title: ticket.title,
    description: ticket.description,
    shortLabel: '引換券',
    iconEmoji: '🎟️',
    bgColor: '#FFFDF9',
    borderColor: '#7A726A',
    accentColor: '#2E2824',
    rarity: ticket.rarity,
  };

  const formatDate = (ms?: number) => {
    if (!ms) return '';
    const d = new Date(ms);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 transition-all ${
        ticket.isUsed
          ? 'bg-[#F2ECE4]/70 border-[#8C827A]/40 opacity-75 grayscale-[0.2]'
          : 'bg-[#FFFDF9] hover:shadow-md border-[#2E2824]'
      }`}
      style={{
        boxShadow: ticket.isUsed
          ? '2px 2px 0px #A89F91'
          : '3px 3px 0px #2E2824',
      }}
    >
      {/* Perforated ticket top header bar */}
      <div
        className="px-4 py-2 flex items-center justify-between border-b-2 border-dashed"
        style={{
          backgroundColor: def.bgColor,
          borderColor: ticket.isUsed ? '#A89F91' : def.borderColor,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xl">{def.iconEmoji}</span>
          <span
            className="text-xs font-bold font-handwriting tracking-wide px-2 py-0.5 rounded-full border"
            style={{
              borderColor: def.accentColor,
              color: def.accentColor,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            {ticket.rarity === 'gold'
              ? '★ 特賞'
              : ticket.rarity === 'silver'
              ? '★ 1等'
              : '★ 2等'}{' '}
            {def.shortLabel}
          </span>
        </div>

        <span className="font-mono text-[10px] text-[#7A726A] font-bold">
          № {ticket.id.slice(-6).toUpperCase()}
        </span>
      </div>

      {/* Ticket main body */}
      <div className="p-4 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h4
              className={`text-base sm:text-lg font-bold font-handwriting ${
                ticket.isUsed ? 'text-[#7A726A] line-through' : 'text-[#2E2824]'
              }`}
            >
              {ticket.title}
            </h4>
            <p className="text-xs sm:text-sm font-handwriting text-[#5A524A] leading-relaxed">
              {ticket.description}
            </p>
            <div className="flex items-center gap-3 text-[11px] text-[#7A726A] pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                獲得: {formatDate(ticket.obtainedAt)}
              </span>
              {ticket.isUsed && ticket.usedAt && (
                <span className="flex items-center gap-1 text-[#B91C1C] font-bold">
                  <Check className="w-3 h-3" />
                  使用: {formatDate(ticket.usedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Action button or Used stamp */}
          <div className="flex items-center justify-end shrink-0 pt-2 sm:pt-0">
            {!ticket.isUsed ? (
              <button
                type="button"
                onClick={() => onUse && onUse(ticket)}
                disabled={disabled}
                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold font-handwriting bg-[#8C5A3E] hover:bg-[#72452E] text-white border-2 border-[#2E2824] shadow-[2px_2px_0px_#2E2824] active:translate-y-0.5 active:shadow-[1px_1px_0px_#2E2824] transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-[#FDE68A]" />
                <span>使う</span>
              </button>
            ) : (
              <div className="text-right">
                <span className="inline-block px-3 py-1 rounded-lg text-xs font-bold text-[#7A726A] bg-[#E8E1D5] border border-[#8C827A]/50 font-handwriting">
                  使用済み
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Big vintage ink stamp when used */}
        {ticket.isUsed && (
          <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none rotate-[-16deg] select-none">
            <div className="w-24 h-24 rounded-full border-4 border-[#B91C1C]/85 flex flex-col items-center justify-center text-[#B91C1C]/85 font-black shadow-inner p-1">
              <span className="text-[10px] tracking-widest font-mono">REDEEMED</span>
              <span className="text-2xl tracking-widest font-handwriting leading-none my-0.5">
                済
              </span>
              <span className="text-[9px] font-mono leading-none">
                {ticket.usedAt ? new Date(ticket.usedAt).toISOString().slice(0, 10) : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Realistic notch cutouts on edges */}
      <div className="absolute -left-2.5 top-[34px] w-5 h-5 rounded-full bg-[#FAF8F4] border-r-2 border-[#2E2824]" />
      <div className="absolute -right-2.5 top-[34px] w-5 h-5 rounded-full bg-[#FAF8F4] border-l-2 border-[#2E2824]" />
    </div>
  );
};
