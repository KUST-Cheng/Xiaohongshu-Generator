import React from 'react';
import { ChevronLeft, Share } from 'lucide-react';
import { MemoData } from '../types';

interface Props {
  data: MemoData;
  coverRef: React.RefObject<HTMLDivElement>;
}

const IOSMemoCover: React.FC<Props> = ({ data, coverRef }) => {
  const bgColor = "#FBF8F1"; // Classic iOS Note paper color

  return (
    <div 
      ref={coverRef}
      className="w-full h-full flex flex-col p-8 font-sans antialiased relative overflow-hidden select-none shadow-inner"
      style={{ backgroundColor: bgColor, color: '#000000' }}
    >
      {/* 1. Header Navigation Simulation */}
      <div className="flex justify-between items-center mb-8 opacity-60 text-base">
        <div className="flex items-center gap-1 text-[#E0A241]">
          <ChevronLeft size={24} />
          <span className="font-medium">备忘录</span>
        </div>
        <div className="text-[#E0A241]">
           <Share size={22} />
        </div>
      </div>

      {/* 2. Content Area */}
      <div className="flex-1 flex flex-col animate-fadeIn">
        {/* Date and Location */}
        <div className="text-sm text-gray-400 font-medium mb-6 flex items-center gap-2">
          <span>{data.date} {data.time}</span>
          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
          <span>{data.location || "中国 · 深度思考"}</span>
        </div>

        {/* Title (Big & Bold) */}
        <div 
          className="text-[36px] font-bold leading-[1.2] tracking-tight mb-5 whitespace-pre-wrap transition-colors duration-300"
          style={{ color: data.titleColor || '#000000' }}
        >
          {data.title || "这里是主标题"}
        </div>

        {/* Highlight (Yellow Marker style) */}
        <div className="mb-8 whitespace-pre-wrap">
           <span className="bg-[#FFE66D] px-2 py-1 text-xl font-bold leading-relaxed box-decoration-clone text-black rounded-sm">
             {data.highlight || "这里是高亮显示的副标题或核心痛点"}
           </span>
        </div>

        {/* Body Text */}
        <div className="text-[18px] leading-[1.6] text-[#333333] whitespace-pre-wrap font-normal flex-1 font-sans">
          {data.body || "这里是正文内容。模拟人类自然的写作习惯，段落之间保持适度的呼吸感。\n\n不需要太复杂的辞藻，真实就是最大的必杀技。"}
        </div>
        
        {/* Footer Info */}
        <div className="mt-auto pt-6 border-t border-black/5 flex justify-between items-center">
            <span className="text-xs text-gray-400 font-medium tracking-wider uppercase">
                {data.footer || "生活感悟 | 商业思考"}
            </span>
            <span className="text-xs text-gray-300">
                {String(data.body?.length || 0)} 字
            </span>
        </div>
      </div>
      
      {/* Paper Texture Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>
    </div>
  );
};

export default IOSMemoCover;