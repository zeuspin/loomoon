import type { CanvasNode } from "@loomoon/contracts";
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCloseLine,
  RiDeleteBin6Line,
  RiDragMove2Line,
  RiEyeLine,
  RiEyeOffLine,
  RiImageLine,
  RiLockLine,
  RiLockUnlockLine,
  RiPencilLine,
  RiShapesLine,
  RiSparkling2Line,
  RiText,
} from "@remixicon/react";
import { useState } from "react";
import { layerItemsForNodes } from "./layer-state.js";

export function LayersPanel({
  nodes,
  selection,
  onClose,
  onDelete,
  onMove,
  onRename,
  onSelect,
  onToggleLock,
  onToggleVisibility,
}: {
  nodes: CanvasNode[];
  selection: string[];
  onClose: () => void;
  onDelete: (nodeId: string) => void;
  onMove: (nodeId: string, panelIndex: number) => void;
  onRename: (nodeId: string, name: string) => void;
  onSelect: (nodeId: string, additive: boolean) => void;
  onToggleLock: (nodeId: string) => void;
  onToggleVisibility: (nodeId: string) => void;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [editingName, setEditingName] = useState("");
  const items = layerItemsForNodes(nodes);
  return (
    <aside aria-label="图层面板" className="canvas-layers-panel">
      <header><strong>图层</strong><span>{nodes.length}</span><button aria-label="关闭图层面板" onClick={onClose}><RiCloseLine /></button></header>
      <div className="canvas-layer-list">
        {items.map((node, index) => {
          const name = node.name ?? fallbackName(node, nodes.indexOf(node));
          return (
            <article
              aria-current={selection.includes(node.id) ? "true" : undefined}
              className={selection.includes(node.id) ? "is-selected" : ""}
              draggable
              key={node.id}
              onClick={(event) => onSelect(node.id, event.shiftKey)}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", node.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const draggedId = event.dataTransfer.getData("text/plain");
                if (draggedId) onMove(draggedId, index);
              }}
            >
              <RiDragMove2Line className="canvas-layer-drag" />
              <span className="canvas-layer-preview">{layerIcon(node)}</span>
              {editingId === node.id ? (
                <input
                  aria-label={`重命名 ${name}`}
                  autoFocus
                  onBlur={() => { onRename(node.id, editingName); setEditingId(undefined); }}
                  onChange={(event) => setEditingName(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") setEditingId(undefined);
                  }}
                  value={editingName}
                />
              ) : (
                <button className="canvas-layer-name" onDoubleClick={(event) => { event.stopPropagation(); setEditingId(node.id); setEditingName(name); }}>{name}</button>
              )}
              <div className="canvas-layer-actions">
                <button aria-label={`${node.visible === false ? "显示" : "隐藏"} ${name}`} onClick={(event) => { event.stopPropagation(); onToggleVisibility(node.id); }}>{node.visible === false ? <RiEyeOffLine /> : <RiEyeLine />}</button>
                <button aria-label={`${node.locked ? "解锁" : "锁定"} ${name}`} onClick={(event) => { event.stopPropagation(); onToggleLock(node.id); }}>{node.locked ? <RiLockLine /> : <RiLockUnlockLine />}</button>
                <button aria-label={`上移 ${name}`} disabled={index === 0} onClick={(event) => { event.stopPropagation(); onMove(node.id, index - 1); }}><RiArrowUpSLine /></button>
                <button aria-label={`下移 ${name}`} disabled={index === items.length - 1} onClick={(event) => { event.stopPropagation(); onMove(node.id, index + 1); }}><RiArrowDownSLine /></button>
                <button aria-label={`删除 ${name}`} disabled={node.locked} onClick={(event) => { event.stopPropagation(); onDelete(node.id); }}><RiDeleteBin6Line /></button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function fallbackName(node: CanvasNode, index: number): string {
  const labels: Partial<Record<CanvasNode["type"], string>> = {
    image: "图片",
    text: "文字",
    shape: "形状",
    path: "画笔",
    "image-generator": "图片生成器",
    "video-generator": "视频生成器",
  };
  return `${labels[node.type] ?? "图层"} ${index + 1}`;
}

function layerIcon(node: CanvasNode) {
  if (node.type === "image") return node.assetUrl ? <img alt="" src={node.assetUrl} /> : <RiImageLine />;
  if (node.type === "text") return <RiText />;
  if (node.type === "path") return <RiPencilLine />;
  if (node.type === "shape") return <RiShapesLine />;
  if (node.type === "image-generator" || node.type === "video-generator") return <RiSparkling2Line />;
  return <RiShapesLine />;
}
