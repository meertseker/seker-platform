"""Aidat Excel ("2026 - 2027" sayfası) → hücre değeri + boya + yorum JSON.
fix-excel-parcalari.ts girdisi. Kullanım: python excel-hucreler.py <xlsx> <cikti.json>
"""
import sys, json, re, openpyxl
path, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(path, data_only=True)
ws = wb["2026 - 2027"]
def fill_rgb(c):
    f=c.fill
    if not f or f.patternType not in ("solid","gray125"): return None
    fg=f.fgColor
    if fg is None: return None
    rgb=getattr(fg,"rgb",None)
    if isinstance(rgb,str) and len(rgb)>=6 and not rgb.startswith("Values"): return rgb[-6:].upper()
    th=getattr(fg,"theme",None); tint=float(getattr(fg,"tint",0) or 0)
    if th==0 and tint<-0.3: return "GRAY"
    return f"THEME{th}" if th is not None else None
def note(c):
    if c.comment and c.comment.text:
        return re.sub(r"\n{3,}","\n\n",c.comment.text.replace("\r","")).strip()
    return None
MONTHS=[(9,"EYLUL"),(10,"EKIM"),(11,"KASIM"),(12,"ARALIK"),(13,"OCAK"),(14,"SUBAT"),(15,"MART"),(16,"NISAN"),(17,"MAYIS"),(18,"HAZIRAN")]
def rec(c):
    v=c.value
    return {"value": v if isinstance(v,(int,float)) else (str(v) if v is not None else None),"fill":fill_rgb(c),"note":note(c)}
rows=[]
for r in range(2, ws.max_row+1):
    n=ws.cell(r,1).value
    if not n or not str(n).strip(): continue
    rows.append({"row":r,"name":str(n).strip(),"kitap":rec(ws.cell(r,3)),"aidat_yillik":rec(ws.cell(r,4)),"months":{l:rec(ws.cell(r,c)) for c,l in MONTHS}})
json.dump(rows, open(out,"w",encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(rows))
