import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { createMessage } from "@/lib/messageApi";

export default function RlsDiagnostic({ session }) {
  const [authInfo, setAuthInfo] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setAuthInfo({
        email: u?.email || "UNDEFINED",
        id: u?.id || "UNDEFINED",
        role: u?.role || "UNDEFINED",
        authenticated: !!u,
      });
    }).catch((e) => {
      setAuthInfo({ error: e?.message, authenticated: false });
    });
  }, []);

  const handleTestCreate = async () => {
    setTesting(true);
    setTestResult(null);

    console.log("[RLS_DIAG] Invoking createSessionMessage backend function for session:", session?.id);

    try {
      const result = await createMessage({
        session_id: session?.id,
        role: "assistant",
        content: "RLS diagnostic test — safe to delete",
      });

      console.log("[RLS_DIAG] SUCCESS:", result);
      setTestResult({ success: true, result });

      // Clean up test record
      if (result?.id) {
        base44.entities.Message.delete(result.id).catch(() => {});
      }
    } catch (e) {
      const raw = {
        message: e?.message || String(e),
        status: e?.response?.status ?? e?.status ?? "?",
        code: e?.response?.data?.code ?? e?.code ?? "?",
        detail: e?.response?.data?.detail ?? e?.response?.data?.message ?? "?",
        responseData: e?.response?.data ? JSON.stringify(e.response.data) : "?",
      };
      console.error("[RLS_DIAG] FAILED:", raw);
      setTestResult({ success: false, error: raw });
    }

    setTesting(false);
  };

  return (
    <div className="mt-3 p-3 rounded-lg border border-violet-200 bg-violet-50 space-y-3 text-xs font-mono">
      {/* Build marker */}
      <div className="font-semibold text-violet-800">
        🔬 RLS Runtime Diagnostics
        <span className="ml-2 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 text-xs">
          RLS DIAG BUILD: backend function test active
        </span>
      </div>

      {/* Auth state */}
      <div className="space-y-0.5">
        <div className="text-violet-700 font-semibold">Auth state:</div>
        {authInfo ? (
          <>
            <div>authenticated: <span className={authInfo.authenticated ? "text-green-700" : "text-red-700"}>{String(authInfo.authenticated)}</span></div>
            <div>email: {authInfo.email}</div>
            <div>id: {authInfo.id}</div>
            <div>role: {authInfo.role}</div>
            {authInfo.error && <div className="text-red-700">auth error: {authInfo.error}</div>}
          </>
        ) : (
          <div className="text-muted-foreground">loading…</div>
        )}
      </div>

      {/* Session state */}
      <div className="space-y-0.5">
        <div className="text-violet-700 font-semibold">Session context:</div>
        <div>session.id: {session?.id || "UNDEFINED"}</div>
        <div>session.mode_id: {session?.mode_id || "?"}</div>
        <div>session.created_by: {session?.created_by || "?"}</div>
      </div>

      {/* Test button */}
      <Button
        size="sm"
        variant="outline"
        className="border-violet-300 text-violet-800 hover:bg-violet-100"
        disabled={testing || !session?.id}
        onClick={handleTestCreate}
      >
        {testing ? "Testing…" : "▶ Test createSessionMessage backend function"}
      </Button>

      {/* Result */}
      {testResult && (
        <div className={`rounded-lg px-3 py-2 border space-y-1 ${testResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {testResult.success ? (
            <>
              <div className="font-semibold">✅ createSessionMessage SUCCEEDED</div>
              <div>backend function invoked: <span className="font-bold">true</span></div>
              <div>function name: <span className="font-bold">createSessionMessage</span></div>
              <div>result message id: {testResult.result?.id || "(none)"}</div>
              <div className="break-all">raw response: {JSON.stringify(testResult.result)}</div>
            </>
          ) : (
            <>
              <div className="font-semibold">❌ createSessionMessage FAILED</div>
              <div>backend function invoked: <span className="font-bold">true</span></div>
              <div>function name: <span className="font-bold">createSessionMessage</span></div>
              <div>status: {testResult.error.status}</div>
              <div>code: {testResult.error.code}</div>
              <div>detail: {testResult.error.detail}</div>
              <div>message: {testResult.error.message}</div>
              <div className="break-all">raw error: {testResult.error.responseData}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}