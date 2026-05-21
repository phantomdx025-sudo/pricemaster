from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

FONT_NAME = "Arial"

C_HEADER_BG   = "1F3864"
C_HEADER_FG   = "FFFFFF"
C_VENDOR_BG   = "D6E4F7"
C_VENDOR_FG   = "1F3864"
C_OPEN_BG     = "EBF3FB"
C_CLOSE_BG    = "FFF2CC"
C_PURCHASE_BG = "F2F2F2"
C_PAYMENT_BG  = "E8F5E9"
C_JOURNAL_BG  = "FFF8E7"
C_DEBIT_BG    = "FCE4EC"
C_ALT_ROW     = "FAFAFA"

C_RB_POS  = "1A5276"
C_RB_NEG  = "922B21"
C_RB_ZERO = "1E8449"

def mk_font(bold=False, color="000000", size=10, italic=False):
    return Font(name=FONT_NAME, bold=bold, color=color, size=size, italic=italic)

def mk_fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)

def thin_border():
    s = Side(style="thin", color="CCCCCC")
    return Border(left=s, right=s, top=s, bottom=s)

def medium_bottom_border():
    thin = Side(style="thin", color="CCCCCC")
    med  = Side(style="medium", color="666666")
    return Border(left=thin, right=thin, top=thin, bottom=med)

ALIGN_CENTER = Alignment(horizontal="center", vertical="center")
ALIGN_RIGHT  = Alignment(horizontal="right",  vertical="center")
ALIGN_LEFT   = Alignment(horizontal="left",   vertical="center")

NUMBER_FMT = '#,##0.00;(#,##0.00);"-"'
DATE_FMT   = "DD-MMM-YY"
