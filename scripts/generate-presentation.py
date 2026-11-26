#!/usr/bin/env python3
"""
Generate the EchoSpeak Full Curriculum Teaching Presentation (.pptx)
Optimized for Google Slides import & editing (16:9 widescreen, Noto Sans TC).

Output: docs/EchoSpeak-完整課程教學簡報.pptx
"""

from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

# ---------------------------------------------------------------------------
# Brand Palette (Modern Warm EdTech - EchoSpeak)
# ---------------------------------------------------------------------------
FONT_MAIN = "Noto Sans TC"

C_NAVY = RGBColor(0x11, 0x18, 0x27)        # Deep slate navy (cover/closing bg)
C_INDIGO_DARK = RGBColor(0x1E, 0x1B, 0x4B) # Deep indigo accent bg
C_INDIGO = RGBColor(0x4F, 0x46, 0xE5)      # Primary brand indigo
C_INDIGO_LIGHT = RGBColor(0xEE, 0xF2, 0xFF)
C_INDIGO_MID = RGBColor(0xC7, 0xD2, 0xFE)

C_AMBER = RGBColor(0xF5, 0x9E, 0x0B)       # Warm highlight amber
C_AMBER_LIGHT = RGBColor(0xFE, 0xF3, 0xC7)
C_ORANGE = RGBColor(0xEA, 0x58, 0x0C)      # Sprint / CTA coral orange
C_ORANGE_LIGHT = RGBColor(0xFF, 0xED, 0xD5)

C_EMERALD = RGBColor(0x05, 0x96, 0x69)     # Native / success green
C_EMERALD_LIGHT = RGBColor(0xD1, 0xFA, 0xE5)
C_TEAL = RGBColor(0x0D, 0x94, 0x88)        # Workplace / business teal
C_TEAL_LIGHT = RGBColor(0xCC, 0xFB, 0xF1)

C_ROSE = RGBColor(0xE1, 0x1D, 0x48)        # Pain point / emergency red
C_ROSE_LIGHT = RGBColor(0xFF, 0xE4, 0xE6)
C_VIOLET = RGBColor(0x7C, 0x3A, 0xED)      # AI / social violet
C_VIOLET_LIGHT = RGBColor(0xED, 0xE9, 0xFE)

C_BG = RGBColor(0xF8, 0xFA, 0xFC)          # Clean warm off-white
C_WHITE = RGBColor(0xFF, 0xFF, 0xFF)
C_BORDER = RGBColor(0xE2, 0xE8, 0xF0)
C_SLATE_900 = RGBColor(0x0F, 0x17, 0x2A)
C_SLATE_700 = RGBColor(0x33, 0x41, 0x55)
C_SLATE_600 = RGBColor(0x47, 0x55, 0x69)
C_SLATE_500 = RGBColor(0x64, 0x74, 0x8B)
C_SLATE_400 = RGBColor(0x94, 0xA3, 0xB8)
C_SLATE_200 = RGBColor(0xE2, 0xE8, 0xF0)
C_SLATE_100 = RGBColor(0xF1, 0xF5, 0xF9)

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)
TOTAL_SLIDES = 13


# ---------------------------------------------------------------------------
# Low-level Drawing Helpers
# ---------------------------------------------------------------------------
def set_bg(slide, color: RGBColor):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_rect(
    slide, x, y, w, h,
    fill_color=None, line_color=None, line_pt=1.0, rounded=False, radius=0.06
):
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE
    shp = slide.shapes.add_shape(shape_type, Inches(x), Inches(y), Inches(w), Inches(h))
    if rounded:
        try:
            shp.adjustments[0] = radius
        except Exception:
            pass
    if fill_color is not None:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill_color
    else:
        shp.fill.background()
    if line_color is not None:
        shp.line.color.rgb = line_color
        shp.line.width = Pt(line_pt)
    else:
        shp.line.fill.background()
    return shp


def add_oval(slide, x, y, w, h, fill_color, line_color=None, line_pt=1.0):
    shp = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(w), Inches(h))
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill_color
    if line_color is not None:
        shp.line.color.rgb = line_color
        shp.line.width = Pt(line_pt)
    else:
        shp.line.fill.background()
    return shp


def add_textbox(
    slide, x, y, w, h, text,
    size=14, bold=False, color=C_SLATE_900,
    align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP,
    line_spacing=1.2, margin=0.04
):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = valign
    tf.margin_left = Inches(margin)
    tf.margin_right = Inches(margin)
    tf.margin_top = Inches(margin)
    tf.margin_bottom = Inches(margin)

    lines = text.split("\n")
    for idx, line in enumerate(lines):
        p = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line_spacing
        run = p.add_run()
        run.text = line
        run.font.name = FONT_MAIN
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
    return tb


def add_rich_paragraphs(
    slide, x, y, w, h, paragraphs,
    valign=MSO_ANCHOR.TOP, margin=0.04, space_after=4, line_spacing=1.2
):
    """
    paragraphs: list of list of tuples (text, size, bold, color)
    """
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = valign
    tf.margin_left = Inches(margin)
    tf.margin_right = Inches(margin)
    tf.margin_top = Inches(margin)
    tf.margin_bottom = Inches(margin)

    for p_idx, runs in enumerate(paragraphs):
        p = tf.paragraphs[0] if p_idx == 0 else tf.add_paragraph()
        p.line_spacing = line_spacing
        p.space_after = Pt(space_after)
        for text, size, bold, color in runs:
            r = p.add_run()
            r.text = text
            r.font.name = FONT_MAIN
            r.font.size = Pt(size)
            r.font.bold = bold
            r.font.color.rgb = color
    return tb


def add_pill(slide, x, y, w, h, text, bg_color, text_color, size=10.5, bold=True):
    shp = add_rect(slide, x, y, w, h, fill_color=bg_color, rounded=True, radius=0.45)
    tf = shp.text_frame
    tf.word_wrap = False
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = Inches(0.06)
    tf.margin_right = Inches(0.06)
    tf.margin_top = Inches(0.02)
    tf.margin_bottom = Inches(0.02)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = text
    r.font.name = FONT_MAIN
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = text_color
    return shp


def add_notes(slide, notes_text: str):
    notes_slide = slide.notes_slide
    tf = notes_slide.notes_text_frame
    tf.text = notes_text.strip()


def add_header_footer(slide, page_num: int, tag: str, title: str, subtitle: str, accent=C_INDIGO, accent_bg=C_INDIGO_LIGHT):
    set_bg(slide, C_BG)
    # Top slim accent bar
    add_rect(slide, 0, 0, 13.333, 0.08, fill_color=accent)
    # Section pill
    add_pill(slide, 0.65, 0.34, 2.75, 0.30, tag, accent_bg, accent, size=10)
    # Page number pill
    add_pill(slide, 11.88, 0.34, 0.80, 0.30, f"{page_num:02d} / {TOTAL_SLIDES:02d}", C_SLATE_100, C_SLATE_600, size=10)
    # Title & subtitle
    add_textbox(slide, 0.65, 0.70, 11.4, 0.50, title, size=25, bold=True, color=C_SLATE_900, margin=0.01)
    add_textbox(slide, 0.65, 1.22, 11.8, 0.32, subtitle, size=12.5, bold=False, color=C_SLATE_600, margin=0.01)
    # Divider line
    add_rect(slide, 0.65, 1.58, 12.033, 0.015, fill_color=C_SLATE_200)
    # Footer
    add_rect(slide, 0.65, 7.04, 12.033, 0.012, fill_color=C_SLATE_200)
    add_textbox(slide, 0.65, 7.09, 6.0, 0.28, "EchoSpeak 英文對話實戰教學網站 · 完整課程教學簡報", size=9.5, color=C_SLATE_400, margin=0.01)
    add_textbox(slide, 7.5, 7.09, 5.183, 0.28, "rh6554ya-netizen.github.io/english", size=9.5, color=C_SLATE_400, align=PP_ALIGN.RIGHT, margin=0.01)


# ---------------------------------------------------------------------------
# Slide Builders (13 Slides)
# ---------------------------------------------------------------------------
def build_slide_01_cover(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide, C_NAVY)

    # Decorative geometric accent blocks (clean, modern, vector-native)
    add_rect(slide, 0, 0, 0.18, 7.5, fill_color=C_INDIGO)
    add_rect(slide, 9.45, 0, 3.883, 7.5, fill_color=C_INDIGO_DARK)
    add_oval(slide, 10.1, -0.9, 4.2, 4.2, fill_color=RGBColor(0x31, 0x2E, 0x81))
    add_oval(slide, 10.9, 4.6, 3.2, 3.2, fill_color=RGBColor(0x43, 0x38, 0xCA))

    # Top badge
    add_pill(slide, 0.85, 0.85, 3.75, 0.38, "ECHOSPEAK · INTERACTIVE ENGLISH STUDIO", RGBColor(0x31, 0x2E, 0x81), C_INDIGO_MID, size=10.5)

    # Main Title
    add_textbox(slide, 0.85, 1.50, 8.2, 1.35, "EchoSpeak\n英文對話實戰教學", size=44, bold=True, color=C_WHITE, line_spacing=1.12, margin=0.02)

    # Subtitle
    add_textbox(
        slide, 0.85, 3.05, 8.0, 0.95,
        "從「聽力磨耳朵」、「3 秒直覺反應」到「AI 實境口說角色扮演」\n專為台灣學習者打造的一站式美式口語開口訓練平台",
        size=16, bold=False, color=RGBColor(0xCB, 0xD5, 0xE1), line_spacing=1.45, margin=0.02
    )

    # Accent bar
    add_rect(slide, 0.85, 4.22, 1.4, 0.08, fill_color=C_AMBER, rounded=True, radius=0.5)

    # Key value tags
    tags = [
        ("四步驟情境課", C_INDIGO),
        ("3 秒反應訓練", C_ORANGE),
        ("美式口語升級", C_EMERALD),
        ("AI 語音教練", C_VIOLET),
    ]
    tx = 0.85
    for label, col in tags:
        add_pill(slide, tx, 4.58, 1.85, 0.40, label, col, C_WHITE, size=11.5)
        tx += 2.02

    # Right column: 4 Key Platform Metrics Cards
    metrics = [
        ("5 大領域 / 15 課", "旅遊、職場商務、居家、社交與購物實戰", C_INDIGO),
        ("868 支真人語音", "常速 / 慢速 / 中文三軌 MP3，支援離線播放", C_EMERALD),
        ("76 組 3 秒快問快答", "高頻情境倒數訓練，徹底擺脫腦中翻譯", C_AMBER),
        ("15 組 AI 角色扮演", "即時語音對話、美式自然度評分與 7 天衝刺", C_ORANGE),
    ]
    my = 0.95
    for big, desc, bar_col in metrics:
        add_rect(slide, 9.80, my, 3.10, 1.25, fill_color=RGBColor(0x1E, 0x29, 0x3B), line_color=RGBColor(0x33, 0x41, 0x55), line_pt=1.0, rounded=True, radius=0.08)
        add_rect(slide, 9.80, my + 0.16, 0.09, 0.93, fill_color=bar_col)
        add_textbox(slide, 10.05, my + 0.14, 2.72, 0.42, big, size=16.5, bold=True, color=C_WHITE, margin=0.01)
        add_textbox(slide, 10.05, my + 0.58, 2.72, 0.56, desc, size=10.5, color=RGBColor(0xCB, 0xD5, 0xE1), line_spacing=1.25, margin=0.01)
        my += 1.45

    # Bottom footer on cover
    add_textbox(
        slide, 0.85, 6.65, 8.2, 0.36,
        "線上教學平台：https://rh6554ya-netizen.github.io/english/   ·   支援 PWA 手機安裝與離線學習",
        size=11, color=C_SLATE_400, margin=0.01
    )

    add_notes(slide, """
歡迎來到 EchoSpeak 英文對話實戰教學簡報！
今天這份簡報將完整介紹 EchoSpeak 的核心學習方法、五大生活與職場主題課程精華、以及全新上線的 AI 實境口說教練與 7 天旅遊衝刺營。
EchoSpeak 整合了 10 份精選口說語料，涵蓋 5 大領域 15 課實戰情境、868 支雙速真人語音 MP3、76 組 3 秒快問快答，以及 15 組 AI 實境角色扮演，幫助學員從「聽得懂」真正跨越到「脫口而出」。
""")


def build_slide_02_pain_vs_solution(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_header_footer(
        slide, 2,
        "01 · WHY ECHOSPEAK",
        "為什麼背了十年單字，遇到外國人還是開不了口？",
        "拆解傳統英文學習的 3 大卡關痛點，對照 EchoSpeak 的科學開口閉環解法",
        accent=C_INDIGO, accent_bg=C_INDIGO_LIGHT
    )

    # Left Column: Traditional Pain Points
    add_rect(slide, 0.65, 1.80, 5.75, 4.95, fill_color=C_WHITE, line_color=RGBColor(0xFE, 0xCD, 0xD3), line_pt=1.4, rounded=True, radius=0.05)
    add_rect(slide, 0.65, 1.80, 5.75, 0.64, fill_color=C_ROSE_LIGHT, rounded=False)
    add_textbox(slide, 0.90, 1.92, 5.25, 0.42, "傳統學習法的 3 大卡關痛點", size=16.5, bold=True, color=C_ROSE, margin=0.01)

    pains = [
        ("01", "只看文字不聽連音，實戰聽不懂", "看字幕都認識，但老外一講常速連音與弱讀（如 gonna / didja），大腦瞬間當機。"),
        ("02", "腦中「中翻英」超過 5 秒，錯過接話時機", "聽到問題還得先想文法、拼單字，等組織好句子，話題早就結束了。"),
        ("03", "滿口死板教科書英文，語氣生硬怕失禮", "動不動說 I disagree / I'm fine, thank you，缺乏美式緩衝語氣，且身邊沒有人可以天天練對話。"),
    ]
    py = 2.66
    for num, head, body in pains:
        add_oval(slide, 0.90, py + 0.06, 0.48, 0.48, C_ROSE_LIGHT)
        add_textbox(slide, 0.90, py + 0.13, 0.48, 0.34, num, size=12, bold=True, color=C_ROSE, align=PP_ALIGN.CENTER, margin=0.0)
        add_textbox(slide, 1.52, py, 4.65, 0.34, head, size=14, bold=True, color=C_SLATE_900, margin=0.01)
        add_textbox(slide, 1.52, py + 0.36, 4.65, 0.80, body, size=11.5, color=C_SLATE_600, line_spacing=1.3, margin=0.01)
        py += 1.32

    # Center arrow badge
    add_oval(slide, 6.42, 3.92, 0.50, 0.50, C_INDIGO)
    add_textbox(slide, 6.42, 3.98, 0.50, 0.36, "➜", size=18, bold=True, color=C_WHITE, align=PP_ALIGN.CENTER, margin=0.0)

    # Right Column: EchoSpeak Solutions
    add_rect(slide, 6.95, 1.80, 5.73, 4.95, fill_color=C_WHITE, line_color=RGBColor(0xA7, 0xF3, 0xD0), line_pt=1.4, rounded=True, radius=0.05)
    add_rect(slide, 6.95, 1.80, 5.73, 0.64, fill_color=C_EMERALD_LIGHT, rounded=False)
    add_textbox(slide, 7.20, 1.92, 5.25, 0.42, "EchoSpeak 的科學開口閉環解法", size=16.5, bold=True, color=C_EMERALD, margin=0.01)

    sols = [
        ("01", "常速 ➜ 慢速 ➜ 中文 三軌磨耳朵", "先用常速衝擊耳朵，再以 0.78x 慢速拆解連音，最後補上中文建立聲音條件反射。"),
        ("02", "3 秒倒數直覺反應 ＋ 萬用詞槽公式", "76 組高頻快問快答強迫 3 秒內脫口而出，搭配 29 組詞槽句型，背一句就能變化出 20 句。"),
        ("03", "美式口語升級 ＋ AI 24H 實境陪練", "系統對照「教科書 vs. 美式緩衝語氣」，更內建 AI 角色扮演與發音評測，隨時隨地無壓力實戰。"),
    ]
    sy = 2.66
    for num, head, body in sols:
        add_oval(slide, 7.20, sy + 0.06, 0.48, 0.48, C_EMERALD_LIGHT)
        add_textbox(slide, 7.20, sy + 0.13, 0.48, 0.34, num, size=12, bold=True, color=C_EMERALD, align=PP_ALIGN.CENTER, margin=0.0)
        add_textbox(slide, 7.82, sy, 4.65, 0.34, head, size=14, bold=True, color=C_SLATE_900, margin=0.01)
        add_textbox(slide, 7.82, sy + 0.36, 4.65, 0.80, body, size=11.5, color=C_SLATE_600, line_spacing=1.3, margin=0.01)
        sy += 1.32

    add_notes(slide, """
這頁點出大家最常遇到的三個英文痛點：聽不懂連音、反應太慢、以及只會講僵硬的教科書英文。
EchoSpeak 不是另一個背單字 App，而是針對這三個痛點設計的「聽說閉環」：用三軌磨耳朵打通聽覺，用 3 秒快問快答與詞槽句型建立直覺，最後用 AI 角色扮演與美式升級語庫把英文練成真正的溝通能力。
""")


def build_slide_03_four_steps(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_header_footer(
        slide, 3,
        "02 · CORE METHODOLOGY",
        "核心教學法：四步驟實戰情境演練",
        "每一課情境皆依循「盲聽 ➜ 精讀 ➜ 跟讀評測 ➜ 反向輸出」四階段，把被動輸入轉化為主動口說",
        accent=C_INDIGO, accent_bg=C_INDIGO_LIGHT
    )

    steps = [
        ("STEP 1", "純聽盲測", "Blind Listening", C_INDIGO, C_INDIGO_LIGHT,
         "關閉字幕先聽完整段常速對話，\n訓練抓關鍵字與語境猜測力，\n測試真實聽力理解度。",
         "目標：打破字幕依賴"),
        ("STEP 2", "雙語精讀", "Bilingual Deep Dive", C_TEAL, C_TEAL_LIGHT,
         "展開中英對照逐句精讀，\n掌握 71 組核心單字、連音標註\n與 30 則美式文化禮儀筆記。",
         "目標：吃透語境與文化"),
        ("STEP 3", "角色扮演跟讀", "Shadowing + AI Coach", C_ORANGE, C_ORANGE_LIGHT,
         "切換 A / B 角色與系統對戲，\n搭配 Step 3 AI 發音評測，\n即時揪出連音與重音盲點。",
         "目標：練出口腔肌肉記憶"),
        ("STEP 4", "反向測驗檢核", "Active Recall Quiz", C_EMERALD, C_EMERALD_LIGHT,
         "看中文情境或聽問句進行\n反向測驗與填空挑戰，\n將易錯句一鍵存入 SRS 複習庫。",
         "目標：確保實戰說得出來"),
    ]

    card_w = 2.80
    gap = 0.275
    start_x = 0.65
    for i, (badge, zh, en, col, col_bg, desc, goal) in enumerate(steps):
        cx = start_x + i * (card_w + gap)
        # Card container
        add_rect(slide, cx, 1.85, card_w, 3.92, fill_color=C_WHITE, line_color=C_BORDER, line_pt=1.2, rounded=True, radius=0.06)
        # Top colored accent strip
        add_rect(slide, cx, 1.85, card_w, 0.14, fill_color=col)
        # Badge pill
        add_pill(slide, cx + 0.20, 2.15, 1.05, 0.30, badge, col_bg, col, size=10.5)
        # Titles
        add_textbox(slide, cx + 0.20, 2.58, card_w - 0.40, 0.40, zh, size=17.5, bold=True, color=C_SLATE_900, margin=0.01)
        add_textbox(slide, cx + 0.20, 2.98, card_w - 0.40, 0.30, en, size=10.5, bold=True, color=col, margin=0.01)
        # Body
        add_textbox(slide, cx + 0.20, 3.38, card_w - 0.40, 1.50, desc, size=11.5, color=C_SLATE_600, line_spacing=1.38, margin=0.01)
        # Goal footer inside card
        add_rect(slide, cx + 0.18, 5.06, card_w - 0.36, 0.50, fill_color=col_bg, rounded=True, radius=0.18)
        add_textbox(slide, cx + 0.24, 5.14, card_w - 0.48, 0.34, goal, size=10.5, bold=True, color=col, align=PP_ALIGN.CENTER, margin=0.01)

        # Connector arrow between cards
        if i < 3:
            ax = cx + card_w + 0.005
            add_textbox(slide, ax, 3.50, 0.265, 0.50, "›", size=20, bold=True, color=C_SLATE_400, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, margin=0.0)

    # Bottom Summary Strip
    add_rect(slide, 0.65, 6.02, 12.033, 0.80, fill_color=C_INDIGO_DARK, rounded=True, radius=0.12)
    add_textbox(
        slide, 0.90, 6.13, 11.5, 0.56,
        "黃金學習公式：  盲聽輸入（25%） ➜ 理解文化（25%） ➜ AI 跟讀打磨（25%） ➜ 反向輸出驗收（25%）＝ 100% 實戰通關",
        size=13, bold=True, color=C_WHITE, valign=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER, margin=0.01
    )

    add_notes(slide, """
EchoSpeak 每一堂情境課都採用四步驟實戰設計，進度各佔 25%：
第一步「純聽盲測」強迫先用耳朵聽，避免一開頭就依賴中文字幕；
第二步「雙語精讀」不只看翻譯，更整合了道地單字與美式文化筆記（例如美國小費文化、飯店押金預授權怎麼說）；
第三步「角色扮演跟讀」可以切換不同角色跟讀，還能直接錄音讓 AI 發音教練給分與糾正連音；
第四步「反向測驗」確認不看稿也能正確輸出，把卡關的句子直接送進 SRS 複習庫。
""")


def build_slide_04_five_domains(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_header_footer(
        slide, 4,
        "03 · CURRICULUM MAP",
        "五大實戰領域 × 15 課完整課程地圖",
        "全站 615 筆結構化教材（113 句實戰對話、71 組核心單字、30 則文化筆記），涵蓋生活到外商職場",
        accent=C_INDIGO, accent_bg=C_INDIGO_LIGHT
    )

    domains = [
        ("旅遊出行與自保", "Travel & Survival", "4 課", C_INDIGO, C_INDIGO_LIGHT,
         ["• 機場劃位、託運與海關", "• 飯店 Check-in 與房務", "• 餐廳點餐、過敏與小費", "• 計程車跳錶與街頭問路"],
         "零基礎 ～ 初級實戰"),
        ("職場商務實戰", "Workplace & Business", "4 課", C_TEAL, C_TEAL_LIGHT,
         ["• 開會發言與禮貌反對", "• 專案進度與分工協調", "• 約時間、撞期改期確認", "• 英文面試與自我介紹"],
         "初級 ～ 道地進階"),
        ("居家起居與生活", "Daily & Health", "3 課", C_EMERALD, C_EMERALD_LIGHT,
         ["• 早晨起床、鋪床與盥洗", "• 廚房早餐與日常家務", "• 身體不適與藥局買藥"],
         "零基礎友善起手式"),
        ("社交閒聊與電話", "Small Talk & Phone", "3 課", C_VIOLET, C_VIOLET_LIGHT,
         ["• 公園慢跑偶遇老友閒聊", "• 商務電話轉接與留言", "• 咖啡廳聊電影與週末約"],
         "道地美式進階對話"),
        ("逛街購物實戰", "Shopping & Retail", "1 課", C_ORANGE, C_ORANGE_LIGHT,
         ["• 服飾選購與詢問尺碼", "• 試衣間版型回饋表達", "• 詢問折扣、含稅價與退換貨"],
         "高頻旅遊必備專題"),
    ]

    cw = 2.26
    gap = 0.183
    sx = 0.65
    for i, (zh, en, cnt, col, bg, items, lvl) in enumerate(domains):
        x = sx + i * (cw + gap)
        add_rect(slide, x, 1.82, cw, 4.95, fill_color=C_WHITE, line_color=C_BORDER, line_pt=1.2, rounded=True, radius=0.06)
        # Top colored header block
        add_rect(slide, x, 1.82, cw, 1.12, fill_color=bg)
        add_rect(slide, x, 1.82, cw, 0.10, fill_color=col)
        add_pill(slide, x + 0.16, 2.02, 0.70, 0.26, cnt, col, C_WHITE, size=9.5)
        add_textbox(slide, x + 0.16, 2.34, cw - 0.32, 0.34, zh, size=14, bold=True, color=C_SLATE_900, margin=0.01)
        add_textbox(slide, x + 0.16, 2.66, cw - 0.32, 0.24, en, size=9.5, bold=True, color=col, margin=0.01)

        # Bullet items
        add_textbox(slide, x + 0.16, 3.10, cw - 0.32, 2.80, "\n\n".join(items), size=11, color=C_SLATE_700, line_spacing=1.28, margin=0.01)

        # Level badge at bottom
        add_rect(slide, x + 0.14, 6.18, cw - 0.28, 0.42, fill_color=C_SLATE_100, rounded=True, radius=0.20)
        add_textbox(slide, x + 0.18, 6.25, cw - 0.36, 0.28, lvl, size=9.5, bold=True, color=C_SLATE_600, align=PP_ALIGN.CENTER, margin=0.01)

    add_notes(slide, """
這是 EchoSpeak 目前完整的五大主題課程地圖，涵蓋 15 課實戰情境。
學員一進入首頁就可以依照自己的學習目標（零基礎生活、出國旅遊生存、美式日常閒聊、或職場商務進階）獲得個人化推薦路徑。
其中「旅遊出行」與最新擴充的「職場商務實戰」各佔 4 大核心主題，從下飛機、住飯店一路涵蓋到外商開會、談專案與英文面試。
""")


def build_slide_05_listening_and_3s(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_header_footer(
        slide, 5,
        "04 · LISTENING & REFLEX",
        "聽力磨耳朵 × 3 秒直覺反應訓練",
        "用碎片時間養出「英文耳」，再用 3 秒倒數把高頻問答練成脫口而出的反射動作",
        accent=C_ORANGE, accent_bg=C_ORANGE_LIGHT
    )

    # Left Panel: Loop Listening
    add_rect(slide, 0.65, 1.80, 5.55, 4.98, fill_color=C_WHITE, line_color=C_BORDER, line_pt=1.2, rounded=True, radius=0.06)
    add_pill(slide, 0.90, 2.02, 2.25, 0.32, "LOOP LISTENING · 磨耳朵", C_INDIGO_LIGHT, C_INDIGO, size=10)
    add_textbox(slide, 0.90, 2.42, 5.05, 0.40, "三軌循環播放：通勤、睡前免看螢幕", size=16, bold=True, color=C_SLATE_900, margin=0.01)

    # 3-track pipeline visual
    tracks = [
        ("1.0x 常速", "自然美式語速", C_INDIGO),
        ("0.78x 慢速", "聽清連音弱讀", C_TEAL),
        ("中文釋義", "即時驗證理解", C_AMBER),
    ]
    tx = 0.90
    for idx, (t1, t2, col) in enumerate(tracks):
        add_rect(slide, tx, 2.98, 1.52, 0.92, fill_color=col, rounded=True, radius=0.12)
        add_textbox(slide, tx + 0.06, 3.08, 1.40, 0.36, t1, size=13, bold=True, color=C_WHITE, align=PP_ALIGN.CENTER, margin=0.01)
        add_textbox(slide, tx + 0.06, 3.46, 1.40, 0.32, t2, size=10, color=C_WHITE, align=PP_ALIGN.CENTER, margin=0.01)
        if idx < 2:
            add_textbox(slide, tx + 1.52, 3.22, 0.25, 0.36, "➜", size=14, bold=True, color=C_SLATE_400, align=PP_ALIGN.CENTER, margin=0.0)
        tx += 1.77

    # 6 Playlists list
    add_textbox(slide, 0.90, 4.08, 5.05, 0.30, "內建 6 大精選磨耳朵歌單（支援語速與自動循環）：", size=11.5, bold=True, color=C_SLATE_700, margin=0.01)
    playlists = [
        "• 睡前 12 組美式高頻 3 秒 Q&A 磨耳朵",
        "• 出國旅遊：機場過海關與餐廳點餐實戰",
        "• 飯店 Check-in、計程車與問路精選",
        "• 咖啡點餐、看電影與下班放鬆磨耳朵",
        "• 美國人公園閒聊與職場電話沉浸聽",
        "• 職場商務實戰：開會、專案、改期與面試",
    ]
    add_textbox(slide, 0.90, 4.44, 5.05, 2.15, "\n".join(playlists), size=11.2, color=C_SLATE_600, line_spacing=1.42, margin=0.01)

    # Right Panel: 3-Second Quick Response
    add_rect(slide, 6.45, 1.80, 6.23, 4.98, fill_color=C_WHITE, line_color=C_BORDER, line_pt=1.2, rounded=True, radius=0.06)
    add_pill(slide, 6.70, 2.02, 2.55, 0.32, "3-SEC DRILL · 76 組高頻快答", C_ORANGE_LIGHT, C_ORANGE, size=10)
    add_textbox(slide, 6.70, 2.42, 5.75, 0.40, "3 秒倒數開口：強制跳過「中翻英」", size=16, bold=True, color=C_SLATE_900, margin=0.01)

    qas = [
        ("日常寒暄", "Q: How's it going today?", "A: Pretty good, just a bit tired.", "別再千篇一律背 I'm fine, thank you！用 Pretty good 開頭最自然。"),
        ("朋友閒聊", "Q: What's up with you today?", "A: Not much, just hanging around here.", "遇到 What's up? 八成母語者都以 Not much / Nothing much 起手。"),
        ("辦公協作", "Q: Do you mind if I borrow your notes?", "A: Not at all, feel free to take them!", "高頻陷阱提醒：「不介意」要答 Not at all，千萬別順口說 Yes！"),
    ]
    qy = 2.98
    for tag, q_txt, a_txt, tip in qas:
        add_rect(slide, 6.70, qy, 5.73, 1.15, fill_color=C_SLATE_100, rounded=True, radius=0.08)
        add_pill(slide, 6.84, qy + 0.12, 0.92, 0.26, tag, C_ORANGE, C_WHITE, size=9)
        add_textbox(slide, 7.86, qy + 0.10, 4.45, 0.30, q_txt, size=11.5, bold=True, color=C_SLATE_900, margin=0.01)
        add_textbox(slide, 6.84, qy + 0.44, 5.45, 0.30, a_txt, size=12, bold=True, color=C_EMERALD, margin=0.01)
        add_textbox(slide, 6.84, qy + 0.77, 5.45, 0.30, tip, size=10, color=C_SLATE_600, margin=0.01)
        qy += 1.24

    add_notes(slide, """
很多上班族說「我沒時間坐下來念英文」，所以 EchoSpeak 設計了兩大碎片時間神器：
左邊是「磨耳朵循環播放器」，內建 6 大歌單，每句照「常速 ➜ 慢速 ➜ 中文」自動輪播，搭捷運或睡前戴上耳機就能練。
右邊是「3 秒直覺反應訓練」，收錄 76 組從日常寒暄到職場商務的高頻問答，系統會播放英文問句並倒數 3 秒，逼你在大腦翻譯前直接講出道地回應，還附有像 Do you mind...? 不該回答 Yes 這類超實用的防呆解析。
""")


def build_slide_06_sentence_patterns(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_header_footer(
        slide, 6,
        "05 · SLOT PATTERNS",
        "萬用詞槽句型：背 1 個骨架，變化出 20 句實戰英文",
        "精選 29 組高頻詞槽公式（Sentence Patterns），只需替換彩色關鍵詞槽即可橫掃不同情境",
        accent=C_TEAL, accent_bg=C_TEAL_LIGHT
    )

    patterns = [
        (
            "飲食過敏 · 餐廳必備", C_ORANGE, C_ORANGE_LIGHT,
            "I'd like to have the [ 主餐 ], and please make it without [ 過敏原 ].",
            "範例：I'd like to have the grilled salmon, and please make it without nuts.",
            [("主餐替換", "grilled salmon / Caesar salad / veggie pasta"), ("過敏原替換", "nuts / peanuts / dairy / spicy sauce")],
            "語用提醒：用 I'd like to have 較禮貌，過敏務必加 make it without..."
        ),
        (
            "問路交通 · 旅遊急救", C_INDIGO, C_INDIGO_LIGHT,
            "Excuse me, where is the nearest [ 地點 ], and how do I get there?",
            "範例：Excuse me, where is the nearest subway station, and how do I get there?",
            [("地點替換", "subway / pharmacy / restroom / ATM"), ("禮貌起手", "先說 Excuse me ＋ the nearest 問精準路線")],
            "語用提醒：一次問完「在哪裡」和「怎麼走」，避免不敢追問的尷尬。"
        ),
        (
            "緊急自保 · 遺失報案", C_ROSE, C_ROSE_LIGHT,
            "This is an emergency. My [ 遺失物品 ] is missing, and I need to file a report.",
            "範例：This is an emergency. My passport is missing, and I need to file a report.",
            [("遺失物替換", "passport / wallet / suitcase / credit card"), ("關鍵動詞", "file a report（報案立卷，理賠必備）")],
            "語用提醒：危急時刻先喊 This is an emergency 立即取得優先協助。"
        ),
    ]

    py = 1.78
    for tag, col, bg, formula, example, slots, note in patterns:
        add_rect(slide, 0.65, py, 12.033, 1.62, fill_color=C_WHITE, line_color=C_BORDER, line_pt=1.2, rounded=True, radius=0.06)
        add_rect(slide, 0.65, py, 0.12, 1.62, fill_color=col)

        # Left column inside card: formula & example
        add_pill(slide, 0.92, py + 0.12, 1.95, 0.27, tag, bg, col, size=9.8)
        add_textbox(slide, 0.92, py + 0.44, 7.15, 0.42, formula, size=13.5, bold=True, color=C_SLATE_900, margin=0.01)
        add_textbox(slide, 0.92, py + 0.88, 7.15, 0.30, example, size=10.8, bold=True, color=col, margin=0.01)
        add_textbox(slide, 0.92, py + 1.22, 7.15, 0.32, note, size=9.8, color=C_SLATE_500, margin=0.01)

        # Right column inside card: slot chips
        add_rect(slide, 8.22, py + 0.12, 4.26, 1.38, fill_color=C_SLATE_100, rounded=True, radius=0.08)
        sy = py + 0.18
        for s_lbl, s_vals in slots:
            add_textbox(slide, 8.36, sy, 4.00, 0.24, f"▸ {s_lbl}", size=9.8, bold=True, color=col, margin=0.0)
            add_textbox(slide, 8.36, sy + 0.24, 4.00, 0.36, s_vals, size=9.8, color=C_SLATE_700, margin=0.0)
            sy += 0.64

        py += 1.74

    add_notes(slide, """
初學者最怕背了一堆單獨的例句，換個情境就不會講。
EchoSpeak 整理了 29 組「萬用詞槽句型」，在網站上可以直接點選不同詞槽切換替換詞並聽語音。
就像這頁展示的三個黃金骨架：餐廳過敏點餐、街頭問路、以及遺失報案的 file a report，只要記熟句型結構，出國或上班遇到變化狀況都能自由組裝！
""")


def build_slide_07_native_upgrades(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_header_footer(
        slide, 7,
        "06 · NATIVE UPGRADES",
        "道地美式口語升級：告別死板教科書語氣",
        "收錄 9 大類 37 組「教科書 vs. 美式母語」對照，學會緩衝（Softening / Hedging）讓溝通既專業又親切",
        accent=C_EMERALD, accent_bg=C_EMERALD_LIGHT
    )

    # Comparison Table (Left 8.8 inches)
    rows_data = [
        ("場景", "教科書生硬講法", "道地美式口語升級", "語氣心法"),
        ("會議反對", "I disagree with your plan.", "That's fair, but hear me out.", "先認同再補觀點，大幅降防禦心"),
        ("婉拒插單", "I am very busy.", "I'm stretched pretty thin.", "形容人力拉滿，專業又不傷和氣"),
        ("商務改期", "Can we delay the meeting?", "Any chance we could push it to Thu?", "Any chance 留給對方舒服空間"),
        ("高度共鳴", "I agree with you.", "Tell me about it!", "意為「可不是嘛！我超懂！」"),
        ("自然道別", "I have to leave now.", "I've got to hit the road.", "美式日常準備動身離開的慣用語"),
    ]

    tbl_shape = slide.shapes.add_table(len(rows_data), 4, Inches(0.65), Inches(1.82), Inches(8.90), Inches(4.92))
    tbl = tbl_shape.table
    col_widths = [1.15, 2.35, 3.05, 2.35]
    for ci, cw in enumerate(col_widths):
        tbl.columns[ci].width = Inches(cw)

    for ri, row in enumerate(rows_data):
        for ci, val in enumerate(row):
            cell = tbl.cell(ri, ci)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.margin_left = Inches(0.10)
            cell.margin_right = Inches(0.08)
            cell.margin_top = Inches(0.06)
            cell.margin_bottom = Inches(0.06)

            cell.fill.solid()
            if ri == 0:
                cell.fill.fore_color.rgb = C_NAVY
                txt_col = C_WHITE
                fsize = 11.5
                fbold = True
            else:
                cell.fill.fore_color.rgb = C_WHITE if ri % 2 == 1 else C_SLATE_100
                if ci == 0:
                    txt_col, fsize, fbold = C_SLATE_900, 11, True
                elif ci == 1:
                    txt_col, fsize, fbold = C_ROSE, 11, False
                elif ci == 2:
                    txt_col, fsize, fbold = C_EMERALD, 11.5, True
                else:
                    txt_col, fsize, fbold = C_SLATE_600, 10.2, False

            p = cell.text_frame.paragraphs[0]
            p.line_spacing = 1.2
            r = p.add_run()
            r.text = val
            r.font.name = FONT_MAIN
            r.font.size = Pt(fsize)
            r.font.bold = fbold
            r.font.color.rgb = txt_col

    # Right Side Card: Register Spectrum
    add_rect(slide, 9.78, 1.82, 2.90, 4.92, fill_color=C_WHITE, line_color=C_BORDER, line_pt=1.2, rounded=True, radius=0.06)
    add_rect(slide, 9.78, 1.82, 2.90, 0.56, fill_color=C_EMERALD_LIGHT)
    add_textbox(slide, 9.95, 1.94, 2.56, 0.34, "同義詞語氣光譜", size=14, bold=True, color=C_EMERALD, margin=0.01)
    add_textbox(slide, 9.95, 2.48, 2.56, 0.62, "同一句話依場合「換檔」，內建 4 大語氣光譜：", size=10.2, color=C_SLATE_600, line_spacing=1.28, margin=0.01)

    spectrum = [
        ("FORMAL 正式商務", "Point well taken.\nGood morning, how are you doing?", C_INDIGO, C_INDIGO_LIGHT),
        ("NEUTRAL 職場中性", "Could you look this over?\nI'm afraid I can't make it.", C_TEAL, C_TEAL_LIGHT),
        ("INFORMAL 朋友俚語", "Hang on a sec!\nI'm swamped today.", C_ORANGE, C_ORANGE_LIGHT),
    ]
    sy = 3.20
    for lbl, ex, col, bg in spectrum:
        add_rect(slide, 9.95, sy, 2.56, 1.06, fill_color=bg, rounded=True, radius=0.10)
        add_textbox(slide, 10.08, sy + 0.10, 2.32, 0.26, lbl, size=9.5, bold=True, color=col, margin=0.0)
        add_textbox(slide, 10.08, sy + 0.38, 2.32, 0.62, ex, size=10.2, bold=True, color=C_SLATE_900, line_spacing=1.25, margin=0.0)
        sy += 1.18

    add_notes(slide, """
很多進階學習者文法沒錯，卻常讓外國同事覺得「講話太直接」。關鍵就在「緩衝語氣（Softening 與 Hedging）」。
例如開會反對不要直講 I disagree，改說 That's fair, but hear me out；工作太忙婉拒插單不說 I'm very busy，而是說 I'm stretched pretty thin。
右側展示的「語氣光譜」也幫助學員依對象切換正式、中性與俚語檔位，真正講出得體的美式英文。
""")


def build_slide_08_workplace_pack(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_header_footer(
        slide, 8,
        "07 · SPOTLIGHT · BUSINESS PACK",
        "焦點專包：職場商務英語 4 大高壓實戰場景",
        "全新擴充 4 課職場情境＋16 題商務 3 秒 Q&A＋216 支專屬語音，幫你從容應對外商會議與英文面試",
        accent=C_TEAL, accent_bg=C_TEAL_LIGHT
    )

    cards = [
        ("01", "開會發言與禮貌反對", "Meetings & Polite Disagreement", C_TEAL,
         "• 肯定後轉折：That's fair, but hear me out.\n• 肯定好論點：Point well taken.\n• 禮貌插話：Sorry to jump in, could we double-check the timeline?",
         "核心心法：外商會議重「先接球、再提替代方案」"),
        ("02", "專案進度追蹤與分工協調", "Project Updates & Deadlines", C_INDIGO,
         "• 婉拒超負荷：I can't commit right now. I'm stretched pretty thin.\n• 請同事過目：Could you look this over? I'm a bit stuck here.\n• 事前預警：Just a quick heads-up, the vendor needs two more days.",
         "核心心法：提早給 heads-up 比最後一天跳票更顯專業"),
        ("03", "約時間、撞期改期與確認", "Scheduling & Email Follow-ups", C_ORANGE,
         "• 撞期神句：I accidentally double-booked myself.\n• 柔順改期：Any chance we could push it to Thursday?\n• 會議收尾：I'll shoot you a quick recap email with action items.",
         "核心心法：改期必附替代時段，收尾用 recap 鎖定共識"),
        ("04", "英文面試與自我介紹", "Interviews & Career Move", C_VIOLET,
         "• 精準破冰：I've spent 5 years leading cross-functional teams.\n• 轉職動機：I'm looking to create broader impact in a global role.\n• 個人優勢：My strength is turning messy issues into clear plans.",
         "核心心法：用 STAR 結構講成果數據，展現自信與條理"),
    ]

    positions = [(0.65, 1.82), (6.80, 1.82), (0.65, 4.40), (6.80, 4.40)]
    cw, ch = 5.88, 2.38

    for (cx, cy), (num, zh, en, col, bullets, tip) in zip(positions, cards):
        add_rect(slide, cx, cy, cw, ch, fill_color=C_WHITE, line_color=C_BORDER, line_pt=1.2, rounded=True, radius=0.06)
        add_rect(slide, cx, cy, 0.11, ch, fill_color=col)
        add_pill(slide, cx + 0.25, cy + 0.14, 0.56, 0.28, num, col, C_WHITE, size=10)
        add_textbox(slide, cx + 0.90, cy + 0.10, 4.75, 0.34, zh, size=15, bold=True, color=C_SLATE_900, margin=0.01)
        add_textbox(slide, cx + 0.90, cy + 0.42, 4.75, 0.24, en, size=9.8, bold=True, color=col, margin=0.01)

        add_textbox(slide, cx + 0.25, cy + 0.72, cw - 0.42, 1.18, bullets, size=10.2, color=C_SLATE_700, line_spacing=1.26, margin=0.01)

        add_rect(slide, cx + 0.22, cy + 1.94, cw - 0.40, 0.32, fill_color=C_SLATE_100, rounded=True, radius=0.25)
        add_textbox(slide, cx + 0.32, cy + 1.98, cw - 0.60, 0.24, tip, size=9.6, bold=True, color=col, margin=0.0)

    add_notes(slide, """
這是 EchoSpeak 最新推出的 Phase 3「職場商務英語專包」。
針對台灣上班族最常卡關的四大高壓場合：開會禮貌反對、專案協調、行程改期、以及英文面試，打造了 4 堂完整四步驟課程、16 組職場 3 秒快問快答，以及 5 組職場 AI 角色扮演情境，並提供 276 支 MP3 的獨立離線語音包，讓你在出差飛機上也能隨時演練。
""")


def build_slide_09_travel_survival(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_header_footer(
        slide, 9,
        "08 · SPOTLIGHT · TRAVEL SURVIVAL",
        "出國旅遊生存路線 × 免網路隨身急救卡",
        "打通從下飛機到返國 5 大必經關卡，內建 22 支預快取急救語音，飛航模式也能秒開秒播",
        accent=C_ROSE, accent_bg=C_ROSE_LIGHT
    )

    # Top Horizontal Journey Strip (5 Stops)
    stops = [
        ("01 機場海關", "託運、靠窗位、入境目的"),
        ("02 飯店入住", "押金、Wi-Fi、延遲退房"),
        ("03 交通問路", "跳錶刷卡、地鐵方向"),
        ("04 餐廳點餐", "過敏禁忌、小費與分帳"),
        ("05 血拼與藥局", "試穿退換、症狀買藥"),
    ]
    sw = 2.24
    sgap = 0.208
    sx = 0.65
    for i, (st, sd) in enumerate(stops):
        add_rect(slide, sx, 1.82, sw, 1.10, fill_color=C_WHITE, line_color=C_INDIGO_MID, line_pt=1.3, rounded=True, radius=0.08)
        add_rect(slide, sx, 1.82, sw, 0.10, fill_color=C_INDIGO)
        add_textbox(slide, sx + 0.12, 2.00, sw - 0.24, 0.34, st, size=13, bold=True, color=C_INDIGO, align=PP_ALIGN.CENTER, margin=0.01)
        add_textbox(slide, sx + 0.12, 2.38, sw - 0.24, 0.44, sd, size=10.5, color=C_SLATE_600, align=PP_ALIGN.CENTER, line_spacing=1.25, margin=0.01)
        if i < 4:
            add_textbox(slide, sx + sw + 0.02, 2.18, 0.17, 0.36, "➜", size=12, bold=True, color=C_INDIGO, align=PP_ALIGN.CENTER, margin=0.0)
        sx += sw + sgap

    # Bottom Emergency Survival Card Showcase
    add_rect(slide, 0.65, 3.16, 12.033, 3.64, fill_color=C_WHITE, line_color=RGBColor(0xFE, 0xCD, 0xD3), line_pt=1.5, rounded=True, radius=0.06)
    add_rect(slide, 0.65, 3.16, 12.033, 0.58, fill_color=C_ROSE)
    add_textbox(
        slide, 0.90, 3.26, 8.2, 0.38,
        "隨身自保急救卡（Survival Kit）· PWA 自動預快取 22 支關鍵語音",
        size=15, bold=True, color=C_WHITE, margin=0.01
    )
    add_pill(slide, 10.35, 3.30, 2.10, 0.30, "飛航模式離線可用", C_WHITE, C_ROSE, size=10)

    em_cards = [
        ("飲食過敏自保", "I have a severe nut allergy. Does this dish contain any nuts?", "點餐前必亮出，守護安全零誤食"),
        ("護照遺失報案", "This is an emergency. My passport is missing, and I need to file a report.", "立刻取得報案編號辦理補發與理賠"),
        ("藥局症狀溝通", "I've had a bad headache since morning. What do you recommend?", "清楚描述發作時間並請藥師推薦成藥"),
        ("溝通聽不懂救場", "Sorry, could you say that a bit more slowly? I want to make sure I got it right.", "不慌張、優雅請對方放慢語速確認"),
    ]
    ex_pos = [(0.90, 3.94), (6.72, 3.94), (0.90, 5.34), (6.72, 5.34)]
    for (ex, ey), (etitle, een, ezh) in zip(ex_pos, em_cards):
        add_rect(slide, ex, ey, 5.70, 1.24, fill_color=C_ROSE_LIGHT, rounded=True, radius=0.08)
        add_pill(slide, ex + 0.14, ey + 0.12, 1.55, 0.25, etitle, C_ROSE, C_WHITE, size=9.2)
        add_textbox(slide, ex + 0.14, ey + 0.42, 5.42, 0.48, een, size=11.2, bold=True, color=C_SLATE_900, line_spacing=1.2, margin=0.0)
        add_textbox(slide, ex + 0.14, ey + 0.94, 5.42, 0.24, ezh, size=9.8, color=C_SLATE_600, margin=0.0)

    add_notes(slide, """
出國自助旅行最怕兩件事：一是在關鍵場合腦袋空白，二是國外沒網路打不開翻譯軟體。
EchoSpeak 不只完整串起機場、飯店、交通、點餐、血拼與藥局 5 大關卡，更把 22 支最高危的「隨身急救卡」語音做成 PWA 離線預快取。只要加入手機主畫面，就算在飛航模式或沒有漫遊訊號的地下街，打開就能直接點擊播放原音或亮出大字英文求助！
""")


def build_slide_10_ai_roleplay(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_header_footer(
        slide, 10,
        "09 · PHASE 2 · AI ROLEPLAY",
        "AI 實境口說角色扮演：24 小時隨叫隨到的母語陪練",
        "Cloudflare Worker × Groq Whisper / Llama 驅動，15 組情境＋自訂場景，真正開口練到不怕老外",
        accent=C_VIOLET, accent_bg=C_VIOLET_LIGHT
    )

    # Left: 4 Core Features
    feats = [
        ("15 組預設情境 ＋ 自訂任意場景", "涵蓋機場、飯店、餐廳、購物、職場開會與面試；也可自行輸入角色、背景與 3 項對話任務。"),
        ("雙軌語音輸入 ＋ 3 級難度切換", "支援即時語音辨識（Dictation）與高準度 Whisper 錄音轉寫；可依程度選零基礎、初級或道地進階。"),
        ("卡詞不冷場：3 種語氣救場提示", "講不出來一鍵呼叫 AI 救場，同時提供「極簡救急 / 道地自然 / 禮貌進階」三種即戰回答。"),
        ("逐句美式自然度回饋 ＋ 總評報告", "每輪對話即時顯示語氣優化建議，結束後產出任務達成率、自然度分數與可收藏的升級金句。"),
    ]
    fy = 1.84
    for idx, (ft, fd) in enumerate(feats):
        add_rect(slide, 0.65, fy, 6.20, 1.12, fill_color=C_WHITE, line_color=C_BORDER, line_pt=1.2, rounded=True, radius=0.08)
        add_oval(slide, 0.85, fy + 0.30, 0.50, 0.50, C_VIOLET_LIGHT)
        add_textbox(slide, 0.85, fy + 0.37, 0.50, 0.34, f"0{idx+1}", size=12, bold=True, color=C_VIOLET, align=PP_ALIGN.CENTER, margin=0.0)
        add_textbox(slide, 1.50, fy + 0.14, 5.18, 0.32, ft, size=13.5, bold=True, color=C_SLATE_900, margin=0.01)
        add_textbox(slide, 1.50, fy + 0.48, 5.18, 0.54, fd, size=10.6, color=C_SLATE_600, line_spacing=1.28, margin=0.01)
        fy += 1.24

    # Right: Visual Mockup of AI Roleplay Interface
    add_rect(slide, 7.12, 1.84, 5.56, 4.92, fill_color=C_NAVY, rounded=True, radius=0.06)
    # Mockup top bar
    add_rect(slide, 7.12, 1.84, 5.56, 0.62, fill_color=C_INDIGO_DARK)
    add_textbox(slide, 7.36, 1.97, 3.6, 0.34, "AI Roleplay · 飯店入住 Check-in", size=12.5, bold=True, color=C_WHITE, margin=0.01)
    add_pill(slide, 11.15, 1.98, 1.32, 0.30, "任務 2 / 3", C_EMERALD, C_WHITE, size=9.5)

    # AI bubble
    add_rect(slide, 7.38, 2.66, 4.35, 0.90, fill_color=RGBColor(0x1E, 0x29, 0x3B), rounded=True, radius=0.10)
    add_textbox(slide, 7.52, 2.74, 4.08, 0.24, "Hotel Receptionist (AI)", size=9, bold=True, color=C_INDIGO_MID, margin=0.0)
    add_textbox(slide, 7.52, 2.98, 4.08, 0.50, "\"Welcome! May I have your name and a credit card for incidentals?\"", size=10.5, color=C_WHITE, line_spacing=1.2, margin=0.0)

    # User bubble
    add_rect(slide, 8.18, 3.70, 4.24, 0.78, fill_color=C_INDIGO, rounded=True, radius=0.10)
    add_textbox(slide, 8.32, 3.78, 3.96, 0.22, "You (Voice Input)", size=9, bold=True, color=C_INDIGO_MID, margin=0.0)
    add_textbox(slide, 8.32, 4.02, 3.96, 0.38, "\"Sure, under Lin. Can I check out late tomorrow?\"", size=10.5, color=C_WHITE, margin=0.0)

    # Instant AI Feedback Card inside mockup
    add_rect(slide, 7.38, 4.64, 5.04, 1.16, fill_color=RGBColor(0x06, 0x4E, 0x3B), line_color=C_EMERALD, line_pt=1.0, rounded=True, radius=0.08)
    add_textbox(slide, 7.54, 4.74, 3.4, 0.26, "即時美式自然度回饋", size=10.5, bold=True, color=C_EMERALD_LIGHT, margin=0.0)
    add_pill(slide, 11.20, 4.72, 1.08, 0.26, "92 / 100", C_EMERALD, C_WHITE, size=9.5)
    add_textbox(
        slide, 7.54, 5.04, 4.72, 0.66,
        "很自然！若想更禮貌地道，可升級為：\n\"Any chance I could get a late checkout tomorrow?\"",
        size=10.2, color=C_WHITE, line_spacing=1.28, margin=0.0
    )

    # Rescue Hint Pills at bottom of mockup
    add_textbox(slide, 7.38, 5.96, 5.04, 0.24, "卡詞救場 3 語氣提示：", size=9.5, bold=True, color=C_SLATE_400, margin=0.0)
    add_pill(slide, 7.38, 6.24, 1.56, 0.32, "極簡救急", C_EMERALD, C_WHITE, size=9.5)
    add_pill(slide, 9.10, 6.24, 1.56, 0.32, "道地自然", C_INDIGO, C_WHITE, size=9.5)
    add_pill(slide, 10.82, 6.24, 1.60, 0.32, "禮貌進階", C_VIOLET, C_WHITE, size=9.5)

    add_notes(slide, """
Phase 2 最受歡迎的功能就是 AI 實境口說角色扮演！
很多學員背完課程還是不敢跟真人講，因為怕聽錯、怕冷場。在這裡你可以選擇 15 個真實場景或自己建立情境（例如星巴克點燕麥拿鐵），直接按麥克風開口講英文。
講不出來隨時按「救場提示」，AI 會給出極簡、道地、禮貌三種說法；每一輪還會給你美式自然度回饋與升級句，結束後產出完整總評報告並同步到雲端。
""")


def build_slide_11_pronunciation_srs_offline(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_header_footer(
        slide, 11,
        "10 · AI COACH · SRS · PWA OFFLINE",
        "AI 發音打磨 × SRS 科學複習 × 離線語音包",
        "三大續航引擎：幫你修掉中式腔調、對抗遺忘曲線，並把 868 支 MP3 裝進手機離線隨身帶",
        accent=C_INDIGO, accent_bg=C_INDIGO_LIGHT
    )

    cols = [
        ("ENGINE 01", "Step 3 AI 發音教練", "Pronunciation & Linking Coach", C_ORANGE, C_ORANGE_LIGHT,
         [
             "• 逐字比對你的錄音與原音標準句",
             "• 精準指出漏字、重音偏移與弱讀盲點",
             "• 標註美式連音技巧（如 kind of ➜ kinda）",
             "• 給予 0–100 分量化評分與具體口型建議",
         ],
         "效果：不用花大錢請外師，每句都能反覆打磨"),
        ("ENGINE 02", "SRS 間隔重複複習庫", "Spaced Repetition Vault", C_INDIGO, C_INDIGO_LIGHT,
         [
             "• 在課程、AI 對話、測驗中一鍵收藏金句",
             "• 依艾賓浩斯記憶曲線自動排程複習時間",
             "• 透過「生疏 / 模糊 / 秒答」動態調整間隔",
             "• 登入 Google 帳號跨裝置 Firestore 雲端同步",
         ],
         "效果：把看過的句子真正變成自己的口說武器"),
        ("ENGINE 03", "PWA 離線語音包中心", "5 Offline Audio Packs · 24.4 MB", C_TEAL, C_TEAL_LIGHT,
         [
             "• 支援 iOS / Android 一鍵加入手機主畫面",
             "• 5 大分類語音包（含職場包 276 支 / 8.6 MB）",
             "• 亦支援「單課離線下載」精準省空間",
             "• Service Worker 支援 iOS Range 206 順暢播放",
         ],
         "效果：搭機、地鐵、國外無漫遊一樣流暢學習"),
    ]

    cw = 3.82
    gap = 0.286
    sx = 0.65
    for i, (tag, zh, en, col, bg, bullets, footer) in enumerate(cols):
        cx = sx + i * (cw + gap)
        add_rect(slide, cx, 1.84, cw, 4.92, fill_color=C_WHITE, line_color=C_BORDER, line_pt=1.2, rounded=True, radius=0.06)
        add_rect(slide, cx, 1.84, cw, 0.12, fill_color=col)
        add_pill(slide, cx + 0.24, 2.12, 1.25, 0.28, tag, bg, col, size=9.8)
        add_textbox(slide, cx + 0.24, 2.50, cw - 0.48, 0.40, zh, size=17, bold=True, color=C_SLATE_900, margin=0.01)
        add_textbox(slide, cx + 0.24, 2.90, cw - 0.48, 0.28, en, size=10.2, bold=True, color=col, margin=0.01)
        add_rect(slide, cx + 0.24, 3.26, cw - 0.48, 0.015, fill_color=C_SLATE_200)
        add_textbox(slide, cx + 0.24, 3.42, cw - 0.48, 2.40, "\n\n".join(bullets), size=11.3, color=C_SLATE_700, line_spacing=1.25, margin=0.01)

        add_rect(slide, cx + 0.20, 6.02, cw - 0.40, 0.56, fill_color=bg, rounded=True, radius=0.14)
        add_textbox(slide, cx + 0.28, 6.08, cw - 0.56, 0.44, footer, size=10.2, bold=True, color=col, valign=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER, margin=0.01)

    add_notes(slide, """
學英文最怕三分鐘熱度，因此 EchoSpeak 建構了三大續航引擎：
第一是 Step 3 AI 發音教練，幫助你在跟讀時即時校正連音與重音；
第二是 SRS 間隔重複複習庫，自動在快忘記前提醒複習，配合 Google 登入跨手機電腦同步；
第三是完整 PWA 離線架構，全站 868 支 MP3 總容量僅 24.4 MB，可以整包或單課預先快取到手機，在飛機上也能無網路磨耳朵！
""")


def build_slide_12_sprint_and_badges(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_header_footer(
        slide, 12,
        "11 · GAMIFICATION · 7-DAY SPRINT",
        "7 天旅遊英文衝刺營 × 12 枚成就徽章",
        "透過遊戲化目標與自動進度同步，在出國前 7 天系統化建立全套開口自信與學習慣性",
        accent=C_AMBER, accent_bg=C_AMBER_LIGHT
    )

    # Top Section: 7-Day Sprint Roadmap
    add_textbox(slide, 0.65, 1.74, 12.0, 0.34, "7 日實戰衝刺任務地圖（可依序挑戰或跳關搶先通關，完賽解鎖專屬結業證書）", size=13, bold=True, color=C_SLATE_900, margin=0.01)

    days = [
        ("Day 1", "機場通關", "劃位託運\n海關問答", C_INDIGO),
        ("Day 2", "飯店入住", "押金 Wi-Fi\nAI 實戰", C_INDIGO),
        ("Day 3", "交通×3秒", "計程車問路\n5 題快答", C_TEAL),
        ("Day 4", "點餐×發音", "過敏點餐\nAI 發音測", C_TEAL),
        ("Day 5", "血拼試穿", "尺寸替換\n退換貨議價", C_ORANGE),
        ("Day 6", "藥局急救", "症狀溝通\n3 張 SRS 卡", C_ROSE),
        ("Day 7", "AI 總驗收", "2 場自由扮演\n領結業證書", C_AMBER),
    ]
    dw = 1.59
    dgap = 0.15
    dx = 0.65
    for dnum, dtitle, ddesc, dcol in days:
        add_rect(slide, dx, 2.16, dw, 1.92, fill_color=C_WHITE, line_color=C_BORDER, line_pt=1.2, rounded=True, radius=0.08)
        add_rect(slide, dx, 2.16, dw, 0.42, fill_color=dcol)
        add_textbox(slide, dx + 0.06, 2.22, dw - 0.12, 0.30, dnum, size=11.5, bold=True, color=C_WHITE, align=PP_ALIGN.CENTER, margin=0.0)
        add_textbox(slide, dx + 0.08, 2.68, dw - 0.16, 0.34, dtitle, size=12.5, bold=True, color=C_SLATE_900, align=PP_ALIGN.CENTER, margin=0.0)
        add_textbox(slide, dx + 0.08, 3.10, dw - 0.16, 0.84, ddesc, size=10.5, color=C_SLATE_600, align=PP_ALIGN.CENTER, line_spacing=1.32, margin=0.0)
        dx += dw + dgap

    # Bottom Section: 12 Achievement Badges in 4 Categories
    add_textbox(slide, 0.65, 4.30, 12.0, 0.34, "12 枚學習成就徽章館（系統自動追蹤紀錄，即時點亮進度條）", size=13, bold=True, color=C_SLATE_900, margin=0.01)

    badge_groups = [
        ("口說實戰（5 枚）", C_VIOLET, C_VIOLET_LIGHT,
         "• 初次破冰開口（1 場 AI 扮演）\n• 實境對話老手（5 場 AI 扮演）\n• 道地美式達人（自然度 ≥ 85）\n• 發音模範生 / 跟讀打磨師"),
        ("聽力反應（2 枚）", C_ORANGE, C_ORANGE_LIGHT,
         "• 3 秒閃電反應\n  （累積 10 題高分秒答）\n• 磨耳朵馬拉松\n  （循環聽力累計達 30 分鐘）"),
        ("學習習慣（4 枚）", C_EMERALD, C_EMERALD_LIGHT,
         "• 記憶建築師（收藏 10 張 SRS）\n• 情境探索者（通關 3 課情境）\n• 三日不間斷（連續打卡 3 天）\n• 七日黃金習慣（連續打卡 7 天）"),
        ("衝刺挑戰（1 枚）", C_AMBER, C_AMBER_LIGHT,
         "• 旅遊英文衝刺結業\n  （完成全部 7 日實戰任務）\n\n解鎖專屬「數位結業證書」\n展現出國全場景口說實力！"),
    ]
    bw = 2.86
    bgap = 0.197
    bx = 0.65
    for title, col, bg, desc in badge_groups:
        add_rect(slide, bx, 4.72, bw, 2.08, fill_color=C_WHITE, line_color=C_BORDER, line_pt=1.2, rounded=True, radius=0.06)
        add_rect(slide, bx, 4.72, bw, 0.42, fill_color=bg)
        add_textbox(slide, bx + 0.14, 4.79, bw - 0.28, 0.28, title, size=12, bold=True, color=col, margin=0.0)
        add_textbox(slide, bx + 0.14, 5.22, bw - 0.28, 1.48, desc, size=10.3, color=C_SLATE_700, line_spacing=1.32, margin=0.01)
        bx += bw + bgap

    add_notes(slide, """
為了讓學習更有成就感，平台內建了「7 天旅遊英文衝刺營」與「12 枚成就徽章」。
7 天任務地圖會自動讀取你在全站的情境進度、3 秒問答、發音評測與 AI 角色扮演紀錄，不需要手動打勾，完成 7 天就能領取專屬結業證書；搭配口說、聽力、習慣與挑戰四大類徽章，幫你養出每天開口的黃金慣性。
""")


def build_slide_13_action_plan(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide, C_NAVY)

    # Top & left decorative bars
    add_rect(slide, 0, 0, 13.333, 0.10, fill_color=C_AMBER)
    add_oval(slide, 10.6, -1.2, 4.0, 4.0, fill_color=RGBColor(0x1E, 0x1B, 0x4B))
    add_oval(slide, -1.2, 5.2, 3.6, 3.6, fill_color=RGBColor(0x1E, 0x1B, 0x4B))

    add_pill(slide, 0.85, 0.65, 2.95, 0.34, "12 · DAILY ACTION PLAN", RGBColor(0x31, 0x2E, 0x81), C_INDIGO_MID, size=10.5)
    add_textbox(slide, 0.85, 1.15, 11.6, 0.65, "每天只要 15 分鐘，啟動你的英文開口計畫", size=32, bold=True, color=C_WHITE, margin=0.01)
    add_textbox(slide, 0.85, 1.85, 11.2, 0.40, "不必辭職出國、不必硬啃文法書，照著「5 + 3 + 7」微習慣配方持續 7 天立刻有感", size=14.5, color=RGBColor(0xCB, 0xD5, 0xE1), margin=0.01)

    # 3 Daily Recipe Cards
    recipes = [
        ("早上通勤 · 5 分鐘", "磨耳朵暖機", C_INDIGO,
         "打開「磨耳朵循環播」選 1 份歌單，\n常速 ➜ 慢速 ➜ 中文免看螢幕聽完 1 輪，\n喚醒英文語感與連音節奏。"),
        ("午休空檔 · 3 分鐘", "3 秒直覺反應", C_ORANGE,
         "挑戰 10 題「3 秒快問快答」或\n複習 5 張「SRS 複習卡」，\n保持口腔與大腦的條件反射速度。"),
        ("睡前實戰 · 7 分鐘", "情境課 ＋ AI 角色扮演", C_EMERALD,
         "完成 1 課四步驟情境或進行 1 場\n「AI 實境口說角色扮演」，\n領取美式自然度評分並完成打卡！"),
    ]
    rw = 3.72
    rgap = 0.256
    rx = 0.85
    for time_lbl, title, col, desc in recipes:
        add_rect(slide, rx, 2.55, rw, 2.60, fill_color=RGBColor(0x1E, 0x29, 0x3B), line_color=RGBColor(0x33, 0x41, 0x55), line_pt=1.2, rounded=True, radius=0.08)
        add_rect(slide, rx, 2.55, rw, 0.10, fill_color=col)
        add_pill(slide, rx + 0.24, 2.84, 1.85, 0.30, time_lbl, col, C_WHITE, size=10.5)
        add_textbox(slide, rx + 0.24, 3.28, rw - 0.48, 0.42, title, size=18, bold=True, color=C_WHITE, margin=0.01)
        add_textbox(slide, rx + 0.24, 3.76, rw - 0.48, 1.24, desc, size=11.5, color=RGBColor(0xCB, 0xD5, 0xE1), line_spacing=1.38, margin=0.01)
        rx += rw + rgap

    # Bottom CTA Banner
    add_rect(slide, 0.85, 5.52, 11.633, 1.25, fill_color=C_INDIGO, rounded=True, radius=0.10)
    add_textbox(slide, 1.15, 5.68, 7.6, 0.42, "立即開始免費體驗 EchoSpeak 英文對話實戰平台", size=18, bold=True, color=C_WHITE, margin=0.01)
    add_textbox(
        slide, 1.15, 6.14, 7.8, 0.42,
        "網址：https://rh6554ya-netizen.github.io/english/  ·  支援 Google 登入雲端同步與手機 PWA 離線安裝",
        size=11.5, color=C_INDIGO_MID, margin=0.01
    )
    add_pill(slide, 9.55, 5.88, 2.65, 0.52, "START SPEAKING NOW ➜", C_AMBER, C_NAVY, size=12, bold=True)

    add_notes(slide, """
最後給大家一份最容易落地的「每天 15 分鐘 5+3+7 開口配方」：
早上通勤花 5 分鐘磨耳朵暖機、午休花 3 分鐘刷 3 秒快問快答、睡前花 7 分鐘走一課情境或跟 AI 角色扮演聊一場。
現在就能直接打開 https://rh6554ya-netizen.github.io/english/ 開始免費練習，建議用手機加入主畫面並登入 Google 帳號，把學習進度與離線語音包隨身帶著走。感謝聆聽，歡迎現場一起體驗！
""")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    build_slide_01_cover(prs)
    build_slide_02_pain_vs_solution(prs)
    build_slide_03_four_steps(prs)
    build_slide_04_five_domains(prs)
    build_slide_05_listening_and_3s(prs)
    build_slide_06_sentence_patterns(prs)
    build_slide_07_native_upgrades(prs)
    build_slide_08_workplace_pack(prs)
    build_slide_09_travel_survival(prs)
    build_slide_10_ai_roleplay(prs)
    build_slide_11_pronunciation_srs_offline(prs)
    build_slide_12_sprint_and_badges(prs)
    build_slide_13_action_plan(prs)

    out_path = Path("/home/admin/english/docs/EchoSpeak-完整課程教學簡報.pptx")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(out_path))
    print(f"Saved presentation: {out_path} ({out_path.stat().st_size:,} bytes, {len(prs.slides)} slides)")


if __name__ == "__main__":
    main()
