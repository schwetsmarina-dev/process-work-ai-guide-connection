import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import KeyObservations from "./KeyObservations";

const render = (memories, lang = "ru", error = false) => renderToStaticMarkup(<KeyObservations memories={memories} lang={lang} error={error} />);
describe("key observations displayed from UserMemory", () => {
  it("renders canonical content rather than ten empty insight badges", () => {
    const rows = Array.from({length:10}, (_,index) => ({ id:String(index),memory_type:"insight",memory_key:"insights",memory_value:"Сохранённое наблюдение номер " + index }));
    const html=render(rows);
    for(const row of rows) expect(html).toContain(row.memory_value);
    expect(html.match(/<li /g)).toHaveLength(10);
    expect(html).toContain("Осознание");
    expect(html).not.toMatch(/>insight</i);
  });
  it("renders Spanish categories and preserves the person's Spanish content", () => {
    const html=render([{id:"es",memory_type:"edge",memory_key:"edge",memory_value:"Me cuesta decir que no."}], "es");
    expect(html).toContain("Observaciones clave");
    expect(html).toContain("Borde");
    expect(html).toContain("Me cuesta decir que no.");
    expect(html).not.toMatch(/[А-Яа-яЁё]/u);
  });
  it("keeps user corrections and does not resurrect the original or legacy wording", () => {
    const html=render([{id:"edited",memory_type:"insight",memory_value:"Моя исправленная формулировка",original_value:"Отвергнутая версия",value:"Старая версия",user_status:"corrected"}]);
    expect(html).toContain("Моя исправленная формулировка");
    expect(html).toContain("Исправлено тобой");
    expect(html).not.toContain("Отвергнутая версия");
    expect(html).not.toContain("Старая версия");
  });
  it("filters empty, inactive and rejected entries before taking the ten-item limit", () => {
    const rows=[
      ...Array.from({length:10},(_,i)=>({id:"empty"+i,memory_value:"  "})),
      {id:"inactive",memory_value:"Неактивная запись",is_active:false},
      {id:"rejected",memory_value:"Отклонённая запись",user_status:"rejected"},
      {id:"valid",memory_value:"Настоящее наблюдение"},
      {id:"cleared",memory_value:"",value:"Не восстанавливать"},
    ];
    const html=render(rows);
    expect(html.match(/<li /g)).toHaveLength(1);
    expect(html).toContain("Настоящее наблюдение");
    for(const text of ["Неактивная запись","Отклонённая запись","Не восстанавливать"]) expect(html).not.toContain(text);
  });
  it("keeps a record excluded only from AI visible and labels it", () => {
    const html=render([{id:"private",memory_value:"Личная запись",excluded_from_ai:true}]);
    expect(html).toContain("Личная запись");
    expect(html).toContain("Не используется ИИ");
  });
  it("supports legacy content without exposing unknown internal keys", () => {
    const html=render([{id:"legacy",category:"internal_topic_77",key:"internal_key",value:"Старое сохранённое наблюдение"}]);
    expect(html).toContain("Старое сохранённое наблюдение");
    expect(html).toContain("Наблюдение");
    expect(html).not.toContain("internal_topic_77");
    expect(html).not.toContain("internal_key");
  });
  it.each(["ru","es"])("distinguishes an empty list from a load error in %s", lang => {
    const empty=render([],lang), error=render([],lang,true);
    expect(empty).not.toContain("<li ");
    expect(error).toContain('role="alert"');
    expect(empty).not.toBe(error);
    expect(empty).toContain(lang==="ru"?"Пока нет сохранённых наблюдений.":"Todavía no hay observaciones guardadas.");
  });
  it("escapes saved content as text", () => {
    const html=render([{id:"safe",memory_value:"<script>alert(1)</script>",memory_type:"constructor"}]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
