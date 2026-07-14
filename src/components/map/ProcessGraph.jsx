import React, { useMemo, useRef, useState, useEffect } from "react";

// Node type visual config
const TYPE_STYLE = {
  theme: { color: "#326ea0", label: "Тема" },
  signal: { color: "#c89632", label: "Сигнал" },
  tag: { color: "#46825f", label: "Тег инсайта" },
  term: { color: "#6e50a0", label: "Термин" },
};

const WIDTH = 900;
const HEIGHT = 640;

// Simple deterministic radial layout: distribute nodes on concentric rings by type,
// then run a few relaxation iterations to spread co-occurring nodes apart.
function computeLayout(nodes, edges) {
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const n = nodes.length;
  if (n === 0) return {};

  const pos = {};
  nodes.forEach((node, i) => {
    const angle = (i / n) * Math.PI * 2;
    const radius = 120 + (i % 5) * 45;
    pos[node.id] = {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });

  // Light force relaxation: attract connected nodes, repel all pairs.
  const adj = new Map();
  edges.forEach((e) => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source).push({ id: e.target, w: e.weight });
    adj.get(e.target).push({ id: e.source, w: e.weight });
  });

  for (let iter = 0; iter < 120; iter++) {
    const disp = {};
    nodes.forEach((a) => (disp[a.id] = { x: 0, y: 0 }));

    // Repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = pos[a.id].x - pos[b.id].x;
        let dy = pos[a.id].y - pos[b.id].y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const rep = 5200 / (dist * dist);
        dx /= dist; dy /= dist;
        disp[a.id].x += dx * rep; disp[a.id].y += dy * rep;
        disp[b.id].x -= dx * rep; disp[b.id].y -= dy * rep;
      }
    }
    // Attraction along edges
    edges.forEach((e) => {
      const a = pos[e.source], b = pos[e.target];
      if (!a || !b) return;
      let dx = a.x - b.x, dy = a.y - b.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const attr = (dist * dist) / 9000 * (1 + e.weight * 0.3);
      dx /= dist; dy /= dist;
      disp[e.source].x -= dx * attr; disp[e.source].y -= dy * attr;
      disp[e.target].x += dx * attr; disp[e.target].y += dy * attr;
    });

    const damping = 0.85;
    nodes.forEach((a) => {
      pos[a.id].x += Math.max(-15, Math.min(15, disp[a.id].x * damping));
      pos[a.id].y += Math.max(-15, Math.min(15, disp[a.id].y * damping));
      // keep inside bounds
      pos[a.id].x = Math.max(40, Math.min(WIDTH - 40, pos[a.id].x));
      pos[a.id].y = Math.max(40, Math.min(HEIGHT - 40, pos[a.id].y));
    });
  }

  return pos;
}

export default function ProcessGraph({ nodes, edges }) {
  const [hoverId, setHoverId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTypes, setActiveTypes] = useState(new Set(Object.keys(TYPE_STYLE)));

  const visibleNodes = useMemo(
    () => nodes.filter((nd) => activeTypes.has(nd.type)),
    [nodes, activeTypes]
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [edges, visibleIds]
  );

  const pos = useMemo(() => computeLayout(visibleNodes, visibleEdges), [visibleNodes, visibleEdges]);

  const maxCount = useMemo(
    () => Math.max(1, ...visibleNodes.map((n) => n.count || 1)),
    [visibleNodes]
  );
  const maxWeight = useMemo(
    () => Math.max(1, ...visibleEdges.map((e) => e.weight || 1)),
    [visibleEdges]
  );

  const toggleType = (type) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Focus node: selected takes priority, otherwise hovered
  const focusId = selectedId || hoverId;

  // Connected node ids for highlight
  const connectedIds = useMemo(() => {
    if (!focusId) return null;
    const ids = new Set([focusId]);
    visibleEdges.forEach((e) => {
      if (e.source === focusId) ids.add(e.target);
      if (e.target === focusId) ids.add(e.source);
    });
    return ids;
  }, [focusId, visibleEdges]);

  // Details for the selected node
  const selectedNode = useMemo(
    () => visibleNodes.find((nd) => nd.id === selectedId) || null,
    [visibleNodes, selectedId]
  );
  const selectedConnections = useMemo(() => {
    if (!selectedId) return [];
    const byId = new Map(nodes.map((nd) => [nd.id, nd]));
    return visibleEdges
      .filter((e) => e.source === selectedId || e.target === selectedId)
      .map((e) => {
        const otherId = e.source === selectedId ? e.target : e.source;
        return { node: byId.get(otherId), weight: e.weight };
      })
      .filter((c) => c.node)
      .sort((a, b) => b.weight - a.weight);
  }, [selectedId, visibleEdges, nodes]);

  return (
    <div className="space-y-4">
      {/* Legend / filters */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_STYLE).map(([type, cfg]) => {
          const on = activeTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                on ? "bg-card border-border" : "bg-muted/50 border-transparent opacity-50"
              }`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color }} />
              {cfg.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto"
          style={{ maxHeight: "70vh" }}
        >
          {/* Edges */}
          {visibleEdges.map((e, i) => {
            const a = pos[e.source], b = pos[e.target];
            if (!a || !b) return null;
            const highlighted = connectedIds
              ? connectedIds.has(e.source) && connectedIds.has(e.target)
              : true;
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={highlighted ? "#9ca3af" : "#e5e7eb"}
                strokeWidth={0.6 + (e.weight / maxWeight) * 3}
                strokeOpacity={connectedIds && !highlighted ? 0.1 : 0.5}
              />
            );
          })}

          {/* Nodes */}
          {visibleNodes.map((nd) => {
            const p = pos[nd.id];
            if (!p) return null;
            const cfg = TYPE_STYLE[nd.type] || { color: "#888" };
            const r = 8 + ((nd.count || 1) / maxCount) * 14;
            const dim = connectedIds && !connectedIds.has(nd.id);
            return (
              <g
                key={nd.id}
                transform={`translate(${p.x}, ${p.y})`}
                onMouseEnter={() => setHoverId(nd.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{ cursor: "pointer", opacity: dim ? 0.25 : 1 }}
              >
                <circle r={r} fill={cfg.color} fillOpacity={0.85} stroke="#fff" strokeWidth={2} />
                {(hoverId === nd.id || (connectedIds && connectedIds.has(nd.id)) || nd.count >= 2) && (
                  <text
                    y={-r - 5}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#1a1a1a"
                    style={{ pointerEvents: "none", fontWeight: hoverId === nd.id ? 600 : 400 }}
                  >
                    {nd.label.length > 34 ? nd.label.slice(0, 34) + "…" : nd.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}