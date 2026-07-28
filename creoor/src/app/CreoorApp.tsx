import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Circle, Image as KonvaImage, Rect, Text, Group, Transformer } from "react-konva";
import type Konva from "konva";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUp, Brush, ChevronDown, ChevronLeft, ChevronRight, Crop, Eraser, Expand,
  Frame, Grid3X3, Hand, Image, ImagePlus, Layers3, Library, Maximize2, MessageCircle,
  Mic, MousePointer2, Palette, Paperclip, PenLine, Plus, Redo2, RotateCcw, Scissors,
  Search, Send, Shirt, Sparkles, Type, Upload, UserRound, WandSparkles, X, ZoomIn,
  ZoomOut, MoveHorizontal, PanelRightClose, ScanSearch, SunMedium, Replace,
} from "lucide-react";

type Tool = "select" | "hand" | "brush" | "text";
type PanelKey = "project" | "tools" | "canvas" | "agent";

function relocatePanel(event: React.DragEvent<HTMLElement>) {
  const panel = event.currentTarget;
  panel.style.left = `${Math.max(8, event.clientX - Math.min(120, panel.offsetWidth / 2))}px`;
  panel.style.top = `${Math.max(8, event.clientY - 22)}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

function useBitmap(src: string) {
  const [image, setImage] = useState<HTMLImageElement>();
  useEffect(() => { const next = new window.Image(); next.src = src; next.onload = () => setImage(next); }, [src]);
  return image;
}

function IconButton({ label, active, children, onClick }: { label: string; active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return <button className={`icon-button ${active ? "is-active" : ""}`} title={label} aria-label={label} onClick={onClick}>{children}<span>{label}</span></button>;
}

function CanvasSurface({ selected, setSelected, generated }: { selected: boolean; setSelected: (v: boolean) => void; generated: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const sourceRef = useRef<Konva.Image>(null);
  const [size, setSize] = useState({ width: 1440, height: 900 });
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const source = useBitmap("/assets/source-orange-dress.png");
  const result = useBitmap("/assets/derived-indigo-dress.png");
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height }); });
    observer.observe(host.current); return () => observer.disconnect();
  }, []);
  useEffect(() => { transformer.current?.nodes(selected && sourceRef.current ? [sourceRef.current] : []); }, [selected]);
  const dots = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    for (let x = 0; x < 2200; x += 24) for (let y = 0; y < 1400; y += 24) nodes.push(<Circle key={`${x}-${y}`} x={x} y={y} radius={1} fill="#d7d5cf" listening={false} />);
    return nodes;
  }, []);
  return <div className="stage-host" ref={host} onClick={() => setSelected(false)}>
    <Stage width={size.width} height={size.height} x={view.x} y={view.y} scaleX={view.scale} scaleY={view.scale}
      draggable onDragEnd={e => setView(v => ({ ...v, x: e.target.x(), y: e.target.y() }))}
      onWheel={e => { e.evt.preventDefault(); const scale = Math.max(.55, Math.min(1.8, view.scale * (e.evt.deltaY > 0 ? .92 : 1.08))); setView(v => ({ ...v, scale })); }}>
      <Layer>{dots}</Layer>
      <Layer>
        <Group x={390} y={120}>
          <Text text="灵感参考 · 01" y={-28} fontSize={13} fill="#77736b" />
          <KonvaImage ref={sourceRef} image={source} width={315} height={420} cornerRadius={16} draggable onClick={e => { e.cancelBubble = true; setSelected(true); }} shadowColor="#40392f" shadowBlur={selected ? 18 : 10} shadowOpacity={.12} />
          <Rect y={360} width={315} height={60} fill="rgba(20,20,18,.78)" cornerRadius={[0,0,16,16]} listening={false} />
          <Text text="橙色廓形连衣裙" x={18} y={379} fontSize={14} fill="white" listening={false} />
        </Group>
        <Group x={770} y={155}>
          <Text text="图片生成器" y={-28} fontSize={13} fill="#77736b" />
          <Rect width={320} height={320} fill="#efeee9" stroke={generated ? "#4f46e5" : "#f36b2b"} strokeWidth={1.5} cornerRadius={14} />
          {generated && <KonvaImage image={result} width={320} height={320} cornerRadius={14} />}
          {!generated && <><ImageIconKonva /><Text text="等待生成" x={124} y={175} fontSize={13} fill="#9b9890" /></>}
        </Group>
        <Transformer ref={transformer} rotateEnabled enabledAnchors={["top-left","top-right","bottom-left","bottom-right"]} borderStroke="#f36b2b" anchorFill="#fff" anchorStroke="#f36b2b" />
      </Layer>
    </Stage>
  </div>;
}

function ImageIconKonva() { return <Group x={148} y={130}><Rect width={24} height={20} cornerRadius={4} stroke="#aaa7a0"/><Circle x={8} y={7} radius={2} fill="#aaa7a0"/></Group>; }

const commonActions = [
  [Maximize2,"高清"], [Crop,"裁剪"], [Expand,"扩图"], [Scissors,"去背景"], [Eraser,"涂改"], [Type,"改字"],
  [Layers3,"拆分"], [ScanSearch,"反推提示词"], [SunMedium,"改光源"], [Shirt,"替换服装"], [Replace,"替换图案"], [WandSparkles,"电商宣传图"],
] as const;

function ImageMenu({ onReference }: { onReference: () => void }) {
  const [tab, setTab] = useState("推荐");
  return <section className="image-menu floating-card" aria-label="图片操作">
    <header><div><strong>已识别：写真 · 服装 · 商品</strong><small>离线识别 · 可命中多种类型</small></div><button><X size={16}/></button></header>
    <nav>{["推荐","基础","全部"].map(x => <button key={x} className={tab===x?"active":""} onClick={()=>setTab(x)}>{x}</button>)}</nav>
    <div className="action-grid">{commonActions.slice(0, tab === "推荐" ? 8 : 12).map(([I,label]) => <button key={label}><I size={17}/><span>{label}</span></button>)}</div>
    <button className="reference-action" onClick={onReference}><MessageCircle size={16}/>添加到 Agent 参考图</button>
  </section>;
}

function ProjectCard({ collapsed, toggle }: { collapsed: boolean; toggle: () => void }) {
  if (collapsed) return <button className="collapsed-tab top" onClick={toggle}><UserRound size={19}/></button>;
  return <section className="project-card floating-card" draggable onDragEnd={relocatePanel}>
    <header><div className="avatar">L</div><div><strong>林然的工作室</strong><small>2026 春夏系列 · 已保存</small></div><button onClick={toggle}><ChevronLeft size={18}/></button></header>
    <div className="project-title"><span>轻盈城市裙装</span><ChevronDown size={15}/></div>
    <div className="project-meta"><span><span className="live-dot"/>仅存于此浏览器</span><span>12 个画布元素</span></div>
  </section>;
}

function ToolRail({ expanded, setExpanded, tool, setTool }: { expanded: boolean; setExpanded:(v:boolean)=>void; tool:Tool; setTool:(v:Tool)=>void }) {
  const items = [["select",MousePointer2,"选择","V"],["hand",Hand,"小手","H"],["brush",Brush,"画笔","B"],["text",Type,"文本","T"]] as const;
  return <aside className={`tool-rail floating-card ${expanded?"expanded":""}`} draggable onDragEnd={relocatePanel}>
    <button className="rail-toggle" onClick={()=>setExpanded(!expanded)}>{expanded?<ChevronLeft/>:<ChevronRight/>}</button>
    <div>{items.map(([key,I,label,shortcut])=><IconButton key={key} label={expanded?`${label}  ${shortcut}`:label} active={tool===key} onClick={()=>setTool(key)}><I/></IconButton>)}</div>
    <hr/>
    <div>{([[Upload,"上传"],[ImagePlus,"生成图片"],[RotateCcw,"历史记录"],[Library,"图库"]] as [LucideIcon,string][]).map(([I,label])=><IconButton key={label} label={label}><I/></IconButton>)}</div>
    {tool==="brush" && <div className="tool-popover floating-card"><strong>画笔</strong><label>粗细 <input type="range" min="1" max="40" defaultValue="8"/></label><label>颜色 <span className="swatches"><i/><i/><i/></span></label></div>}
  </aside>;
}

function CanvasTools() {
  const [layers, setLayers] = useState(false);
  return <div className="canvas-tools"><div className="minimap floating-card"><span className="mini-node a"/><span className="mini-node b"/><span className="mini-view"/></div><div className="canvas-bar floating-card">
    <IconButton label="缩小"><ZoomOut/></IconButton><span className="zoom">72%</span><IconButton label="放大"><ZoomIn/></IconButton><i/>
    <IconButton label="网格吸附" active><Grid3X3/></IconButton><IconButton label="图层" active={layers} onClick={()=>setLayers(!layers)}><Layers3/></IconButton><IconButton label="快捷键"><Frame/></IconButton>
  </div>{layers && <section className="layers-popover floating-card"><header><strong>图层</strong><small>3</small></header><button><Image size={15}/>生成结果</button><button><Image size={15}/>橙色连衣裙</button><button><Frame size={15}/>生成器</button></section>}</div>;
}

function GeneratorForm({ onGenerate, generated }: { onGenerate:()=>void; generated:boolean }) {
  return <section className="generator-form floating-card">
    <header><span><Sparkles size={16}/>图片生成器</span><button><Maximize2 size={16}/></button></header>
    <div className="ref-row"><div className="ref-thumb"><img src="/assets/source-orange-dress.png"/><span>@图1</span></div><button><ImagePlus/><span>添加参考</span></button></div>
    <textarea defaultValue="保留 @图1 的廓形，将面料替换为靛蓝几何提花，生成高级成衣棚拍" aria-label="创作要求" />
    <footer><button className="model"><WandSparkles size={16}/>Creoor Fashion V2<ChevronDown size={14}/></button><button className="ratio">3:4 · 2K<ChevronDown size={14}/></button><button aria-label="语音输入"><Mic size={18}/></button><button aria-label="生成图片" className="send" onClick={onGenerate}>{generated?<RotateCcw/>:<ArrowUp/>}</button></footer>
  </section>;
}

function AgentPanel({ collapsed, toggle, references, generated, onGenerate }: { collapsed:boolean; toggle:()=>void; references:number; generated:boolean; onGenerate:()=>void }) {
  const [sent,setSent]=useState(false); const [clarified,setClarified]=useState(false);
  if(collapsed) return <button className="collapsed-tab right" onClick={toggle}><Sparkles size={19}/><span>Agent</span></button>;
  return <aside className="agent-panel floating-card" draggable onDragEnd={relocatePanel}>
    <header><div><span className="agent-mark"><Sparkles size={17}/></span><div><strong>Creoor Agent</strong><small>服装设计协作助手</small></div></div><button onClick={toggle}><PanelRightClose size={18}/></button></header>
    <nav><button className="active">造型探索</button><button>面料研究</button><button><Plus size={15}/></button></nav>
    <div className="conversation">
      <div className="agent-bubble"><Sparkles size={15}/><p>我看到了橙色廓形连衣裙。你希望下一步从版型、面料还是视觉呈现开始？</p></div>
      {sent && <><div className="user-bubble">让它更适合都市春夏系列</div><div className="agent-bubble"><Sparkles size={15}/><div><p>为了准确执行，我需要确认设计方向：</p><div className="choice-row">{["轻盈通勤","晚宴质感","实验廓形"].map(x=><button className={clarified&&x==="轻盈通勤"?"active":""} onClick={()=>setClarified(true)} key={x}>{x}</button>)}</div></div></div></>}
      {generated && <div className="agent-bubble success"><Sparkles size={15}/><p>已生成靛蓝提花版本并放到画布。你可以继续替换图案、调整光源或保存到图库。</p></div>}
    </div>
    <div className="composer">
      {references>0&&<div className="composer-refs"><div><img src="/assets/source-orange-dress.png"/><span>@图1</span><button><X size={12}/></button></div><small>在提示词中输入 @图1 精准引用</small></div>}
      <textarea placeholder="描述你的设计意图，输入 @ 引用参考图…" defaultValue={sent?"":"让它更适合都市春夏系列"}/>
      <footer><div><button aria-label="上传参考"><Paperclip size={17}/></button><button aria-label="语音输入"><Mic size={17}/></button><button><Sparkles size={17}/><span>技能</span></button></div><button aria-label="发送给 Agent" className="send" onClick={()=>clarified?onGenerate():setSent(true)}><Send size={16}/></button></footer>
    </div>
  </aside>;
}

export function CreoorApp() {
  const [selected,setSelected]=useState(true); const [generated,setGenerated]=useState(false); const [references,setReferences]=useState(0);
  const [collapsed,setCollapsed]=useState<Record<PanelKey,boolean>>({project:false,tools:false,canvas:false,agent:false});
  const [expandedTools,setExpandedTools]=useState(false); const [tool,setTool]=useState<Tool>("select");
  const toggle=(key:PanelKey)=>setCollapsed(v=>({...v,[key]:!v[key]}));
  return <main className="creoor-app" aria-label="Creoor 服装设计工作台" onClick={e=>{if(e.target===e.currentTarget)setSelected(false)}}>
    <CanvasSurface selected={selected} setSelected={setSelected} generated={generated}/>
    <div className="top-center"><span>轻盈城市裙装</span><button>画布 01 <ChevronDown size={14}/></button><button><Redo2 size={16}/></button><button className="share">分享</button></div>
    <ProjectCard collapsed={collapsed.project} toggle={()=>toggle("project")}/>
    {!collapsed.tools&&<ToolRail expanded={expandedTools} setExpanded={setExpandedTools} tool={tool} setTool={setTool}/>} 
    {collapsed.tools&&<button className="collapsed-tab left" onClick={()=>toggle("tools")}><MousePointer2 size={19}/></button>}
    {!collapsed.canvas&&<CanvasTools/>}
    {selected&&<ImageMenu onReference={()=>setReferences(v=>v+1)}/>} 
    <GeneratorForm generated={generated} onGenerate={()=>setGenerated(true)}/>
    <AgentPanel collapsed={collapsed.agent} toggle={()=>toggle("agent")} references={references} generated={generated} onGenerate={()=>setGenerated(true)}/>
  </main>;
}
