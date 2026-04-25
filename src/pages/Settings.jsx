import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Shield, User } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <h1 className="font-serif text-3xl font-semibold mb-2">Настройки</h1>
      <p className="text-muted-foreground mb-8">Управление профилем</p>

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Профиль</h3>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Имя</Label>
              <p className="text-sm font-medium mt-1">{user?.full_name || "—"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium mt-1">{user?.email || "—"}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Конфиденциальность</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ваши данные хранятся в защищённой базе данных. Сессии и сообщения
            доступны только вам. Этот инструмент не заменяет профессиональную
            психологическую помощь.
          </p>
        </Card>

        <Card className="p-6 border-destructive/20">
          <h3 className="font-semibold text-sm mb-2">Выход</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Вы будете перенаправлены на страницу входа
          </p>
          <Button
            variant="outline"
            onClick={() => base44.auth.logout("/")}
            className="text-destructive border-destructive/30 hover:bg-destructive/5"
          >
            Выйти из аккаунта
          </Button>
        </Card>
      </div>
    </div>
  );
}