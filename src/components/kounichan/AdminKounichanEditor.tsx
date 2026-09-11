/**
 * AdminKounichanEditor: Administrative editor for Kounichan crossing character and vehicle settings.
 * Supports image uploads, automatic pencil-line preservation transparency, and global Firestore sync.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Crop,
  Move,
  Maximize2,
  Minimize2,
  RefreshCw,
} from 'lucide-react';
import confetti from '../../utils/confetti';
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

export interface CropBox {
  x: number; // percentage (0..100)
  y: number; // percentage (0..100)
  width: number; // percentage (0..100)
  height: number; // percentage (0..100)
}

// 6台のデフォルト初期切り抜き枠（横3台 × 縦2台）
const DEFAULT_CROP_BOXES: Record<KounichanVehicleId, CropBox> = {
  tricycle_turbo: { x: 1, y: 1, width: 31.33, height: 48 },
  koyumi_2: { x: 34.33, y: 1, width: 31.33, height: 48 },
  four_wheeler: { x: 67.66, y: 1, width: 31.34, height: 48 },
  dendrobium: { x: 1, y: 51, width: 31.33, height: 48 },
  space_trike: { x: 34.33, y: 51, width: 31.33, height: 48 },
  aqua_yakkun: { x: 67.66, y: 51, width: 31.34, height: 48 },
};

export const AdminKounichanEditor: React.FC<AdminKounichanEditorProps> = ({
  saveData,
  onUpdateSaveData,
}) => {
  const settings: KounichanSettings = saveData.kounichan || DEFAULT_KOUNICHAN_SETTINGS;

  const [activeVehicleId, setActiveVehicleId] = useState<KounichanVehicleId>('tricycle_turbo');
  const [sheetDragActive, setSheetDragActive] = useState(false);
  const [isProcessingSheet, setIsProcessingSheet] = useState(false);
  const [sheetStatus, setSheetStatus] = useState<string | null>(null);

  // 6-in-1 Sheet raw image data URL (persisted in memory / settings)
  const [sheetImageSource, setSheetImageSource] = useState<string | null>(
    settings.customSheetUrl || null
  );

  // 1台ごとの切り抜き枠（パーセント座標 0〜100%）
  const [cropBoxes, setCropBoxes] = useState<Record<KounichanVehicleId, CropBox>>(DEFAULT_CROP_BOXES);

  // Sliced previews for each vehicle
  const [slicedPreviews, setSlicedPreviews] = useState<Record<KounichanVehicleId, string> | null>(null);

  // Firestore Cloud Sync status
  const [isSavingToFirestore, setIsSavingToFirestore] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Transparency options for slicing
  const [autoTrans, setAutoTrans] = useState(true);
  const [tolerance, setTolerance] = useState(32);
  const [feather, setFeather] = useState(2);
  const [trimPadding, setTrimPadding] = useState(true);

  // Dragging state for visual box adjuster
  const [dragState, setDragState] = useState<{
    vehicleId: KounichanVehicleId;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    initialBox: CropBox;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const singleFileInputRef = useRef<HTMLInputElement | null>(null);
  const currentSingleTargetRef = useRef<KounichanVehicleId | null>(null);
  const testTrackRef = useRef<HTMLDivElement | null>(null);
  const sheetViewerRef = useRef<HTMLDivElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // Helper to update settings (pure local draft)
  const updateSettings = (updater: (prev: KounichanSettings) => KounichanSettings) => {
    onUpdateSaveData((prev) => {
      const current = prev.kounichan || DEFAULT_KOUNICHAN_SETTINGS;
      return {
        ...prev,
        kounichan: updater(current),
      };
    }, false);
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
   * Slice a single vehicle from the loaded image with the specified bounding box
   */
  const sliceSingleVehicle = useCallback(
    (
      img: HTMLImageElement,
      box: CropBox,
      isAutoTrans = autoTrans,
      tol = tolerance,
      fth = feather,
      trim = trimPadding
    ): string | null => {
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;

      const startX = Math.max(0, (box.x / 100) * imgW);
      const startY = Math.max(0, (box.y / 100) * imgH);
      const cropW = Math.max(10, Math.min(imgW - startX, (box.width / 100) * imgW));
      const cropH = Math.max(10, Math.min(imgH - startY, (box.height / 100) * imgH));

      // Downscale to web-optimized retina size (max 320x320) so all 6 vehicles fit safely in Firestore
      const maxDim = 320;
      let targetW = cropW;
      let targetH = cropH;
      if (targetW > maxDim || targetH > maxDim) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * maxDim) / targetW);
          targetW = maxDim;
        } else {
          targetW = Math.round((targetW * maxDim) / targetH);
          targetH = maxDim;
        }
      }

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = targetW;
      cropCanvas.height = targetH;
      const ctx = cropCanvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(img, startX, startY, cropW, cropH, 0, 0, targetW, targetH);

      let finalCanvas = cropCanvas;
      if (isAutoTrans) {
        finalCanvas = processBackgroundTransparency(cropCanvas, {
          enableTransparency: true,
          tolerance: tol,
          feather: fth,
          trimPadding: trim,
        });
      }

      return finalCanvas.toDataURL('image/png');
    },
    [autoTrans, tolerance, feather, trimPadding]
  );

  /**
   * Re-generate sliced previews for all 6 vehicles
   */
  const regenerateAllSlices = useCallback(
    (img: HTMLImageElement, boxes = cropBoxes) => {
      const results: Record<KounichanVehicleId, string> = {} as any;
      VEHICLE_ORDER.forEach((id) => {
        const box = boxes[id] || DEFAULT_CROP_BOXES[id];
        const sliced = sliceSingleVehicle(img, box);
        if (sliced) {
          results[id] = sliced;
        }
      });
      setSlicedPreviews(results);
    },
    [cropBoxes, sliceSingleVehicle]
  );

  /**
   * Process 6-in-1 image sheet upload
   */
  const process6In1Sheet = async (file: File) => {
    setIsProcessingSheet(true);
    setSheetStatus('📸 画像を読み込み中...');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawDataUrl = e.target?.result as string;
        if (!rawDataUrl) return;

        setSheetImageSource(rawDataUrl);

        const img = new Image();
        img.onload = () => {
          loadedImageRef.current = img;
          setSheetStatus('✂️ 6台の個別切り抜き枠を自動配置しました！');
          regenerateAllSlices(img, cropBoxes);
          setIsProcessingSheet(false);

          try {
            confetti({ particleCount: 35, spread: 60, origin: { y: 0.5 } });
          } catch (err) {}
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsProcessingSheet(false);
      setSheetStatus('❌ 画像の読み込み中にエラーが発生しました。');
    }
  };

  // Re-slice when active vehicle's crop box or transparency options change
  useEffect(() => {
    if (!sheetImageSource) return;
    const img = loadedImageRef.current || new Image();
    if (!loadedImageRef.current) {
      img.onload = () => {
        loadedImageRef.current = img;
        regenerateAllSlices(img, cropBoxes);
      };
      img.src = sheetImageSource;
    } else {
      regenerateAllSlices(loadedImageRef.current, cropBoxes);
    }
  }, [cropBoxes, autoTrans, tolerance, feather, trimPadding, sheetImageSource, regenerateAllSlices]);

  /**
   * Apply all 6 sliced images to settings
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
        customSheetUrl: sheetImageSource || prev.customSheetUrl,
        vehicles: updatedVehicles,
      };
    });

    setSheetStatus('🎉 6台すべての乗り物イラストが一括適用・保存されました！');
    try {
      confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
    } catch (e) {}
  };

  /**
   * Apply just the active vehicle's slice
   */
  const handleApplySingleVehicleSlice = (vehicleId: KounichanVehicleId) => {
    if (!slicedPreviews || !slicedPreviews[vehicleId]) return;

    updateSettings((prev) => ({
      ...prev,
      vehicles: {
        ...prev.vehicles,
        [vehicleId]: {
          ...prev.vehicles[vehicleId],
          customImageUrl: slicedPreviews[vehicleId],
        },
      },
    }));

    const vName = settings.vehicles[vehicleId]?.name || vehicleId;
    setSheetStatus(`✨ 「${vName}」の切り抜きイラストを適用しました！`);
    try {
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
    } catch (e) {}
  };

  /**
   * Shrink the active box slightly inwards to eliminate surrounding onomatopoeia letters
   */
  const handleShrinkToAvoidText = (vehicleId: KounichanVehicleId) => {
    setCropBoxes((prev) => {
      const cur = prev[vehicleId] || DEFAULT_CROP_BOXES[vehicleId];
      const shrinkX = 2; // shrink 2% from each side
      const shrinkY = 2;
      const newW = Math.max(10, cur.width - shrinkX * 2);
      const newH = Math.max(10, cur.height - shrinkY * 2);
      const newX = Math.min(100 - newW, cur.x + shrinkX);
      const newY = Math.min(100 - newH, cur.y + shrinkY);
      return {
        ...prev,
        [vehicleId]: {
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
          width: Math.round(newW * 10) / 10,
          height: Math.round(newH * 10) / 10,
        },
      };
    });
  };

  /**
   * Expand the active box slightly outwards
   */
  const handleExpandBox = (vehicleId: KounichanVehicleId) => {
    setCropBoxes((prev) => {
      const cur = prev[vehicleId] || DEFAULT_CROP_BOXES[vehicleId];
      const expandX = 2;
      const expandY = 2;
      const newW = Math.min(100, cur.width + expandX * 2);
      const newH = Math.min(100, cur.height + expandY * 2);
      const newX = Math.max(0, cur.x - expandX);
      const newY = Math.max(0, cur.y - expandY);
      return {
        ...prev,
        [vehicleId]: {
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
          width: Math.round(newW * 10) / 10,
          height: Math.round(newH * 10) / 10,
        },
      };
    });
  };

  /**
   * Reset single vehicle crop box
   */
  const handleResetSingleBox = (vehicleId: KounichanVehicleId) => {
    setCropBoxes((prev) => ({
      ...prev,
      [vehicleId]: { ...DEFAULT_CROP_BOXES[vehicleId] },
    }));
  };

  /**
   * Handle mouse/touch drag on visual sheet
   */
  const handlePointerDown = (
    e: React.PointerEvent,
    vehicleId: KounichanVehicleId,
    mode: 'move' | 'resize'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveVehicleId(vehicleId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setDragState({
      vehicleId,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      initialBox: { ...(cropBoxes[vehicleId] || DEFAULT_CROP_BOXES[vehicleId]) },
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState || !sheetViewerRef.current) return;
    const rect = sheetViewerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dxPercent = ((e.clientX - dragState.startX) / rect.width) * 100;
    const dyPercent = ((e.clientY - dragState.startY) / rect.height) * 100;
    const init = dragState.initialBox;

    setCropBoxes((prev) => {
      let updated = { ...init };
      if (dragState.mode === 'move') {
        const newX = Math.max(0, Math.min(100 - init.width, init.x + dxPercent));
        const newY = Math.max(0, Math.min(100 - init.height, init.y + dyPercent));
        updated = {
          ...init,
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
        };
      } else if (dragState.mode === 'resize') {
        const newW = Math.max(8, Math.min(100 - init.x, init.width + dxPercent));
        const newH = Math.max(8, Math.min(100 - init.y, init.height + dyPercent));
        updated = {
          ...init,
          width: Math.round(newW * 10) / 10,
          height: Math.round(newH * 10) / 10,
        };
      }
      return { ...prev, [dragState.vehicleId]: updated };
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      setDragState(null);
    }
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
  const activeCropBox = cropBoxes[activeVehicleId] || DEFAULT_CROP_BOXES[activeVehicleId];

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
      {/* SECTION 1: 6-in-1 Sheet Auto-Slicer & Individual Range Cropper            */}
      {/* ========================================================================= */}
      <div className="bg-[#FFFDF9] p-4 sm:p-5 rounded-2xl border-2 border-[#DDD7C8] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EAE5D9] pb-3">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-[#C8744E]" />
            <div>
              <h4 className="text-xs sm:text-sm font-black text-[#2E2824] font-handwriting">
                6台画像シート取り込み ＆ 1台ごとの切り抜き範囲（文字除外）設定
              </h4>
              <p className="text-[11px] text-[#7A726A]">
                6台並んだ原画シートから、1台ずつ文字を避けて車体だけを自由に囲って切り抜けます。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-[#FAF2EB] hover:bg-[#F0DFD3] text-[#C8744E] border border-[#E8C2AF] text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{sheetImageSource ? '別の原画シートを再選択' : '原画シート画像を選択'}</span>
            </button>
          </div>
        </div>

        {/* Dropzone (Shown when no image loaded or when dragging) */}
        {!sheetImageSource && (
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
            className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition flex flex-col items-center justify-center ${
              sheetDragActive
                ? 'border-[#C8744E] bg-[#FAF2EB]'
                : 'border-[#DDD7C8] bg-[#FAF8F5] hover:border-[#C8744E]'
            }`}
          >
            <Upload className="w-10 h-10 text-[#C8744E] mb-2" />
            <p className="text-sm font-bold text-[#2E2824]">
              6台並んだイラスト画像をここにドラッグ＆ドロップ
            </p>
            <p className="text-xs text-[#7A726A] mt-1">
              またはクリックして画像ファイル（PNG / JPG）を選択
            </p>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-[#9E958C]">
              <span>上段: 三輪車 / こゆみ号2 / 四輪車</span>
              <span>・</span>
              <span>下段: デンドロビウム風 / 宇宙仕様 / やっくん</span>
            </div>
          </div>
        )}

        {/* Interactive Workspace (Shown when image is loaded) */}
        {sheetImageSource && (
          <div className="space-y-4">
            {/* Vehicle Selector Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-bold text-[#5C544D] shrink-0 mr-1 flex items-center gap-1">
                <Crop className="w-3.5 h-3.5 text-[#C8744E]" />
                調整する乗り物:
              </span>
              {VEHICLE_ORDER.map((id, index) => {
                const v = settings.vehicles[id] || DEFAULT_KOUNICHAN_VEHICLES[id];
                const isSelected = activeVehicleId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveVehicleId(id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex items-center gap-1.5 border cursor-pointer ${
                      isSelected
                        ? 'bg-[#C8744E] text-white border-[#C8744E] shadow-sm'
                        : 'bg-[#FAF8F5] text-[#5C544D] border-[#DDD7C8] hover:bg-[#F2ECE4]'
                    }`}
                  >
                    <span className="opacity-80">#{index + 1}</span>
                    <span>{v.name.split('（')[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* Main Interactive Row: Visual Sheet on Left, Fine-Tuning Box on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left (7 cols): Visual Sheet with 6 Crop Boxes */}
              <div className="lg:col-span-7 bg-[#2E2824]/5 p-3 rounded-2xl border border-[#DDD7C8] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#5C544D]">
                  <span className="font-bold flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-[#C8744E]" />
                    原画シート上で枠を直接ドラッグ移動・角でサイズ変更
                  </span>
                  <span className="text-[11px] text-[#8C837A]">
                    枠内を掴んで移動 / 右下角でリサイズ
                  </span>
                </div>

                {/* Sheet Interactive Canvas Container */}
                <div
                  ref={sheetViewerRef}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="relative w-full rounded-xl overflow-hidden border-2 border-[#2E2824]/30 bg-white select-none touch-none cursor-crosshair shadow-inner"
                >
                  <img
                    src={sheetImageSource}
                    alt="6-in-1 Sheet"
                    className="w-full h-auto block select-none pointer-events-none"
                    draggable={false}
                  />

                  {/* 6 Overlaid Bounding Boxes */}
                  {VEHICLE_ORDER.map((id, index) => {
                    const box = cropBoxes[id] || DEFAULT_CROP_BOXES[id];
                    const isSelected = activeVehicleId === id;
                    const v = settings.vehicles[id] || DEFAULT_KOUNICHAN_VEHICLES[id];

                    return (
                      <div
                        key={id}
                        style={{
                          left: `${box.x}%`,
                          top: `${box.y}%`,
                          width: `${box.width}%`,
                          height: `${box.height}%`,
                        }}
                        onPointerDown={(e) => handlePointerDown(e, id, 'move')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveVehicleId(id);
                        }}
                        className={`absolute transition-[border-color,background-color] select-none ${
                          isSelected
                            ? 'border-2 border-[#C8744E] bg-[#C8744E]/20 z-20 shadow-md ring-2 ring-white/80 cursor-move'
                            : 'border border-[#2E2824]/40 bg-black/5 hover:bg-[#C8744E]/10 z-10 cursor-pointer'
                        }`}
                      >
                        {/* Vehicle Label Badge */}
                        <div
                          className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-black whitespace-nowrap shadow-xs pointer-events-none ${
                            isSelected
                              ? 'bg-[#C8744E] text-white'
                              : 'bg-[#2E2824]/80 text-white/90'
                          }`}
                        >
                          #{index + 1} {v.name.split('（')[0]}
                        </div>

                        {/* Active Box Corner Resize Handle (Bottom-Right) */}
                        {isSelected && (
                          <div
                            onPointerDown={(e) => handlePointerDown(e, id, 'resize')}
                            className="absolute -bottom-2 -right-2 w-6 h-6 bg-[#C8744E] border-2 border-white rounded-full flex items-center justify-center cursor-se-resize shadow-md hover:scale-110 active:scale-95 z-30"
                            title="角をドラッグしてサイズ変更"
                          >
                            <Maximize2 className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#7A6B63] pt-1">
                  <span>オレンジ色の枠が現在選択中の切り抜き範囲です</span>
                  <button
                    type="button"
                    onClick={() => setCropBoxes(DEFAULT_CROP_BOXES)}
                    className="text-xs text-[#7A6B63] hover:text-[#C8744E] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>全6台の枠を初期位置にリセット</span>
                  </button>
                </div>
              </div>

              {/* Right (5 cols): Range Adjustment Sliders & Live Cropped Result */}
              <div className="lg:col-span-5 bg-[#FAF8F5] p-4 rounded-2xl border border-[#DDD7C8] space-y-4">
                <div className="flex items-center justify-between border-b border-[#EAE5D9] pb-2">
                  <div className="flex items-center gap-1.5">
                    <Crop className="w-4 h-4 text-[#C8744E]" />
                    <h5 className="text-xs font-black text-[#2E2824]">
                      【{activeVehicle.name.split('（')[0]}】の範囲微調整
                    </h5>
                  </div>
                  <span className="text-[10px] bg-[#EAE5D9] text-[#5C544D] font-mono px-2 py-0.5 rounded-full font-bold">
                    {activeCropBox.width}% × {activeCropBox.height}%
                  </span>
                </div>

                {/* Quick Action Helpers (Especially for avoiding text!) */}
                <div className="bg-[#FAF2EB] p-3 rounded-xl border border-[#F0D5C3] space-y-2">
                  <div className="text-[11px] font-bold text-[#874A2E] flex items-center gap-1">
                    <span>💡 オノマトペ文字を消す・外すワンタッチ操作</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleShrinkToAvoidText(activeVehicleId)}
                      className="px-2.5 py-1.5 bg-white hover:bg-[#FDF6F0] text-[#C8744E] border border-[#E8C2AF] font-bold rounded-lg shadow-2xs transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer text-[11px]"
                      title="枠を内側に狭めて周囲の文字をカット"
                    >
                      <Minimize2 className="w-3 h-3" />
                      <span>文字を避けて内側に縮小</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExpandBox(activeVehicleId)}
                      className="px-2.5 py-1.5 bg-white hover:bg-[#FDF6F0] text-[#5C544D] border border-[#DDD7C8] font-bold rounded-lg shadow-2xs transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer text-[11px]"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>枠を少し広げる</span>
                    </button>
                  </div>
                </div>

                {/* Range Sliders */}
                <div className="space-y-2.5 text-xs text-[#5C544D]">
                  {/* X Position */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-16 shrink-0 text-[11px] font-bold">左右位置 (X):</span>
                    <input
                      type="range"
                      min={0}
                      max={100 - activeCropBox.width}
                      step={0.5}
                      value={activeCropBox.x}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCropBoxes((prev) => ({
                          ...prev,
                          [activeVehicleId]: { ...prev[activeVehicleId], x: val },
                        }));
                      }}
                      className="flex-1 accent-[#C8744E]"
                    />
                    <span className="w-10 text-right font-mono font-bold text-[11px]">
                      {activeCropBox.x}%
                    </span>
                  </div>

                  {/* Y Position */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-16 shrink-0 text-[11px] font-bold">上下位置 (Y):</span>
                    <input
                      type="range"
                      min={0}
                      max={100 - activeCropBox.height}
                      step={0.5}
                      value={activeCropBox.y}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCropBoxes((prev) => ({
                          ...prev,
                          [activeVehicleId]: { ...prev[activeVehicleId], y: val },
                        }));
                      }}
                      className="flex-1 accent-[#C8744E]"
                    />
                    <span className="w-10 text-right font-mono font-bold text-[11px]">
                      {activeCropBox.y}%
                    </span>
                  </div>

                  {/* Width */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-16 shrink-0 text-[11px] font-bold">横幅 (W):</span>
                    <input
                      type="range"
                      min={10}
                      max={100 - activeCropBox.x}
                      step={0.5}
                      value={activeCropBox.width}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCropBoxes((prev) => ({
                          ...prev,
                          [activeVehicleId]: { ...prev[activeVehicleId], width: val },
                        }));
                      }}
                      className="flex-1 accent-[#C8744E]"
                    />
                    <span className="w-10 text-right font-mono font-bold text-[11px]">
                      {activeCropBox.width}%
                    </span>
                  </div>

                  {/* Height */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-16 shrink-0 text-[11px] font-bold">高さ (H):</span>
                    <input
                      type="range"
                      min={10}
                      max={100 - activeCropBox.y}
                      step={0.5}
                      value={activeCropBox.height}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCropBoxes((prev) => ({
                          ...prev,
                          [activeVehicleId]: { ...prev[activeVehicleId], height: val },
                        }));
                      }}
                      className="flex-1 accent-[#C8744E]"
                    />
                    <span className="w-10 text-right font-mono font-bold text-[11px]">
                      {activeCropBox.height}%
                    </span>
                  </div>
                </div>

                {/* Live Sliced Preview Card for Selected Vehicle */}
                <div className="pt-2 border-t border-[#EAE5D9] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#3E3833]">
                      現在の切り抜き透過プレビュー
                    </span>
                    <button
                      type="button"
                      onClick={() => handleResetSingleBox(activeVehicleId)}
                      className="text-[10px] text-[#7A6B63] hover:text-[#C8744E] flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>初期枠に戻す</span>
                    </button>
                  </div>

                  <div
                    className="w-full h-36 rounded-xl border border-[#2E2824]/20 p-2 flex items-center justify-center overflow-hidden relative shadow-inner"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg, #E2DFD8 25%, transparent 25%), linear-gradient(-45deg, #E2DFD8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #E2DFD8 75%), linear-gradient(-45deg, transparent 75%, #E2DFD8 75%)',
                      backgroundSize: '14px 14px',
                      backgroundColor: '#F7F5F0',
                    }}
                  >
                    {slicedPreviews && slicedPreviews[activeVehicleId] ? (
                      <img
                        src={slicedPreviews[activeVehicleId]}
                        alt={activeVehicle.name}
                        className="max-h-full max-w-full object-contain filter drop-shadow-md"
                      />
                    ) : (
                      <span className="text-xs text-[#9E958C]">プレビュー生成中...</span>
                    )}
                  </div>

                  {/* Apply Just This Vehicle Button */}
                  <button
                    type="button"
                    onClick={() => handleApplySingleVehicleSlice(activeVehicleId)}
                    disabled={!slicedPreviews || !slicedPreviews[activeVehicleId]}
                    className="w-full py-2 bg-[#C8744E] hover:bg-[#B3623D] text-white text-xs font-black rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>【この1台（{activeVehicle.name.split('（')[0]}）だけ適用する】</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Global Transparency & Batch Apply Row */}
            <div className="p-3.5 bg-[#FAF8F4] rounded-2xl border border-[#EAE5D9] flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-[#3E3833]">
                  <input
                    type="checkbox"
                    checked={autoTrans}
                    onChange={(e) => setAutoTrans(e.target.checked)}
                    className="rounded text-[#C8744E] focus:ring-[#C8744E]"
                  />
                  <span>紙の白背景を自動透過</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-[#3E3833]">
                  <input
                    type="checkbox"
                    checked={trimPadding}
                    onChange={(e) => setTrimPadding(e.target.checked)}
                    className="rounded text-[#C8744E] focus:ring-[#C8744E]"
                  />
                  <span>余白の自動トリミング（中央揃え）</span>
                </label>

                {autoTrans && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#7A726A]">透過許容度:</span>
                    <input
                      type="range"
                      min={10}
                      max={60}
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      className="w-20 accent-[#C8744E]"
                    />
                    <span className="font-mono font-bold text-[#3E3833]">{tolerance}</span>
                  </div>
                )}
              </div>

              {/* Apply All 6 Vehicles Button */}
              <button
                type="button"
                onClick={handleApplyAllSliced}
                disabled={!slicedPreviews}
                className="px-5 py-2.5 bg-[#2E2824] hover:bg-[#453D37] text-white text-xs font-black rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-[#A7F3D0]" />
                <span>🚀 調整した枠で【6台すべて一括切り出し＆適用】</span>
              </button>
            </div>

            {/* Status Message */}
            {sheetStatus && (
              <p className="text-xs font-bold text-[#C8744E] bg-[#FAF2EB] px-3.5 py-2.5 rounded-xl border border-[#F0D5C3]">
                {sheetStatus}
              </p>
            )}

            {/* 6 Vehicles Sliced Previews Strip */}
            {slicedPreviews && (
              <div className="space-y-2 pt-2 border-t border-[#EAE5D9]">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-[#3E3833]">
                    6台の切り出し結果一覧（タップして選択・微調整できます）
                  </h5>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {VEHICLE_ORDER.map((id, index) => {
                    const v = settings.vehicles[id] || DEFAULT_KOUNICHAN_VEHICLES[id];
                    const previewImg = slicedPreviews[id];
                    const isSelected = activeVehicleId === id;

                    return (
                      <div
                        key={id}
                        onClick={() => setActiveVehicleId(id)}
                        className={`p-2 rounded-xl border flex flex-col items-center text-center cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#FAF2EB] border-[#C8744E] ring-2 ring-[#C8744E]/30 shadow-xs'
                            : 'bg-[#FAF8F5] border-[#DDD7C8] hover:bg-[#F2ECE4]'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full text-[10px] font-bold text-[#5C544D] mb-1">
                          <span>#{index + 1}</span>
                          <span className="truncate">{v.name.split('（')[0]}</span>
                        </div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
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
              <option value="rtl">➡️ 右から左へ走行（固定・原画の向き）</option>
              <option value="ltr">⬅️ 左から右へ走行</option>
            </select>
            <p className="text-[11px] text-[#7A6B63] mt-1">
              原画の向きのまま反転させずに右から左へ走行します。
            </p>
          </div>

          <div>
            <label className="font-bold text-[#5C544D] block mb-1">
              オノマトペ（吹き出し文字）
            </label>
            <select
              value={settings.showOnomatopoeia ? 'show' : 'hide'}
              onChange={(e) => {
                const val = e.target.value === 'show';
                updateSettings((prev) => ({ ...prev, showOnomatopoeia: val }));
              }}
              className="w-full text-xs font-bold px-3 py-1.5 rounded-xl border border-[#DDD7C8] bg-white text-[#3E3833] focus:outline-none focus:border-[#C8744E]"
            >
              <option value="hide">🔕 消す・非表示（イラストを綺麗に見せる）</option>
              <option value="show">💬 表示する（頭上に吹き出しを表示）</option>
            </select>
            <p className="text-[11px] text-[#7A6B63] mt-1">
              「消す」にするとイラストが文字を踏まずすっきり走行します。
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
