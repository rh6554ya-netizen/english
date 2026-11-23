import type { DifficultyLevel } from '../../../shared/types';

export interface RoleplayPreset {
  id: string;
  scenario_id: string;
  scenario_slug: string;
  category_tag: 'travel' | 'shopping' | 'daily' | 'social';
  emoji: string;
  title_zh: string;
  title_en: string;
  setting_background: string;
  ai_role: string;
  ai_persona: string;
  user_role: string;
  default_level: DifficultyLevel;
  missions: string[];
}

export const ROLEPLAY_PRESETS: RoleplayPreset[] = [
  {
    id: 'rp-airport',
    scenario_id: 'scn-airport',
    scenario_slug: 'airport-check-in-customs',
    category_tag: 'travel',
    emoji: '✈️',
    title_zh: '機場劃位與海關查驗',
    title_en: 'Airport Check-in & Immigration',
    setting_background:
      'You just arrived at San Francisco International Airport (SFO) and are checking in / clearing customs.',
    ai_role: 'Airline Agent / Customs Officer',
    ai_persona: 'Professional, brisk but polite American airport staff.',
    user_role: 'Traveler',
    default_level: 'beginner',
    missions: [
      '說明此行目的是觀光與預計停留天數',
      '確認託運行李件數或詢問靠窗／走道座位',
      '確認登機門號碼或下榻飯店資訊',
    ],
  },
  {
    id: 'rp-hotel',
    scenario_id: 'scn-hotel',
    scenario_slug: 'hotel-check-in-amenities',
    category_tag: 'travel',
    emoji: '🏨',
    title_zh: '飯店入住與房務需求',
    title_en: 'Hotel Check-in & Front Desk',
    setting_background:
      'You are checking into a boutique hotel in downtown Chicago after a long flight.',
    ai_role: 'Hotel Receptionist',
    ai_persona: 'Warm, hospitable American front desk clerk.',
    user_role: 'Hotel Guest',
    default_level: 'beginner',
    missions: [
      '報上訂房姓名並確認房型或押金說明',
      '詢問早餐時間或免費 Wi-Fi 密碼',
      '禮貌提出一項房務需求（如多要枕頭、延遲退房或寄放行李）',
    ],
  },
  {
    id: 'rp-restaurant',
    scenario_id: 'scn-restaurant',
    scenario_slug: 'restaurant-ordering-allergy',
    category_tag: 'travel',
    emoji: '🍽️',
    title_zh: '餐廳點餐、過敏說明與結帳',
    title_en: 'Restaurant Ordering & Food Allergy',
    setting_background:
      'You are dining at a popular casual American bistro in New York City.',
    ai_role: 'Server',
    ai_persona: 'Upbeat, friendly American waiter/waitress who checks on guests enthusiastically.',
    user_role: 'Diner',
    default_level: 'beginner',
    missions: [
      '請店員推薦招牌餐點並點主餐與飲料',
      '明確說明對堅果或特定食材過敏（請對方確認菜色安全）',
      '詢問結帳方式或請對方送來帳單',
    ],
  },
  {
    id: 'rp-transport',
    scenario_id: 'scn-transport',
    scenario_slug: 'taxi-meter-and-directions',
    category_tag: 'travel',
    emoji: '🚕',
    title_zh: '搭計程車溝通與街頭問路',
    title_en: 'Taxi Ride & Asking for Directions',
    setting_background:
      'You are hopping into a yellow cab heading to Central Station and need to confirm route and fare.',
    ai_role: 'Taxi Driver',
    ai_persona: 'Chatty, down-to-earth American cab driver.',
    user_role: 'Passenger',
    default_level: 'beginner',
    missions: [
      '清楚告知目的地並詢問大約車程或是否照錶收費',
      '詢問是否接受刷卡付費',
      '下車前禮貌詢問附近地標方向並道謝',
    ],
  },
  {
    id: 'rp-shopping',
    scenario_id: 'scn-shopping',
    scenario_slug: 'shopping-trying-checkout',
    category_tag: 'shopping',
    emoji: '🛍️',
    title_zh: '服飾試穿、尺寸詢問與退換貨',
    title_en: 'Clothing Store Try-on & Checkout',
    setting_background:
      'You are shopping for a jacket at a stylish clothing store in Los Angeles.',
    ai_role: 'Shop Assistant',
    ai_persona: 'Helpful, trendy American retail associate.',
    user_role: 'Shopper',
    default_level: 'beginner',
    missions: [
      '詢問有沒有其他尺寸或顏色並借用試衣間',
      '試穿後用自然英文回饋版型（太緊、太長或剛剛好）',
      '結帳前詢問折扣、含稅價或退換貨期限',
    ],
  },
  {
    id: 'rp-health',
    scenario_id: 'scn-health',
    scenario_slug: 'doctor-headache-pharmacy',
    category_tag: 'travel',
    emoji: '🩺',
    title_zh: '藥局買藥與身體不適溝通',
    title_en: 'Pharmacy & Describing Symptoms',
    setting_background:
      'You caught a mild cold and headache while traveling and walked into a neighborhood pharmacy (CVS/Walgreens).',
    ai_role: 'Pharmacist',
    ai_persona: 'Calm, reassuring, attentive American pharmacist.',
    user_role: 'Customer',
    default_level: 'zero_basis',
    missions: [
      '清楚描述自己的症狀（例如頭痛、發燒或喉嚨痛）',
      '詢問是否需要處方箋或有沒有不嗜睡的成藥',
      '確認服藥劑量與飯前／飯後注意事項',
    ],
  },
  {
    id: 'rp-park',
    scenario_id: 'scn-park',
    scenario_slug: 'park-small-talk-friends',
    category_tag: 'social',
    emoji: '🏃',
    title_zh: '公園偶遇老友與美式接話',
    title_en: 'Park Jogging Small Talk',
    setting_background:
      'You bump into an old friend while jogging at a sunny neighborhood park on Saturday morning.',
    ai_role: 'Old Friend (Alex)',
    ai_persona: 'Warm, energetic American friend who loves catching up and uses natural fillers.',
    user_role: 'Friend',
    default_level: 'intermediate',
    missions: [
      '自然寒暄近況並分享最近的工作或生活（避免句點）',
      '反問對方近況或對對方話題表達共鳴附和',
      '主動邀約待會或下週一起喝杯咖啡',
    ],
  },
  {
    id: 'rp-weekend',
    scenario_id: 'scn-weekend',
    scenario_slug: 'coffee-movies-weekend-plans',
    category_tag: 'social',
    emoji: '☕',
    title_zh: '咖啡廳閒聊電影與週末邀約',
    title_en: 'Coffee Shop & Weekend Plans',
    setting_background:
      'You are chatting with a friendly American coworker during a Friday afternoon coffee break.',
    ai_role: 'Coworker (Jamie)',
    ai_persona: 'Easygoing American colleague who uses hedging/softening ("kind of", "feel like").',
    user_role: 'Coworker',
    default_level: 'intermediate',
    missions: [
      '聊聊最近看的電影、影集或週末打算',
      '使用緩衝語氣提出或回應週末邀約（答應或委婉改約時間）',
      '敲定具體見面時間或自然收尾道別',
    ],
  },
  {
    id: 'rp-phone',
    scenario_id: 'scn-phone',
    scenario_slug: 'business-phone-transfer',
    category_tag: 'social',
    emoji: '📞',
    title_zh: '職場商務電話轉接與留言',
    title_en: 'Business Phone Transfer & Message',
    setting_background:
      'You are calling a US partner company to reach Sarah Miller from the Marketing team.',
    ai_role: 'Office Receptionist',
    ai_persona: 'Polite, crisp American corporate receptionist.',
    user_role: 'Caller',
    default_level: 'intermediate',
    missions: [
      '禮貌自我介紹並請求轉接給 Sarah Miller',
      '當對方告知 Sarah 正在開會時，表示願意留言',
      '清楚留下回電號碼與簡短來電事由',
    ],
  },
  {
    id: 'rp-morning',
    scenario_id: 'scn-morning',
    scenario_slug: 'morning-routine-washing',
    category_tag: 'daily',
    emoji: '🌅',
    title_zh: '早晨起床與室友日常閒聊',
    title_en: 'Morning Routine with Roommate',
    setting_background:
      'It is 7:30 AM on a weekday and you are chatting with your American roommate while getting ready.',
    ai_role: 'Roommate (Taylor)',
    ai_persona: 'Cheerful, casual American roommate making coffee.',
    user_role: 'Roommate',
    default_level: 'zero_basis',
    missions: [
      '打招呼並說自己幾點起床、睡得好不好',
      '提到一件早上的梳洗或出門準備動作',
      '詢問浴室是否有人用或今天的天氣／出門計畫',
    ],
  },
  {
    id: 'rp-kitchen',
    scenario_id: 'scn-kitchen',
    scenario_slug: 'kitchen-meals-chores',
    category_tag: 'daily',
    emoji: '🍳',
    title_zh: '廚房做早餐與分工家務',
    title_en: 'Breakfast & Household Chores',
    setting_background:
      'You are in the kitchen on Sunday morning preparing breakfast and splitting simple chores with your host family.',
    ai_role: 'Host Parent (Chris)',
    ai_persona: 'Kind, welcoming American homestay host.',
    user_role: 'Guest / Student',
    default_level: 'zero_basis',
    missions: [
      '表達想吃什麼早餐或主動詢問需不需要幫忙',
      '使用自然短句主動分擔一項家務（洗碗、擦桌子或倒垃圾）',
      '誇獎餐點好吃並禮貌道謝',
    ],
  },
];
