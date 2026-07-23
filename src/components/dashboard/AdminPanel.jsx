import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldCheck, MessageSquare, ShieldAlert, Upload } from "lucide-react";

export default function AdminPanel() {
  return (
    <div className="mb-8 p-5 rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="font-serif text-lg font-semibold">Admin panel</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/feedback"><MessageSquare className="w-4 h-4 mr-1.5" />Beta feedback</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/status"><ShieldAlert className="w-4 h-4 mr-1.5" />Data status</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/import"><Upload className="w-4 h-4 mr-1.5" />Data import</Link>
        </Button>
      </div>
    </div>
  );
}