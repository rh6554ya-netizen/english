export interface SurvivalPhrase {
  id: string;
  tag: string;
  category: 'travel' | 'emergency' | 'shopping';
  en: string;
  zh: string;
  tip_zh: string;
  audio_normal_url: string;
  audio_slow_url: string;
}

export const SURVIVAL_PHRASES: SurvivalPhrase[] = [
  {
    id: 'surv-1',
    tag: '證照查驗',
    category: 'travel',
    en: 'I am here for tourism and will be staying for seven days.',
    zh: '我是來觀光的，預計停留七天。',
    tip_zh: '過海關最常被問的兩大問題：目的（tourism）與天數（seven days），一句答完最俐落。',
    audio_normal_url: '/audio/survival/surv-1_normal.mp3',
    audio_slow_url: '/audio/survival/surv-1_slow.mp3',
  },
  {
    id: 'surv-2',
    tag: '海關申報',
    category: 'travel',
    en: 'I have nothing to declare, only my personal belongings and carry-on baggage.',
    zh: '我沒有任何需要申報的物品，只有隨身個人行李。',
    tip_zh: '走綠色免申報通道（Nothing to Declare）被抽查時使用。',
    audio_normal_url: '/audio/survival/surv-2_normal.mp3',
    audio_slow_url: '/audio/survival/surv-2_slow.mp3',
  },
  {
    id: 'surv-3',
    tag: '飲食過敏',
    category: 'travel',
    en: 'I have a severe food allergy to nuts and seafood; can you confirm these dishes are safe for me?',
    zh: '我對堅果和海鮮有嚴重食物過敏，能否幫我確認這些菜餚安全無虞？',
    tip_zh: '點餐前直接秀給服務生看或點擊播放語音，避免誤食過敏原。',
    audio_normal_url: '/audio/survival/surv-3_normal.mp3',
    audio_slow_url: '/audio/survival/surv-3_slow.mp3',
  },
  {
    id: 'surv-4',
    tag: '護照遺失',
    category: 'emergency',
    en: 'My wallet and passport are missing. I need to report this and contact my embassy.',
    zh: '我的皮夾與護照遺失了。我需要報案並聯絡代表處／大使館。',
    tip_zh: '遺失護照第一步先取得警方報案證明（police report），再聯絡當地駐外辦事處補辦。',
    audio_normal_url: '/audio/survival/surv-4_normal.mp3',
    audio_slow_url: '/audio/survival/surv-4_slow.mp3',
  },
  {
    id: 'surv-5',
    tag: '突發急病',
    category: 'emergency',
    en: "I'm not feeling well and have severe pain. Can you take me to a doctor?",
    zh: '我身體非常不舒服且劇烈疼痛。可以帶我就醫看醫生嗎？',
    tip_zh: '可搭配手勢指出疼痛部位（chest / stomach / head）。',
    audio_normal_url: '/audio/survival/surv-5_normal.mp3',
    audio_slow_url: '/audio/survival/surv-5_slow.mp3',
  },
  {
    id: 'surv-6',
    tag: '救護叫車',
    category: 'emergency',
    en: "Please call an ambulance immediately! It's a medical emergency.",
    zh: '請立刻叫救護車！這是緊急醫療狀況。',
    tip_zh: '北美緊急電話 911、歐洲 112、英國 999、日本 119。',
    audio_normal_url: '/audio/survival/surv-6_normal.mp3',
    audio_slow_url: '/audio/survival/surv-6_slow.mp3',
  },
  {
    id: 'surv-7',
    tag: '報警求助',
    category: 'emergency',
    en: "I need urgent police assistance; I've been robbed.",
    zh: '我需要警察緊急協助；我被搶劫了。',
    tip_zh: '同時可請附近店員或路人協助撥打當地報警專線。',
    audio_normal_url: '/audio/survival/surv-7_normal.mp3',
    audio_slow_url: '/audio/survival/surv-7_slow.mp3',
  },
  {
    id: 'surv-8',
    tag: '迷路問路',
    category: 'travel',
    en: "Excuse me, I'm lost. Could you show me on the map how to get to the station?",
    zh: '不好意思，我迷路了。您能在地圖上指引我如何前往車站嗎？',
    tip_zh: '打開手機地圖直接請對方指方向，比純靠聽覺記憶左右轉更保險。',
    audio_normal_url: '/audio/survival/surv-8_normal.mp3',
    audio_slow_url: '/audio/survival/surv-8_slow.mp3',
  },
  {
    id: 'surv-9',
    tag: '購物試穿',
    category: 'shopping',
    en: 'Can I try this on? Where is the fitting room?',
    zh: '我可以試穿這個嗎？試衣間在哪裡？',
    tip_zh: '英國或部分百貨也會稱作 changing room。',
    audio_normal_url: '/audio/survival/surv-9_normal.mp3',
    audio_slow_url: '/audio/survival/surv-9_slow.mp3',
  },
  {
    id: 'surv-10',
    tag: '詢價折扣',
    category: 'shopping',
    en: 'How much is this, and is there any discount?',
    zh: '這個多少錢？有任何折扣優惠嗎？',
    tip_zh: '結帳前也可補問一句 Does the price include tax?（這是含稅價嗎？）',
    audio_normal_url: '/audio/survival/surv-10_normal.mp3',
    audio_slow_url: '/audio/survival/surv-10_slow.mp3',
  },
  {
    id: 'surv-11',
    tag: '刷卡退換',
    category: 'shopping',
    en: "Do you take credit cards, and can I return or exchange this if it doesn't fit?",
    zh: '你們收信用卡嗎？如果尺寸不合，我可以退貨或換貨嗎？',
    tip_zh: '記得保留原始收據（original receipt）與商品吊牌。',
    audio_normal_url: '/audio/survival/surv-11_normal.mp3',
    audio_slow_url: '/audio/survival/surv-11_slow.mp3',
  },
];
