export interface GeneratedPost {
  title: string;
  content: string;
  tags: string[];
  image_prompt?: string; // 新增：用于生图引擎的描述词
  cover_summary?: {
    main_title: string;
    highlight_text: string;
    body_preview: string;
  };
}

export interface MemoData {
  date: string;
  time: string;
  location: string;
  title: string;
  highlight: string;
  body: string;
  footer: string;
  titleColor?: string;
}

export type StyleType = 'emotional' | 'educational' | 'promotion' | 'rant';
export type LengthType = 'short' | 'medium' | 'long';
export type CoverMode = 'auto' | 'ref' | 'template';

export interface StyleOption {
  id: StyleType;
  name: string;
  icon: string;
  desc: string;
}

export interface LengthOption {
  id: LengthType;
  name: string;
}