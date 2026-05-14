import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function RlsDiagnostic({ session }) {
  const [authInfo, setAuthInfo] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // Load auth state immediately on mount
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

    const payload = {
      session_id: session?.id || "MISSING",
      role: "assistant",
      content: "RLS diagnostic test — safe to delete",
      created_at: new Date().toISOString(),
    };

    console.log("[RLS_DIAG] Attempting Message.create with payload:", payload);
    console.log("[RLS_DIAG] Auth state:", authInfo);

    try {
      const result = await base44.entities.Message.create(payload);
      console.log("[RLS_DIAG] SUCCESS:", result);
      setTestResult({
        success: true,
        id: result?.id,
        created_by: result?.created_by,
        payload,
      });
      // Clean up test record
      if (result?.id) {
        base44.entities.Message.delete(result.id).catch(() => {});
      }
    } catch (e) {
      // Extract every possible field from the error object
      const raw = {
        message: e?.message || String(e),
        status: e?.response?.status ?? e?.status ?? "?",
        statusText: e?.response?.statusText ?? "?",
        code: e?.response?.data?.code ?? e?.code ?? "?",
        detail: e?.response?.data?.detail ?? e?.response?.data?.message ?? "?",
        responseData: e?.response?.data ? JSON.stringify(e.response.data) : "?",
        stack: e?.stack?.split("\n").slice(0, 4).join(" | ") ?? "?",
      };
      console.error("[RLS_DIAG] FAILED:", raw);
      setTestResult({ success: false, error: raw, payload });
    }

    setTesting(false);
  };

  return (
    <div className="mt-3 p-3 rounded-lg border border-violet-200 bg-violet-50 space-y-3 text-xs font-mono">
      <div className="font-semibold text-violet-800">🔬 RLS Runtime Diagnostics</div>

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
        {testing ? "Testing…" : "▶ Test Message.create directly"}
      </Button>

      {/* Result */}
      {testResult && (
        <div className={`rounded-lg px-3 py-2 border space-y-1 ${testResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {testResult.success ? (
            <>
              <div className="font-semibold">✅ Message.create SUCCEEDED</div>
              <div>created id: {testResult.id}</div>
              <div>created_by: {testResult.created_by}</div>
            </>
          ) : (
            <>
              <div className="font-semibold">❌ Message.create FAILED</div>
              <div>status: {testResult.error.status}</div>
              <div>statusText: {testResult.error.statusText}</div>
              <div>code: {testResult.error.code}</div>
              <div>message: {testResult.error.message}</div>
              <div>detail: {testResult.error.detail}</div>
              <div>responseData: {testResult.error.responseData}</div>
              <div className="text-xs opacity-70 break-all">stack: {testResult.error.stack}</div>
            </>
          )}
          <div className="opacity-60 text-xs pt-1">
            payload: {JSON.stringify(testResult.payload)}
          </div>
        </div>
      )}
    </div>
  );
}