import React, { useState } from "react";
import { t, getStoredLanguage } from "@/lib/i18n";
import "./ProcessGraph.css";

const COPY = {
  ru: {
    figure: "Краевая фигура", primary: "Первичный процесс", secondary: "Вторичный процесс", edge: "Содержание края",
    figureEmpty: "Отдельные данные о фигуре пока не сохранены.",
    empty: "В этой области пока нет сохранённых наблюдений.",
    hint: "Выбери область схемы — ниже откроются полные тексты наблюдений.",
    scope: "Карта объединяет материал разных сессий. Соседство на схеме не означает, что все записи относятся к одному процессу.",
    observations: "Наблюдений", mentions: "Упоминаний", connections: "Встречались в одной сессии",
    noConnections: "Связанные записи не найдены.", details: "Связанные записи", additional: "Другой материал карты",
    other: "Другие наблюдения", selected: "Выбранная область", figureNote: "Здесь появится фигура, сохранённая отдельно. Содержание края остаётся в центре схемы.",
  },
  es: {
    figure: "Figura del borde", primary: "Proceso primario", secondary: "Proceso secundario", edge: "Contenido del borde",
    figureEmpty: "Aún no hay datos guardados por separado sobre la figura.",
    empty: "Aún no hay observaciones guardadas en esta área.",
    hint: "Elige un área del esquema para leer las observaciones completas debajo.",
    scope: "El mapa reúne material de distintas sesiones. La proximidad en el esquema no significa que todas las observaciones pertenezcan al mismo proceso.",
    observations: "Observaciones", mentions: "Menciones", connections: "Aparecieron en la misma sesión",
    noConnections: "No se encontraron observaciones relacionadas.", details: "Observaciones relacionadas", additional: "Otro material del mapa",
    other: "Otras observaciones", selected: "Área seleccionada", figureNote: "Aquí aparecerá la figura cuando se guarde por separado. El contenido del borde permanece en el centro del esquema.",
  },
};
const OTHER_TYPES = { theme: "node_theme", signal: "node_signal", tag: "node_tag", term: "node_term", risk: "node_risk" };
const MAIN_TYPES = new Set(["primary", "secondary", "edge", "edge_figure"]);

function FigureSymbol() {
  return (
    <svg viewBox="0 0 64 84" className="process-map-person" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="32" cy="15" rx="9" ry="12" />
      <path d="M32 28v27 M32 34L13 48 M32 34l19 14 M32 55L18 77 M32 55l14 22" />
    </svg>
  );
}

function ObservationList({ items, allNodes, edges, copy }) {
  if (!items.length) return <p className="process-map-empty">{copy.empty}</p>;
  const byId = new Map(allNodes.map(node => [node.id, node]));
  return (
    <ul className="process-map-observations">
      {items.map(node => {
        const related = edges.filter(edge => edge.source === node.id || edge.target === node.id)
          .map(edge => ({ node: byId.get(edge.source === node.id ? edge.target : edge.source), weight: edge.weight }))
          .filter(item => item.node)
          .sort((a, b) => (b.weight || 0) - (a.weight || 0));
        return (
          <li key={node.id} className="process-map-observation">
            <p className="process-map-text">{node.label}</p>
            {node.count > 1 && <p className="process-map-meta">{copy.mentions}: {node.count}</p>}
            <details className="process-map-related">
              <summary>{copy.details} ({related.length})</summary>
              {related.length ? <><p className="process-map-meta">{copy.connections}</p><ul>{related.map(item => <li key={item.node.id}>{item.node.label}</li>)}</ul></> : <p className="process-map-meta">{copy.noConnections}</p>}
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export default function ProcessGraph({ nodes = [], edges = [], lang: requestedLanguage }) {
  const lang = requestedLanguage || getStoredLanguage();
  const copy = COPY[lang] || COPY.es;
  const [selected, setSelected] = useState("primary");
  const cleanNodes = nodes.filter(node => node && typeof node.label === "string" && node.label.trim());
  const groups = {
    primary: cleanNodes.filter(node => node.type === "primary"),
    secondary: cleanNodes.filter(node => node.type === "secondary"),
    edge: cleanNodes.filter(node => node.type === "edge"),
    figure: cleanNodes.filter(node => node.type === "edge_figure"),
  };
  const otherGroups = Object.entries(OTHER_TYPES).map(([type, key]) => ({ type, label: t(key, lang), items: cleanNodes.filter(node => node.type === type) }));
  const unknown = cleanNodes.filter(node => !MAIN_TYPES.has(node.type) && !Object.hasOwn(OTHER_TYPES, node.type));
  if (unknown.length) otherGroups.push({ type: "other", label: copy.other, items: unknown });

  const zone = (key, numeral) => (
    <button type="button" className={"process-map-zone process-map-zone-" + key} aria-pressed={selected === key} onClick={() => setSelected(key)}>
      {numeral && <span className="process-map-numeral" aria-hidden="true">{numeral}</span>}
      <span className="process-map-zone-title">{copy[key]}</span>
      <span className="process-map-zone-count">{copy.observations}: {groups[key].length}</span>
    </button>
  );

  return (
    <div className="process-map" data-testid="process-map-triangle">
      <p className="process-map-hint">{copy.hint}</p>
      <div className="process-map-sketch">
        <svg className="process-map-mountain" viewBox="0 0 1000 470" preserveAspectRatio="none" aria-hidden="true">
          <path d="M45 450 L500 170 L955 450" fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <button type="button" className="process-map-figure" aria-pressed={selected === "figure"} onClick={() => setSelected("figure")}>
          <span className="process-map-zone-title">{copy.figure}</span>
          <FigureSymbol />
          <span className="process-map-figure-status">{groups.figure.length ? copy.observations + ": " + groups.figure.length : copy.figureEmpty}</span>
        </button>
        {zone("primary", "I")}
        {zone("secondary", "II")}
        {zone("edge")}
      </div>
      <section className={"process-map-panel process-map-panel-" + selected} aria-label={copy.selected} aria-live="polite">
        <div className="process-map-panel-heading"><h2>{copy[selected]}</h2><span>{groups[selected].length}</span></div>
        {selected === "figure" && !groups.figure.length ? <p className="process-map-empty">{copy.figureNote}</p> : <ObservationList items={groups[selected]} allNodes={cleanNodes} edges={edges} copy={copy} />}
      </section>
      <p className="process-map-scope">{copy.scope}</p>
      {otherGroups.some(group => group.items.length) && (
        <section className="process-map-other">
          <h2>{copy.additional}</h2>
          {otherGroups.filter(group => group.items.length).map(group => (
            <details key={group.type} className="process-map-other-group" open={group.type === "risk" ? true : undefined}>
              <summary>{group.label} <span>{group.items.length}</span></summary>
              <ObservationList items={group.items} allNodes={cleanNodes} edges={edges} copy={copy} />
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
