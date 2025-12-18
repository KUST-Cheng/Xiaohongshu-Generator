import React from 'react';
import { ArrowLeft, MoreHorizontal, Heart, Star, MessageCircle, Smartphone, Loader2, Download, Copy, Check } from 'lucide-react';
import { GeneratedPost, MemoData, CoverMode } from '../types.ts';
import IOSMemoCover from './IOSMemoCover.tsx';
import { MOCK_USER } from '../constants.ts';

interface Props {
  loading: boolean;
  imageLoading: boolean;
  generatedData: GeneratedPost | null;
  generatedImage: string | null;
  coverMode: CoverMode;
  memoData: MemoData;
  coverRef: React.RefObject<HTMLDivElement>;
  imageExportSuccess: string;
  copySuccess: boolean;
  onCopyText: () => void;
  onCopyCover: () => void;
  onDownloadCover: () => void;
}

const PreviewPanel: React.FC<Props> = ({
  loading, imageLoading, generatedData, generatedImage, coverMode, memoData, coverRef, imageExportSuccess, copySuccess, onCopyText, onCopyCover, onDownloadCover
}) => {
  return (
    <div className="flex-1 bg-gray-100 p-4 lg:p-8 flex items-center justify-center overflow-hidden relative">
      <div className="absolute top-6 right-6 z-20">
        <button onClick={onCopyText} disabled={!generatedData} className={`flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg font-medium transition-all ${copySuccess ? 'bg-green-500 text-white' : 'bg-white text-gray-800'}`}>
          {copySuccess ? <Check size={18} /> : <Copy size={18} />}
          {copySuccess ? '已复制' : '复制文案'}
        </button>
      </div>

      <div className="w-full max-w-[380px] h-[90vh] bg-white rounded-[40px] shadow-2xl border-[8px] border-gray-900 overflow-hidden relative flex flex-col scale-[0.9] lg:scale-100">
        <div className="h-7 bg-white flex justify-between items-center px-6 pt-3 shrink-0 z-20"><span className="text-[10px] font-bold">9:41</span><div className="flex gap-1"><div className="w-3 h-2 bg-black rounded-[1px]"></div></div></div>
        <div className="h-12 flex items-center justify-between px-4 bg-white border-b shrink-0">
          <ArrowLeft size={20} />
          <div className="flex items-center gap-2"><img src={MOCK_USER.avatar} className="w-6 h-6 rounded-full" /><span className="text-[11px] font-bold">{MOCK_USER.name}</span></div>
          <MoreHorizontal size={20} />
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
          <div className="w-full aspect-[3/4] bg-gray-100 relative group overflow-hidden">
            {coverMode !== 'template' && (
              <>
                {imageLoading ? (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-20 text-red-500">
                        <Loader2 className="animate-spin mb-2" />
                        <span className="text-[10px] font-bold text-gray-400">正在生成封面...</span>
                   </div>
                ) : generatedImage ? (
                    <img src={generatedImage} alt="Cover" className="w-full h-full object-cover animate-fadeIn" />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300"><Smartphone size={40} className="opacity-10 mb-2" /><span className="text-[10px]">预览区域</span></div>
                )}
              </>
            )}

            {coverMode === 'template' && (
              <>
                <IOSMemoCover data={memoData} coverRef={coverRef} />
                <div className="absolute top-3 right-3 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onCopyCover} className={`p-2 rounded-full shadow backdrop-blur-sm ${imageExportSuccess === 'copy' ? 'bg-green-500 text-white' : 'bg-white/80'}`}>{imageExportSuccess === 'copy' ? <Check size={14} /> : <Copy size={14} />}</button>
                    <button onClick={onDownloadCover} className={`p-2 rounded-full shadow backdrop-blur-sm ${imageExportSuccess === 'download' ? 'bg-green-500 text-white' : 'bg-white/80'}`}>{imageExportSuccess === 'download' ? <Check size={14} /> : <Download size={14} />}</button>
                </div>
              </>
            )}
          </div>

          <div className="p-4">
            {loading ? (
               <div className="space-y-3 animate-pulse">
                 <div className="h-5 bg-gray-100 rounded w-3/4"></div>
                 <div className="h-3 bg-gray-50 rounded w-full"></div>
                 <div className="h-3 bg-gray-50 rounded w-5/6"></div>
               </div>
            ) : generatedData ? (
              <div className="animate-fadeIn">
                <h1 className="text-sm font-bold mb-2">{generatedData.title}</h1>
                <div className="text-[12px] leading-relaxed whitespace-pre-wrap">{generatedData.content}</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {generatedData.tags?.map((tag, idx) => (
                    <span key={idx} className="text-blue-600 text-[12px]">#{tag.replace('#','')}</span>
                  ))}
                </div>
              </div>
            ) : <div className="text-center py-10 text-gray-300 text-xs">灵感正在加载中...</div>}
          </div>
        </div>

        <div className="h-12 bg-white border-t absolute bottom-0 left-0 right-0 flex items-center px-4 justify-between z-10">
          <div className="flex-1 h-8 bg-gray-100 rounded-full flex items-center px-4 text-gray-300 text-xs mr-4">赞个评论吧 ...</div>
          <div className="flex gap-4 text-gray-600"><Heart size={18} /><Star size={18} /><MessageCircle size={18} /></div>
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel;