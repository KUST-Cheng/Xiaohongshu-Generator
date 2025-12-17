import { StyleOption, LengthOption } from './types';

export const STYLES: StyleOption[] = [
  { id: 'emotional', name: '情感共鸣', icon: '🥺', desc: '走心、感性、引起共情' },
  { id: 'educational', name: '干货科普', icon: '🤓', desc: '实用、条理清晰、收藏党' },
  { id: 'promotion', name: '种草安利', icon: '🛍️', desc: '激动、安利、必买系列' },
  { id: 'rant', name: '避雷吐槽', icon: '😤', desc: '真实、犀利、防坑指南' },
];

export const LENGTHS: LengthOption[] = [
  { id: 'short', name: '短文案 (200字内)' },
  { id: 'medium', name: '标准 (400字左右)' },
  { id: 'long', name: '长文 (800字+)' },
];

export const MORANDI_COLORS = [
  '#000000', // Classic Black
  '#8E5E50', // Rust Brown
  '#6D7E68', // Moss Green
  '#6B8497', // Haze Blue
  '#9D8189', // Dusty Pink
];

export const MOCK_USER = {
  name: "Momo的探店日记",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Momo",
  location: "上海 · 武康路"
};