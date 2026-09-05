"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ShieldWarning,
} from "@phosphor-icons/react";
import { triggerHaptic } from "@/lib/haptics";
import { DebtTypeSelector } from "@/components/debts/DebtTypeSelector";
import { InstitutionSelector, Institution } from "@/components/debts/InstitutionSelector";
import { LoanForm } from "@/components/debts/forms/LoanForm";
import { CreditCardForm } from "@/components/debts/forms/CreditCardForm";
import { OverdraftForm } from "@/components/debts/forms/OverdraftForm";
import { GoldDebtForm } from "@/components/debts/forms/GoldDebtForm";
import { PersonalDebtForm } from "@/components/debts/forms/PersonalDebtForm";
import { PromissoryForm } from "@/components/debts/forms/PromissoryForm";
import { RecurringForm } from "@/components/debts/forms/RecurringForm";
import { OtherDebtForm } from "@/components/debts/forms/OtherDebtForm";
import { DebtSchedulePreview } from "@/components/debts/DebtSchedulePreview";

const STEPS = [
  { id: 1, title: "Borç Türü", desc: "Kredi, Kart, Altın..." },
  { id: 2, title: "Kurum / Muhatap", desc: "Banka veya Kişi" },
  { id: 3, title: "Detaylar", desc: "Tutar, Faiz, Vade" },
  { id: 4, title: "Önizleme & Onay", desc: "Plan ve Kayıt" },
];

export default function NewDebtPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedType, setSelectedType] = useState("TAKSITLI_KREDI");
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);

  const [formData, setFormData] = useState<any>({});
  const [isFormValid, setIsFormValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleNextStep = () => {
    triggerHaptic("selection");
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevStep = () => {
    triggerHaptic("selection");
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleFormChange = (data: any, isValid: boolean) => {
    setFormData(data);
    setIsFormValid(isValid);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        type: selectedType,
        institutionId: selectedInstitution?.id || undefined,
        currency: formData.currency || "TRY",
        startDate: formData.startDate || new Date().toISOString(),
        ...formData,
      };

      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Borç kaydedilemedi");
      }

      const created = await res.json();
      triggerHaptic("success");
      router.push(`/debts/${created.id}`);
    } catch (err: any) {
      triggerHaptic("error");
      setErrorMsg(err.message || "Bir hata oluştu");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/debts"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Yeni Borç Ekle</h1>
          <p className="text-xs text-zinc-400">Koşullu form ve amortisman sihirbazı</p>
        </div>
      </div>

      {/* 4-Step Progress Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 shadow-sm">
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const isDone = currentStep > s.id;
            const isCurrent = currentStep === s.id;

            return (
              <div key={s.id} className="flex flex-col items-center text-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isDone
                      ? "bg-emerald-500 text-zinc-950"
                      : isCurrent
                      ? "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {isDone ? <Check size={16} weight="bold" /> : s.id}
                </div>
                <span
                  className={`text-[11px] font-semibold mt-1.5 hidden sm:block ${
                    isCurrent ? "text-white" : isDone ? "text-emerald-400" : "text-zinc-500"
                  }`}
                >
                  {s.title}
                </span>
                <span className="text-[9px] text-zinc-500 hidden sm:block truncate max-w-full">
                  {s.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          <ShieldWarning size={18} weight="fill" className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step Contents */}
      <div className="p-6 rounded-2xl bg-zinc-950/60 border border-white/10 glass-card">
        {/* Step 1: Type */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <DebtTypeSelector
              selectedType={selectedType}
              onSelect={(type) => {
                setSelectedType(type);
              }}
            />

            <div className="flex justify-end pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={handleNextStep}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md transition-colors"
              >
                <span>Devam Et: Kurum Seçimi</span>
                <ArrowRight size={16} weight="bold" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Institution */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <InstitutionSelector
              selectedId={selectedInstitution?.id}
              debtType={selectedType}
              onSelect={(inst) => setSelectedInstitution(inst)}
            />

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Geri
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md transition-colors"
              >
                <span>Devam Et: Borç Detayları</span>
                <ArrowRight size={16} weight="bold" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Conditional Details Form */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                3. {selectedType.replace(/_/g, " ")} Detayları
              </span>
              <p className="text-xs text-zinc-500 mt-0.5">
                {selectedInstitution ? `${selectedInstitution.name} bünyesinde` : "Bağımsız kayıt"}
              </p>
            </div>

            {selectedType === "TAKSITLI_KREDI" && (
              <LoanForm
                initialData={formData}
                institutionName={selectedInstitution?.name}
                onChange={handleFormChange}
              />
            )}

            {selectedType === "KREDI_KARTI" && (
              <CreditCardForm
                initialData={formData}
                institutionName={selectedInstitution?.name}
                onChange={handleFormChange}
              />
            )}

            {selectedType === "EK_HESAP_KMH" && (
              <OverdraftForm
                initialData={formData}
                institutionName={selectedInstitution?.name}
                onChange={handleFormChange}
              />
            )}

            {selectedType === "ALTIN_BORCU" && (
              <GoldDebtForm initialData={formData} onChange={handleFormChange} />
            )}

            {selectedType === "KISI_BORCU" && (
              <PersonalDebtForm initialData={formData} onChange={handleFormChange} />
            )}

            {selectedType === "SENET_CEK" && (
              <PromissoryForm initialData={formData} onChange={handleFormChange} />
            )}

            {selectedType === "DUZENLI_ODEME" && (
              <RecurringForm
                initialData={formData}
                institutionName={selectedInstitution?.name}
                onChange={handleFormChange}
              />
            )}

            {selectedType === "DIGER" && (
              <OtherDebtForm
                initialData={formData}
                institutionName={selectedInstitution?.name}
                onChange={handleFormChange}
              />
            )}

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Geri
              </button>
              <button
                type="button"
                disabled={!isFormValid}
                onClick={handleNextStep}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Önizleme & Onaya Git</span>
                <ArrowRight size={16} weight="bold" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Preview & Confirm */}
        {currentStep === 4 && (
          <DebtSchedulePreview
            debtType={selectedType}
            institution={selectedInstitution}
            formData={formData}
            onConfirm={handleSubmit}
            onBack={handlePrevStep}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
