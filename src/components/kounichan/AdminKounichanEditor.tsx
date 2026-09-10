import React, { useState, useRef } from 'react';
import {
  KounichanSettings,
  KounichanVehicleConfig,
  KounichanVehicleId,
  DEFAULT_KOUNICHAN_SETTINGS,
  DEFAULT_KOUNICHAN_VEHICLES,
} from '../../types/kounichan';
import { GameSaveData } from '../../types';
import { KounichanVehicleIllustration } from './KounichanVehicleIllustration';
import { AdminKounichanTestTrack } from './AdminKounichanTestTrack';
import {
  processBackgroundTransparency,
  compressAndResizeImage,
  TransparencyOptions,
} from '../../services/imageCompression';
import { getAssetUrl, handleImageError } from '../../utils/assetPath';
import {
  Upload,
  Play,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Save,
  Settings,
  Image as ImageIcon,
  Sliders,
  Scissors,
  Eye,
  Zap,
  Gauge,
  Clock,
  Layers,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { saveGlobalKounichanSettings } from '../../services/firebaseSync';

interface AdminKounichanEditorProps {
  saveData: GameSaveData;
  onUpdateSaveData: (updater: (prev: GameSaveData) => GameSaveData, isImmediate?: boolean) => void;
}

const VEHICLE_ORDER: KounichanVehicleId[] = [
  'tricycle_turbo',
  'koyumi_2',
  'four_wheeler',
  'dendrobium',
  'space_trike',
  'aqua_yakkun',
];

export const AdminKounichanEditor: React.FC<AdminKounichanEditorProps> = ({
  saveData,
  onUpdateSaveData,
}) => {
  const settings: KounichanSettings = saveData.kounichan || DEFAULT_KOUNICHAN_SETTINGS;

  const [activeVehicleId, setActiveVehicleId] = useState<KounichanVehicleId>('tricycle_turbo');
  const [sheetDragActive, setSheetDragActive] = useState(false);
  const [isProcessingSheet, setIsProcessingSheet] = useState(false);
  const [sheetStatus, setSheetStatus] = useState<string | null>(null);

  // Sliced previews from sheet
  const [slicedPreviews, setSlicedPreviews] = useState<Record<KounichanVehicleId, string> | null>(null);

  // Firestore Cloud Sync status
  const [isSavingToFirestore, setIsSavingToFirestore] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Transparency options for slicing
  const [autoTrans, setAutoTrans] = useState(true);
  const [tolerance, setTolerance] = useState(32);
  const [feather, setFeather] = useState(2);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const singleFileInputRef = useRef<HTMLInputElement | null>(null);
  const currentSingleTargetRef = useRef<KounichanVehicleId | null>(null);
  const testTrackRef = useRef<HTMLDivElement | null>(null);

  // Helper to update settings
  const updateSettings = (updater: (prev: KounichanSettings) => KounichanSettings) => {
    onUpdateSaveData((prev) => {
      const current = prev.kounichan || DEFAULT_KOUNICHAN_SETTINGS;
      return {
        ...prev,
        kounichan: updater(current),
      };
    }, true);
  };

  // Trigger test run on stage
  const handleTestRun = (vehicleId?: KounichanVehicleId) => {
    const event = new CustomEvent('kounichan:test_run', {
      detail: { vehicleId: vehicleId || activeVehicleId },
    });
    window.dispatchEvent(event);

    try {
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#C8744E', '#F59E0B', '#3B82F6'],
      });
    } catch (e) {}
  };

  /**
   * Save Kounichan settings to Firestore Global Master (ken-chiko-global-state)
   */
  const handleSaveToFirestore = async () => {
    setIsSavingToFirestore(true);
    setSaveStatus(null);
    try {
      const res = await saveGlobalKounichanSettings(settings);
      if (res.success) {
        setSaveStatus({
          type: 'success',
          message: '共通データベース（Firestore）に正常に保存しました！全ユーザー・全端末に反映されます。',
        });
        try {
          confetti({ particleCount: 50, spread: 80, origin: { y: 0.5 } });
        } catch (e) {}
      } else {
        setSaveStatus({
          type: 'error',
          message: res.error || 'Firestoreへの保存に失敗しました。',
        });
      }
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: err?.message || 'Firestore保存中にエラーが発生しました。',
      });
    } finally {
      setIsSavingToFirestore(false);
    }
  };

  /**
   * Process 6-in-1 image sheet (2 rows x 3 columns)
   */
  const process6In1Sheet = async (file: File) => {
    setIsProcessingSheet(true);
    setSheetStatus('📸 画像を読み込み中...');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawDataUrl = e.target?.result as string;
        if (!rawDataUrl) return;

        const img = new Image();
        img.onload = () => {
          setSheetStatus('✂️ 6台の乗り物を自動切り出し＆背景透過処理中...');

          const imgW = img.naturalWidth;
          const imgH = img.naturalHeight;

          // 2 rows, 3 columns
          // Col 0: 0% to 33.3%, Col 1: 33.3% to 66.6%, Col 2: 66.6% to 100%
          // Row 0: 0% to 50%, Row 1: 50% to 100%
          const gridConfig: { id: KounichanVehicleId; row: number; col: number }[] = [
            { id: 'tricycle_turbo', row: 0, col: 0 },
            { id: 'koyumi_2', row: 0, col: 1 },
            { id: 'four_wheeler', row: 0, col: 2 },
            { id: 'dendrobium', row: 1, col: 0 },
            { id: 'space_trike', row: 1, col: 1 },
            { id: 'aqua_yakkun', row: 1, col: 2 },
          ];

          const slicedResults: Record<KounichanVehicleId, string> = {} as any;

          gridConfig.forEach(({ id, row, col }) => {
            const cellW = imgW / 3;
            const cellH = imgH / 2;

            const startX = col * cellW;
            const startY = row * cellH;

            // Downscale to web-optimized retina size (max 320x320) so all 6 vehicles fit safely in Firestore
            const maxDim = 320;
            let targetW = cellW;
            let targetH = cellH;
            if (targetW > maxDim || targetH > maxDim) {
              if (targetW > targetH) {
                targetH = Math.round((targetH * maxDim) / targetW);
                targetW = maxDim;
              } else {
                targetW = Math.round((targetW * maxDim) / targetH);
                targetH = maxDim;
              }
            }

            // Crop the individual vehicle
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = targetW;
            cropCanvas.height = targetH;
            const ctx = cropCanvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(img, startX, startY, cellW, cellH, 0, 0, targetW, targetH);

            // Apply smart transparency
            let finalCanvas = cropCanvas;
            if (autoTrans) {
              finalCanvas = processBackgroundTransparency(cropCanvas, {
                enableTransparency: true,
                tolerance,
                feather,
                trimPadding: true,
              });
            }

            slicedResults[id] = finalCanvas.toDataURL('image/png');
          });

          setSlicedPreviews(slicedResults);
          setIsProcessingSheet(false);
          setSheetStatus('✨ 6台の切り出しが完了しました！下の「一括適用」ボタンで反映できます。');

          try {
            confetti({ particleCount: 40, spread: 70, origin: { y: 0.5 } });
          } catch (e) {}
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsProcessingSheet(false);
      setSheetStatus('❌ 画像の切り出し中にエラーが発生しました。');
    }
  };

  /**
   * Apply the 6 sliced images to settings
   */
  const handleApplyAllSliced = () => {
    if (!slicedPreviews) return;

    updateSettings((prev) => {
      const updatedVehicles = { ...prev.vehicles };
      VEHICLE_ORDER.forEach((id) => {
        if (slicedPreviews[id]) {
          updatedVehicles[id] = {
            ...updatedVehicles[id],
            customImageUrl: slicedPreviews[id],
          };
        }
      });
      return {
        ...prev,
        vehicles: updatedVehicles,
      };
    });

    setSheetStatus('🎉 6台すべての乗り物イラストが更新・保存されました！');
    try {
      confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
    } catch (e) {}
  };

  /**
   * Handle single vehicle image upload
   */
  const handleSingleImageUpload = (file: File, vehicleId: KounichanVehicleId) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const maxDim = 360;
        let targetW = img.naturalWidth;
        let targetH = img.naturalHeight;
        if (targetW > maxDim || targetH > maxDim) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * maxDim) / targetW);
            targetW = maxDim;
          } else {
            targetW = Math.round((targetW * maxDim) / targetH);
            targetH = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, targetW, targetH);

        let finalCanvas = canvas;
        if (autoTrans) {
          finalCanvas = processBackgroundTransparency(canvas, {
            enableTransparency: true,
            tolerance,
            feather,
            trimPadding: true,
          });
        }

        const pngUrl = finalCanvas.toDataURL('image/png');
        updateSettings((prev) => ({
          ...prev,
          vehicles: {
            ...prev.vehicles,
            [vehicleId]: {
              ...prev.vehicles[vehicleId],
              customImageUrl: pngUrl,
            },
          },
        }));

        try {
          confetti({ particleCount: 25, spread: 50, origin: { y: 0.6 } });
        } catch (err) {}
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const activeVehicle = settings.vehicles[activeVehicleId] || DEFAULT_KOUNICHAN_VEHICLES[activeVehicleId];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            process6In1Sheet(e.target.files[0]);
          }
        }}
      />
      <input
        type="file"
        ref={singleFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0] && currentSingleTargetRef.current) {
            handleSingleImageUpload(e.target.files[0], currentSingleTargetRef.current);
          }
        }}
      />

      {/* Header Banner */}
      <div className="bg-[#FAF2EB] p-4 sm:p-5 rounded-2xl border border-[#F0D5C3]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛵</span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#874A2E] font-handwriting">
                こうにちゃん＆のりもの設定
              </h3>
              <p className="text-xs text-[#9E5D3B] mt-0.5">
                ねこが不在のときに画面を横切る「こうにちゃん」の乗り物・オノマトペ・イラスト管理
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSaveToFirestore}
              disabled={isSavingToFirestore}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#487560] hover:bg-[#3B614F] text-white text-xs font-black rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingToFirestore ? 'DBに保存中...' : '💾 データベース（Firestore共通）に保存'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                testTrackRef.current?.scrollIntoView({ behavior: 'smooth' });
                handleTestRun();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#C8744E] hover:bg-[#B3623D] text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>テストコースで走らせる</span>
            </button>
          </div>
        </div>

        {/* Save Status Notification Banner */}
        {saveStatus && (
          <div
            className={`mt-2 mb-3 p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold ${
              saveStatus.type === 'success'
                ? 'bg-[#EBF7F0] border-[#A8D5BA] text-[#2D5A3F]'
                : 'bg-[#FFF2F0] border-[#F0A8A0] text-[#8C2E24]'
            }`}
          >
            <div className="flex items-center gap-2">
              {saveStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#487560]" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-[#D4736A]" />
              )}
              <span>{saveStatus.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveStatus(null)}
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Master ON/OFF Toggle Bar (Prompt: 一度無効にして！管理画面の無効をオンにして！) */}
        <div
          className={`mt-3 p-3.5 rounded-2xl border transition-all shadow-xs ${
            !settings.enabled
              ? 'bg-[#FEF2F2] border-[#FCA5A5]'
              : 'bg-[#F0FDF4] border-[#86EFAC]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <span
                className={`w-3.5 h-3.5 mt-1 sm:mt-0 rounded-full shrink-0 ${
                  !settings.enabled
                    ? 'bg-red-500 ring-4 ring-red-200 animate-pulse'
                    : 'bg-emerald-500 ring-4 ring-emerald-200'
                }`}
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-sm font-black font-handwriting ${
                      !settings.enabled ? 'text-red-700' : 'text-emerald-800'
                    }`}
                  >
                    {!settings.enabled
                      ? '🛑【現在：無効中】こうにちゃんはステージに自動出現しません'
                      : '🟢【現在：有効中】ねこ不在時にこうにちゃんが横切ります'}
                  </span>
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-gray-200 font-bold text-[#7A6B63]">
                    トリプルタップ検証対応
                  </span>
                </div>
                <p className="text-xs text-[#5C544D] mt-0.5 font-handwriting">
                  {!settings.enabled
                    ? '「無効」がオンになっています。ステージ画面を素早く3回タップ（トリプルタップ）すると検証時のみ呼び出せます。'
                    : '通常設定です。ねこがいない時に設定された頻度でランダム走行します。'}
                </p>
              </div>
            </div>

            {/* Clear Radio-style Master Switch Buttons */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => updateSettings((prev) => ({ ...prev, enabled: false }))}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                  !settings.enabled
                    ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                <span>🛑 無効にする（登場させない）</span>
                {!settings.enabled && <span className="text-xs">✓ 適用中</span>}
              </button>
              <button
                type="button"
                onClick={() => updateSettings((prev) => ({ ...prev, enabled: true }))}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                  settings.enabled
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                <span>🟢 有効にする</span>
                {settings.enabled && <span className="text-xs">✓ 適用中</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#E8D0BE] text-center text-xs">
          <div className="bg-white/80 p-2 rounded-xl border border-[#E8D0BE]">
            <span className="text-[10px] text-[#7A6B63] block">目撃回数</span>
            <span className="text-base font-bold text-[#3E3833] font-mono">
              {settings.stats.totalSpotted || 0}回
            </span>
          </div>
          <div className="bg-white/80 p-2 rounded-xl border border-[#E8D0BE]">
            <span className="text-[10px] text-[#7A6B63] block">タップ回数</span>
            <span className="text-base font-bold text-[#C8744E] font-mono">
              {settings.stats.totalTapped || 0}回
            </span>
          </div>
          <div className="bg-white/80 p-2 rounded-xl border border-[#E8D0BE]">
            <span className="text-[10px] text-[#7A6B63] block">もらったポイント</span>
            <span className="text-base font-bold text-[#15803D] font-mono">
              +{settings.stats.pointsGifted || 0}pt
            </span>
          </div>
          <div className="bg-white/80 p-2 rounded-xl border border-[#E8D0BE]">
            <span className="text-[10px] text-[#7A6B63] block">連れてきたねこ</span>
            <span className="text-base font-bold text-[#8B5CF6] font-mono">
              {settings.stats.catsGifted || 0}匹
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: In-Admin Live Interactive Test Track Course                      */}
      {/* ========================================================================= */}
      <div ref={testTrackRef} className="scroll-mt-4">
        <AdminKounichanTestTrack
          settings={settings}
          activeVehicleId={activeVehicleId}
          onSelectVehicle={(id) => setActiveVehicleId(id)}
          undiscoveredCats={saveData.characters.filter((c) => !c.discovered && !c.isDiscovered)}
          onClaimGift={(type, cat) => {
            if (type === 'cat' && cat) {
              onUpdateSaveData((prev) => ({
                ...prev,
                characters: prev.characters.map((c) =>
                  c.no === cat.no
                    ? {
                        ...c,
                        discovered: true,
                        isDiscovered: true,
                        lastEncounterTime: Date.now(),
                      }
                    : c
                ),
              }), true);
            }
          }}
          onUpdateStats={(updater) => {
            updateSettings((prev) => ({
              ...prev,
              stats: updater(prev.stats),
            }));
          }}
        />
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: 6-in-1 Sheet Auto-Slicer (2 Rows x 3 Columns)                  */}
      {/* ========================================================================= */}
      <div className="bg-[#FFFDF9] p-4 sm:p-5 rounded-2xl border-2 border-[#DDD7C8] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-[#C8744E]" />
            <h4 className="text-xs sm:text-sm font-black text-[#2E2824] font-handwriting">
              6台一括画像シート（横3台×縦2台）自動スライス＆透過取り込み
            </h4>
          </div>
          <span className="text-[10px] bg-[#EAE5D9] text-[#5C544D] font-bold px-2 py-0.5 rounded-full">
            一発登録
          </span>
        </div>

        <p className="text-xs text-[#7A726A] leading-relaxed">
          横3台・縦2台で並んだイラスト画像（用紙に描かれたイラスト）をドラッグ＆ドロップすると、
          <strong>6台すべてを個別に自動スライス＆白・クリーム色背景を透過処理</strong>して一括設定できます。
        </p>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setSheetDragActive(true);
          }}
          onDragLeave={() => setSheetDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSheetDragActive(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              process6In1Sheet(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition flex flex-col items-center justify-center ${
            sheetDragActive
              ? 'border-[#C8744E] bg-[#FAF2EB]'
              : 'border-[#DDD7C8] bg-[#FAF8F5] hover:border-[#C8744E]'
          }`}
        >
          <Upload className="w-8 h-8 text-[#C8744E] mb-2" />
          <p className="text-xs font-bold text-[#2E2824]">
            6台並んだイラスト画像をここにドラッグ＆ドロップ
          </p>
          <p className="text-[11px] text-[#7A726A] mt-1">
            またはクリックして画像ファイル（PNG / JPG）を選択
          </p>
          <div className="mt-3 flex items-center gap-3 text-[10px] text-[#9E958C]">
            <span>上段: 三輪車 / こゆみ号2 / 四輪車</span>
            <span>・</span>
            <span>下段: デンドロビウム風 / 宇宙仕様 / やっくん</span>
          </div>
        </div>

        {/* Transparency Options */}
        <div className="p-3 bg-[#FAF8F4] rounded-xl border border-[#EAE5D9] flex flex-wrap items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-[#3E3833]">
            <input
              type="checkbox"
              checked={autoTrans}
              onChange={(e) => setAutoTrans(e.target.checked)}
              className="rounded text-[#C8744E] focus:ring-[#C8744E]"
            />
            <span>紙の背景を自動透過する (スマート透過)</span>
          </label>

          {autoTrans && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[#7A726A]">透過許容度:</span>
                <input
                  type="range"
                  min={10}
                  max={60}
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="w-24 accent-[#C8744E]"
                />
                <span className="font-mono font-bold text-[#3E3833]">{tolerance}</span>
              </div>
            </div>
          )}
        </div>

        {sheetStatus && (
          <p className="text-xs font-bold text-[#C8744E] bg-[#FAF2EB] px-3 py-2 rounded-xl border border-[#F0D5C3]">
            {sheetStatus}
          </p>
        )}

        {/* Sliced Previews */}
        {slicedPreviews && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-[#3E3833]">切り出し結果プレビュー</h5>
              <button
                type="button"
                onClick={handleApplyAllSliced}
                className="px-4 py-2 bg-[#2E2824] hover:bg-[#453D37] text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-[#A7F3D0]" />
                <span>この6台を一括適用する！</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {VEHICLE_ORDER.map((id) => {
                const v = settings.vehicles[id] || DEFAULT_KOUNICHAN_VEHICLES[id];
                const previewImg = slicedPreviews[id];
                return (
                  <div
                    key={id}
                    className="bg-[#FAF8F5] p-2 rounded-xl border border-[#DDD7C8] flex flex-col items-center text-center"
                  >
                    <span className="text-[10px] font-bold text-[#5C544D] truncate w-full mb-1">
                      {v.name.split('（')[0]}
                    </span>
                    <div
                      className="w-full aspect-square rounded-lg border border-[#2E2824]/20 p-1 flex items-center justify-center overflow-hidden"
                      style={{
                        backgroundImage:
                          'linear-gradient(45deg, #E2DFD8 25%, transparent 25%), linear-gradient(-45deg, #E2DFD8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #E2DFD8 75%), linear-gradient(-45deg, transparent 75%, #E2DFD8 75%)',
                        backgroundSize: '12px 12px',
                        backgroundColor: '#F7F5F0',
                      }}
                    >
                      {previewImg && (
                        <img
                          src={previewImg}
                          alt={v.name}
                          className="max-w-full max-h-full object-contain filter drop-shadow-sm"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: Individual Vehicle Cards & Customization                       */}
      {/* ========================================================================= */}
      <div className="bg-[#FFFDF9] p-4 sm:p-5 rounded-2xl border-2 border-[#DDD7C8] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#C8744E]" />
            <h4 className="text-xs sm:text-sm font-black text-[#2E2824] font-handwriting">
              乗り物ごとの個別設定・イラスト差し替え
            </h4>
          </div>
        </div>

        {/* Vehicle Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {VEHICLE_ORDER.map((id) => {
            const v = settings.vehicles[id] || DEFAULT_KOUNICHAN_VEHICLES[id];
            const isSelected = activeVehicleId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveVehicleId(id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-[#C8744E] text-white border-[#C8744E] shadow-sm'
                    : 'bg-[#FAF8F5] text-[#5C544D] border-[#DDD7C8] hover:bg-[#F2ECE4]'
                }`}
              >
                <span>{v.name.split('（')[0]}</span>
                {v.customImageUrl && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" title="カスタム画像設定中" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Vehicle Detail Card */}
        {activeVehicle && (
          <div className="bg-[#FAF8F5] p-4 sm:p-5 rounded-2xl border border-[#DDD7C8] space-y-4">
            <div className="flex flex-col md:flex-row gap-5 items-start">
              {/* Left: Vehicle Preview */}
              <div className="w-full md:w-56 shrink-0 flex flex-col items-center">
                <span className="text-[11px] font-bold text-[#7A726A] mb-1.5">
                  現在のイラスト表示
                </span>
                <div
                  className="w-48 h-40 rounded-2xl border-2 border-[#2E2824] p-3 flex items-center justify-center overflow-hidden relative shadow-inner"
                  style={{
                    backgroundImage:
                      'linear-gradient(45deg, #E2DFD8 25%, transparent 25%), linear-gradient(-45deg, #E2DFD8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #E2DFD8 75%), linear-gradient(-45deg, transparent 75%, #E2DFD8 75%)',
                    backgroundSize: '16px 16px',
                    backgroundColor: '#F7F5F0',
                  }}
                >
                  <KounichanVehicleIllustration
                    vehicle={activeVehicle}
                    size={140}
                    direction="ltr"
                  />
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      testTrackRef.current?.scrollIntoView({ behavior: 'smooth' });
                      handleTestRun(activeVehicle.id);
                    }}
                    className="px-3 py-1.5 bg-[#487560] hover:bg-[#3B624E] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>この乗り物をテストコースで走らせる</span>
                  </button>
                </div>

                {activeVehicle.customImageUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      updateSettings((prev) => ({
                        ...prev,
                        vehicles: {
                          ...prev.vehicles,
                          [activeVehicle.id]: {
                            ...prev.vehicles[activeVehicle.id],
                            customImageUrl: undefined,
                          },
                        },
                      }));
                    }}
                    className="mt-1.5 text-[10px] text-red-600 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>標準手描きSVGに戻す</span>
                  </button>
                )}
              </div>

              {/* Right: Controls & Text Fields */}
              <div className="flex-1 min-w-0 space-y-3 w-full">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h5 className="text-sm font-black text-[#2E2824] font-handwriting">
                      {activeVehicle.name}
                    </h5>
                    <span className="text-[11px] text-[#C8744E] font-bold">
                      登場時期: {activeVehicle.era}
                    </span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded-xl border border-[#DDD7C8] text-xs font-bold text-[#3E3833]">
                    <input
                      type="checkbox"
                      checked={activeVehicle.enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        updateSettings((prev) => ({
                          ...prev,
                          vehicles: {
                            ...prev.vehicles,
                            [activeVehicle.id]: {
                              ...prev.vehicles[activeVehicle.id],
                              enabled: checked,
                            },
                          },
                        }));
                      }}
                      className="rounded text-[#C8744E] focus:ring-[#C8744E]"
                    />
                    <span>出現対象にする</span>
                  </label>
                </div>

                <p className="text-xs text-[#7A726A]">{activeVehicle.description}</p>

                {/* Onomatopoeia Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-bold text-[#5C544D] block mb-1">
                      代表的な擬音（走行中）
                    </label>
                    <input
                      type="text"
                      value={activeVehicle.onomatopoeia}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateSettings((prev) => ({
                          ...prev,
                          vehicles: {
                            ...prev.vehicles,
                            [activeVehicle.id]: {
                              ...prev.vehicles[activeVehicle.id],
                              onomatopoeia: val,
                            },
                          },
                        }));
                      }}
                      className="w-full text-xs font-handwriting font-bold px-3 py-1.5 rounded-xl border border-[#DDD7C8] bg-white focus:outline-none focus:border-[#C8744E]"
                      placeholder="例: キコキコ"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#5C544D] block mb-1">
                      加速・ダッシュ時擬音（タップ時）
                    </label>
                    <input
                      type="text"
                      value={activeVehicle.turboOnomatopoeia}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateSettings((prev) => ({
                          ...prev,
                          vehicles: {
                            ...prev.vehicles,
                            [activeVehicle.id]: {
                              ...prev.vehicles[activeVehicle.id],
                              turboOnomatopoeia: val,
                            },
                          },
                        }));
                      }}
                      className="w-full text-xs font-handwriting font-bold px-3 py-1.5 rounded-xl border border-[#DDD7C8] bg-white focus:outline-none focus:border-[#C8744E]"
                      placeholder="例: ばびゅーん！"
                    />
                  </div>
                </div>

                {/* Speed Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-[#5C544D] block mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#7A726A]" />
                      <span>通常横断スピード: {activeVehicle.baseSpeedSec}秒</span>
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={20}
                      step={0.5}
                      value={activeVehicle.baseSpeedSec}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateSettings((prev) => ({
                          ...prev,
                          vehicles: {
                            ...prev.vehicles,
                            [activeVehicle.id]: {
                              ...prev.vehicles[activeVehicle.id],
                              baseSpeedSec: val,
                            },
                          },
                        }));
                      }}
                      className="w-full accent-[#C8744E]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#5C544D] block mb-1 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-[#E05B48]" />
                      <span>ダッシュ横断スピード: {activeVehicle.dashSpeedSec}秒</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={0.1}
                      value={activeVehicle.dashSpeedSec}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateSettings((prev) => ({
                          ...prev,
                          vehicles: {
                            ...prev.vehicles,
                            [activeVehicle.id]: {
                              ...prev.vehicles[activeVehicle.id],
                              dashSpeedSec: val,
                            },
                          },
                        }));
                      }}
                      className="w-full accent-[#E05B48]"
                    />
                  </div>
                </div>

                {/* Individual Image Upload Button & URL Override */}
                <div className="pt-2 border-t border-[#EAE5D9] flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      currentSingleTargetRef.current = activeVehicle.id;
                      singleFileInputRef.current?.click();
                    }}
                    className="px-3 py-1.5 bg-white border border-[#DDD7C8] hover:border-[#C8744E] text-[#2E2824] rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#C8744E]" />
                    <span>この乗り物だけ画像差し替え</span>
                  </button>

                  <div className="flex-1 min-w-[200px] flex items-center gap-1">
                    <input
                      type="text"
                      value={activeVehicle.customImageUrl || ''}
                      onChange={(e) => {
                        const url = e.target.value;
                        updateSettings((prev) => ({
                          ...prev,
                          vehicles: {
                            ...prev.vehicles,
                            [activeVehicle.id]: {
                              ...prev.vehicles[activeVehicle.id],
                              customImageUrl: url || undefined,
                            },
                          },
                        }));
                      }}
                      placeholder="または画像URL (https://...)"
                      className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-[#DDD7C8] bg-white text-[#3E3833] focus:outline-none focus:border-[#C8744E]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: Global Appearance & Spawn Frequency Settings                   */}
      {/* ========================================================================= */}
      <div className="bg-[#FFFDF9] p-4 sm:p-5 rounded-2xl border-2 border-[#DDD7C8] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EAE5D9] pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#C8744E]" />
            <div>
              <h4 className="text-xs sm:text-sm font-black text-[#2E2824] font-handwriting">
                全体動作・走行方向・出現頻度設定
              </h4>
              <p className="text-[11px] text-[#7A6B63]">
                設定を変更した後は「💾 データベース（Firestore共通）に保存」を押すと全端末・全ユーザーに即時反映されます。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveToFirestore}
            disabled={isSavingToFirestore}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#487560] hover:bg-[#3B614F] text-white text-xs font-black rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingToFirestore ? 'DB保存中...' : '💾 データベースに保存'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-bold text-[#5C544D] block mb-1">
              こうにちゃんの登場設定
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[#3E3833]">
                <input
                  type="radio"
                  name="kouni_enabled"
                  checked={!settings.enabled}
                  onChange={() => updateSettings((prev) => ({ ...prev, enabled: false }))}
                  className="text-red-600 focus:ring-red-600"
                />
                <span className={!settings.enabled ? 'text-red-700 font-black' : ''}>
                  🛑 無効にする
                </span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[#3E3833]">
                <input
                  type="radio"
                  name="kouni_enabled"
                  checked={settings.enabled}
                  onChange={() => updateSettings((prev) => ({ ...prev, enabled: true }))}
                  className="text-emerald-600 focus:ring-emerald-600"
                />
                <span className={settings.enabled ? 'text-emerald-700 font-black' : ''}>
                  🟢 有効にする
                </span>
              </label>
            </div>
            <p className="text-[11px] text-[#7A6B63] mt-1">
              ※無効時でもステージ上のトリプルタップ（素早く3回タップ）で検証走行が可能です。
            </p>
          </div>

          <div>
            <label className="font-bold text-[#5C544D] block mb-1">
              走行方向（画面を横切る向き）
            </label>
            <select
              value={settings.direction || 'rtl'}
              onChange={(e) => {
                const val = e.target.value as 'rtl' | 'ltr';
                updateSettings((prev) => ({ ...prev, direction: val }));
              }}
              className="w-full text-xs font-bold px-3 py-1.5 rounded-xl border border-[#DDD7C8] bg-white text-[#3E3833] focus:outline-none focus:border-[#C8744E]"
            >
              <option value="rtl">➡️ 右から左へ走行（固定・デフォルト推奨）</option>
              <option value="ltr">⬅️ 左から右へ走行</option>
            </select>
            <p className="text-[11px] text-[#7A6B63] mt-1">
              ご指定の「右から左に固定」設定をデータベースに保存・保持します。
            </p>
          </div>

          <div>
            <label className="font-bold text-[#5C544D] block mb-1">
              出現頻度（ねこがいない時）
            </label>
            <select
              value={settings.frequency}
              onChange={(e) => {
                const val = e.target.value as KounichanSettings['frequency'];
                updateSettings((prev) => ({ ...prev, frequency: val }));
              }}
              className="w-full text-xs font-bold px-3 py-1.5 rounded-xl border border-[#DDD7C8] bg-white text-[#3E3833] focus:outline-none focus:border-[#C8744E]"
            >
              <option value="test">⚡ テスト用（約8〜14秒おき・すぐ見たい時）</option>
              <option value="often">よく出る（約25〜50秒おき）</option>
              <option value="normal">ときどき（約1〜2分おき・標準）</option>
              <option value="rare">めったに出ない（約3〜5分おき・レア）</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
