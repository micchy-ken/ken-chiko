import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { performAppReload } from '../version';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  declare props: Readonly<Props>;

  constructor(props: Props) {
    super(props);
  }

  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // Auto-reload once if it looks like a chunk load error
    if (
      error.name === 'ChunkLoadError' || 
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    ) {
      if (!sessionStorage.getItem('chunk_reloaded')) {
        sessionStorage.setItem('chunk_reloaded', 'true');
        performAppReload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F2EA] flex flex-col items-center justify-center p-6 text-center font-['M_PLUS_Rounded_1c']">
          <div className="bg-white p-8 rounded-3xl shadow-sm border-2 border-[#E8E4D8] max-w-md w-full">
            <div className="w-16 h-16 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#FCA5A5]">
              <AlertCircle className="w-8 h-8 text-[#EF4444]" />
            </div>
            <h1 className="text-xl font-bold text-[#4A433D] mb-3 font-handwriting">
              新しいデータが見つかりました
            </h1>
            <p className="text-sm text-[#736B63] mb-6">
              アプリの更新により一時的な読み込みエラーが発生しました。<br />
              下のボタンを押して、最新バージョンを読み込んでください。
            </p>
            <button
              onClick={() => performAppReload()}
              className="w-full flex items-center justify-center gap-2 bg-[#487560] hover:bg-[#345344] text-white py-3.5 px-6 rounded-xl font-bold text-sm transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-5 h-5" />
              <span>最新版に更新して再開する</span>
            </button>
            
            <details className="mt-6 text-left">
              <summary className="text-[10px] text-[#A69C92] cursor-pointer hover:text-[#736B63]">
                エラー詳細を表示 (開発者用)
              </summary>
              <pre className="mt-2 text-[9px] text-[#A69C92] bg-[#FAF8F4] p-2 rounded overflow-auto max-h-32">
                {this.state.error?.message}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
