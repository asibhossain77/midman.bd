"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Wallet } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatAmount } from "@/lib/i18n/numbers";
import type { EscrowPlatformSettings } from "@/lib/settings";

export interface AdminMethodRow {
  id: string;
  name: string;
  account: string;
  instructions: string | null;
  isActive: boolean;
}

/**
 * Platform settings — escrow economics (fee, limits, verification
 * policy) and the buyer-facing payment channels. Changes are audited.
 */
export function AdminSettings({
  settings,
  methods,
}: {
  settings: EscrowPlatformSettings;
  methods: AdminMethodRow[];
}) {
  const { dict, lang } = useLanguage();
  const st = dict.admin.settings;
  const router = useRouter();
  const { toast } = useToast();

  const [feePercent, setFeePercent] = useState(String(settings.feePercent));
  const [minDeal, setMinDeal] = useState(String(settings.minDealAmount));
  const [maxDeal, setMaxDeal] = useState(String(settings.maxDealAmount));
  const [requireVerified, setRequireVerified] = useState(
    settings.requireVerifiedEmailForDeals
  );
  const [savingSettings, setSavingSettings] = useState(false);

  const [methodsList, setMethodsList] = useState(methods);
  const [newName, setNewName] = useState("");
  const [newAccount, setNewAccount] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [addingMethod, setAddingMethod] = useState(false);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feePercent: Number(feePercent),
          minDealAmount: Number(minDeal),
          maxDealAmount: Number(maxDeal),
          requireVerifiedEmailForDeals: requireVerified,
        }),
      });
      const json = (await res.json()) as { ok?: boolean };
      if (json.ok) {
        toast({ title: st.savedToast });
        router.refresh();
      } else {
        toast({
          title: dict.common.error,
          description: dict.auth.errors.invalid_amount,
          variant: "destructive",
        });
      }
    } finally {
      setSavingSettings(false);
    }
  }

  async function addMethod() {
    setAddingMethod(true);
    try {
      const res = await fetch("/api/admin/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          account: newAccount,
          instructions: newInstructions,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        item?: AdminMethodRow;
      };
      if (json.ok && json.item) {
        setMethodsList((prev) => [...prev, json.item!]);
        setNewName("");
        setNewAccount("");
        setNewInstructions("");
        router.refresh();
      }
    } finally {
      setAddingMethod(false);
    }
  }

  async function toggleMethod(id: string, isActive: boolean) {
    await fetch(`/api/admin/payment-methods/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    setMethodsList((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isActive } : m))
    );
    router.refresh();
  }

  async function deleteMethod(id: string) {
    await fetch(`/api/admin/payment-methods/${id}`, { method: "DELETE" });
    setMethodsList((prev) => prev.filter((m) => m.id !== id));
    router.refresh();
  }

  return (
    <Container className="max-w-4xl py-8 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {st.title}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{st.subtitle}</p>

      {/* Economics */}
      <Card className="mt-6 py-0">
        <CardContent className="px-5 py-5 sm:px-6">
          <form onSubmit={saveSettings} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="fee">{st.feePercent}</Label>
                <Input
                  id="fee"
                  inputMode="numeric"
                  value={feePercent}
                  onChange={(e) => setFeePercent(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{st.feeHint}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min">{st.minDeal}</Label>
                <Input
                  id="min"
                  inputMode="numeric"
                  value={minDeal}
                  onChange={(e) => setMinDeal(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max">{st.maxDeal}</Label>
                <Input
                  id="max"
                  inputMode="numeric"
                  value={maxDeal}
                  onChange={(e) => setMaxDeal(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
              <div className="pr-4">
                <p className="text-sm font-medium text-foreground">
                  {st.requireVerified}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {dict.auth.unverifiedBanner}
                </p>
              </div>
              <Switch
                checked={requireVerified}
                onCheckedChange={setRequireVerified}
                aria-label={st.requireVerified}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {dict.common.fee} {formatAmount(0, lang).replace("0", "")}
                {Number(feePercent) > 0
                  ? `${dict.common.fee}: ${feePercent}%`
                  : ""}
              </span>
            </div>

            <Button type="submit" disabled={savingSettings}>
              {savingSettings && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {dict.common.save}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Payment channels */}
      <Card className="mt-5 py-0">
        <CardContent className="px-5 py-5 sm:px-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Wallet className="size-4 text-primary-text" aria-hidden="true" />
            {st.methodsTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{st.methodsDesc}</p>

          {methodsList.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed bg-background px-4 py-6 text-center text-sm text-muted-foreground">
              {st.noMethods}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {methodsList.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border bg-background px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{m.name}</p>
                    <p className="font-mono text-xs text-primary-text">{m.account}</p>
                    {m.instructions && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {m.instructions}
                      </p>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    {st.methodActive}
                    <Switch
                      checked={m.isActive}
                      onCheckedChange={(v) => toggleMethod(m.id, v)}
                      aria-label={`${st.methodActive}: ${m.name}`}
                    />
                  </label>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteMethod(m.id)}
                    aria-label={`${st.deleteMethod}: ${m.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Add form */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">{st.methodName}</Label>
              <Input
                id="m-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="bKash / Nagad / Bank — …"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-account">{st.methodAccount}</Label>
              <Input
                id="m-account"
                value={newAccount}
                onChange={(e) => setNewAccount(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="m-instructions">{st.methodInstructions}</Label>
              <Textarea
                id="m-instructions"
                rows={2}
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
              />
            </div>
            <div>
              <Button
                onClick={addMethod}
                disabled={addingMethod || !newName.trim() || !newAccount.trim()}
              >
                {addingMethod ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                {st.addMethod}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
