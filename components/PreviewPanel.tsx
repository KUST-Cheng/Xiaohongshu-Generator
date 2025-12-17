import React from 'react';
import { ArrowLeft, MoreHorizontal, Heart, Star, MessageCircle, Share, Smartphone, Loader2, Download, Copy, Check } from 'lucide-react';
import { GeneratedPost, MemoData, CoverMode } from '../types';
import IOSMemoCover from './IOSMemoCover';
import { MOCK_USER } from '../constants';

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
  loading,
  imageLoading,
  generatedData,
  generatedImage,
  coverMode,
  memoData,
  coverRef,
  imageExportSuccess,
  copySuccess,
  onCopyText,
  onCopyCover,
  onDownloadCover
}) => {
  return (
    <div className="flex-1 bg-gray-100 p-4 lg:p-8 flex items-center justify-center overflow-hidden relative">
      
      {/* Floating Copy Text Button */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={onCopyText}
          disabled={!generatedData}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg font-medium transition-all ${
            copySuccess 
              ? 'bg-green-500 text-white' 
              : generatedData 
                ? 'bg-white text-gray-800 hover:bg-gray-50' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {copySuccess ? <Check size={18} /> : <Copy size={18} />}
          {copySuccess ? '已复制' : '复制文案'}
        </button>
      </div>

      {/* PHONE MOCKUP */}
      <div className="w-full max-w-[400px] h-[95vh] lg:h-[850px] bg-white rounded-[40px] shadow-2xl border-[8px] border-gray-900 overflow-hidden relative flex flex-col">
        
        {/* Status Bar */}
        <div className="h-7 bg-white flex justify-between items-center px-6 pt-3 shrink-0 z-20">
          <span className="text-xs font-semibold text-black">9:41</span>
          <div className="flex gap-1.5">
             <div className="w-4 h-2.5 bg-black rounded-[1px]"></div>
             <div className="w-0.5 h-1.5 bg-black"></div>
          </div>
        </div>

        {/* App Header */}
        <div className="h-14 flex items-center justify-between px-4 bg-white z-10 sticky top-0 shrink-0 border-b border-gray-50">
          <ArrowLeft className="text-gray-800" size={24} />
          <div className="flex items-center gap-2">
            <img src={MOCK_USER.avatar} alt="avatar" className="w-8 h-8 rounded-full border border-gray-200" />
            <span className="text-sm font-semibold text-gray-700">{MOCK_USER.name}</span>
            <button className="text-xs text-red-500 border border-red-500 px-2 py-0.5 rounded-full font-medium">关注</button>
          </div>
          <MoreHorizontal className="text-gray-800" size={24} />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide bg-white pb-20">
          
          {/* COVER AREA */}
          <div className="w-full aspect-[3/4] bg-gray-100 relative group overflow-hidden">
            
            {/* 1. Image Generation Mode */}
            {coverMode !== 'template' && (
              <>
                {imageLoading ? (
                   <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50 z-20">
                        <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-3" />
                        <span className="text-xs font-bold text-gray-500">正在生成封面...</span>
                   </div>
                ) : generatedImage ? (
                    <img src={generatedImage} alt="Cover" className="w-full h-full object-cover animate-fadeIn" />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 bg-gray-50">
                      <Smartphone className="w-16 h-16 opacity-20 mb-2" />
                      <span className="text-sm">预览图显示区域</span>
                    </div>
                )}
              </>
            )}

            {/* 2. Template Mode */}
            {coverMode === 'template' && (
              <>
                <IOSMemoCover data={memoData} coverRef={coverRef} />
                
                {/* Export Controls for Template */}
                <div className="absolute top-3 right-3 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button 
                        onClick={onCopyCover}
                        className={`p-2 rounded-full shadow-lg backdrop-blur-sm transition-all ${imageExportSuccess === 'copy' ? 'bg-green-500 text-white' : 'bg-white/80 text-gray-700 hover:bg-white'}`}
                        title="复制图片"
                    >
                         {imageExportSuccess === 'copy' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                    <button 
                        onClick={onDownloadCover}
                        className={`p-2 rounded-full shadow-lg backdrop-blur-sm transition-all ${imageExportSuccess === 'download' ? 'bg-green-500 text-white' : 'bg-white/80 text-gray-700 hover:bg-white'}`}
                        title="下载 PNG"
                    >
                        {imageExportSuccess === 'download' ? <Check size={16} /> : <Download size={16} />}
                    </button>
                </div>
              </>
            )}

            {/* Pagination Dots */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10 pointer-events-none">
              <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${coverMode === 'template' ? 'bg-black/20' : 'bg-white'}`}></div>
              <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${coverMode === 'template' ? 'bg-black/10' : 'bg-white/50'}`}></div>
            </div>
          </div>

          {/* Post Content */}
          <div className="p-4">
            {loading ? (
               <div className="space-y-4 animate-pulse">
                 <div className="h-6 bg-gray-100 rounded w-3/4"></div>
                 <div className="h-4 bg-gray-50 rounded w-full"></div>
                 <div className="h-4 bg-gray-50 rounded w-full"></div>
                 <div className="h-4 bg-gray-50 rounded w-5/6"></div>
               </div>
            ) : generatedData ? (
              <div className="animate-fadeIn">
                <h1 className="text-lg font-bold text-gray-900 leading-snug mb-3">{generatedData.title}</h1>
                <div className="text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap font-normal">{generatedData.content}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {generatedData.tags?.map((tag, idx) => (
                    <span key={idx} className="text-blue-900 text-[15px]">{tag.startsWith('#') ? tag : `#${tag}`}</span>
                  ))}
                </div>
                <div className="mt-4 text-xs text-gray-400">02-15 {MOCK_USER.location}</div>
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">
                👈 左侧输入话题，生成你的第一篇爆款笔记
              </div>
            )}
          </div>
          
          {/* Comments Preview */}
          <div className="h-8 border-t border-gray-100 mt-2 mb-12">
             <div className="px-4 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0"></div>
                <div className="flex-1">
                   <div className="w-24 h-3 bg-gray-100 rounded mb-1.5"></div>
                   <div className="w-full h-3 bg-gray-50 rounded"></div>
                </div>
             </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="h-14 bg-white border-t border-gray-100 absolute bottom-0 left-0 right-0 flex items-center px-4 justify-between z-10">
          <div className="flex-1 h-9 bg-gray-100 rounded-full flex items-center px-4 text-gray-400 text-sm mr-4">说点什么 ...</div>
          <div className="flex items-center gap-5 text-gray-600">
            <Heart size={22} /><Star size={22} /><MessageCircle size={22} />
          </div>
        </div>
        
        {/* Home Indicator */}
        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gray-900 rounded-full z-20"></div>
      </div>
    </div>
  );
};

export default PreviewPanel;
