import React, { useState, useRef } from 'react';
import { Company } from '@/packages/types/src/database.ts';
import { ALL_SWISS_CANTONS } from '@/packages/types/src/swiss.ts';
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  Trash2,
  Check,
  Plus,
  X,
  ArrowRight,
  MapPin,
  User,
} from 'lucide-react';

interface ExtractedCard {
  tempId: string;
  name: string;
  contact_person?: string;
  email: string;
  verified_email: boolean;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  canton: string;
  domain?: string;
  industry: 'civil_engineering' | 'tiefbau' | 'demolition' | 'quarry';
  language: 'fr' | 'de' | 'it';
  notes?: string;
  confidence: number;
  selected: boolean;
  saved?: boolean;
}

interface BusinessCardScannerScreenProps {
  onRefreshCompanies: () => Promise<void>;
  onNavigateToTargets: () => void;
  existingCompanies: Company[];
}

export const BusinessCardScannerScreen: React.FC<BusinessCardScannerScreenProps> = ({
  onRefreshCompanies,
  onNavigateToTargets,
  existingCompanies,
}) => {
  const [selectedImages, setSelectedImages] = useState<
    Array<{ id: string; base64: string; name: string; preview: string }>
  >([]);
  const [extractedCards, setExtractedCards] = useState<ExtractedCard[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        showToast('Choisissez seulement des images.', true);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const resultStr = reader.result as string;
        setSelectedImages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            base64: resultStr,
            name: file.name,
            preview: resultStr,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (id: string) => {
    setSelectedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const clearAllImages = () => {
    setSelectedImages([]);
    setExtractedCards([]);
  };

  const handleScanCards = async () => {
    if (selectedImages.length === 0) {
      showToast('Prenez ou choisissez au moins une photo de carte de visite.', true);
      return;
    }

    setIsScanning(true);
    try {
      const payloadImages = selectedImages.map((img) => ({
        base64: img.base64,
      }));

      const res = await fetch('/api/scan-business-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: payloadImages }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Impossible de lire les cartes', true);
      } else if (!data.cards || data.cards.length === 0) {
        showToast(
          'Aucune carte de société trouvée. Essayez avec une photo plus nette.',
          true
        );
      } else {
        const mapped: ExtractedCard[] = data.cards.map((c: any) => {
          const cleanEmail = (c.email || '').trim().toLowerCase();
          const hasValidEmail = Boolean(cleanEmail && cleanEmail.includes('@'));
          return {
            tempId: Math.random().toString(36).substring(2, 9),
            name: c.name || 'Société inconnue',
            contact_person: c.contact_person || '',
            email: cleanEmail,
            verified_email:
              typeof c.verified_email === 'boolean'
                ? c.verified_email && hasValidEmail
                : hasValidEmail,
            phone: c.phone || '',
            address: c.address || '',
            city: c.city || '',
            postal_code: c.postal_code || '',
            canton: (c.canton || 'ZH').toUpperCase(),
            domain: c.domain || '',
            industry: c.industry || 'civil_engineering',
            language: c.language || 'de',
            notes: c.notes || '',
            confidence: typeof c.confidence === 'number' ? c.confidence : 0.85,
            selected: true,
            saved: false,
          };
        });

        setExtractedCards(mapped);
        showToast(
          `AI extracted ${mapped.length} company card${mapped.length === 1 ? '' : 's'}!`
        );
      }
    } catch (err: any) {
      showToast(`Erreur de lecture : ${err?.message || 'erreur de connexion'}`, true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCardFieldChange = (
    tempId: string,
    field: keyof ExtractedCard,
    value: any
  ) => {
    setExtractedCards((prev) =>
      prev.map((card) => {
        if (card.tempId === tempId) {
          const updated = { ...card, [field]: value };
          if (field === 'canton') {
            const match = ALL_SWISS_CANTONS.find((c) => c.code === value);
            if (match) {
              updated.language = match.language;
            }
          }
          if (field === 'email') {
            const clean = String(value || '').trim();
            updated.verified_email = Boolean(clean && clean.includes('@'));
          }
          return updated;
        }
        return card;
      })
    );
  };

  const toggleCardSelection = (tempId: string) => {
    setExtractedCards((prev) =>
      prev.map((c) => (c.tempId === tempId ? { ...c, selected: !c.selected } : c))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = extractedCards.every((c) => c.selected);
    setExtractedCards((prev) => prev.map((c) => ({ ...c, selected: !allSelected })));
  };

  const removeCard = (tempId: string) => {
    setExtractedCards((prev) => prev.filter((c) => c.tempId !== tempId));
  };

  const handleSaveSingleCard = async (card: ExtractedCard) => {
    try {
      const cleanEmail = (card.email || '').trim().toLowerCase();
      const hasValidEmail = Boolean(cleanEmail && cleanEmail.includes('@'));

      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: card.name,
          email: cleanEmail,
          verified_email: hasValidEmail,
          canton: card.canton,
          language: card.language,
          phone: card.phone || null,
          domain: card.domain || null,
          industry: card.industry,
          contact_person: card.contact_person || null,
          address: card.address || null,
          postal_code: card.postal_code || null,
          city: card.city || null,
          notes: card.notes || null,
          source: 'ocr',
          confidence: card.confidence,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Impossible d’enregistrer la société', true);
        return;
      }

      await onRefreshCompanies();
      setExtractedCards((prev) =>
        prev.map((c) => (c.tempId === card.tempId ? { ...c, saved: true } : c))
      );
      showToast(
        hasValidEmail
          ? `${card.name} (${card.canton}) a été enregistrée avec un courriel vérifié.`
          : `${card.name} (${card.canton}) a été enregistrée avec le téléphone seulement.`
      );
    } catch (err: any) {
      showToast(`Erreur : ${err?.message}`, true);
    }
  };

  const handleSaveAllSelected = async () => {
    const selectedCards = extractedCards.filter((c) => c.selected && !c.saved);
    if (selectedCards.length === 0) {
      showToast('Aucune carte choisie.', true);
      return;
    }

    setIsSavingAll(true);
    try {
      const payload = selectedCards.map((c) => {
        const cleanEmail = (c.email || '').trim().toLowerCase();
        const hasValidEmail = Boolean(cleanEmail && cleanEmail.includes('@'));
        return {
          name: c.name,
          email: cleanEmail,
          verified_email: hasValidEmail,
          canton: c.canton,
          phone: c.phone || null,
          domain: c.domain || null,
          industry: c.industry,
          language: c.language,
          contact_person: c.contact_person || null,
          address: c.address || null,
          postal_code: c.postal_code || null,
          city: c.city || null,
          notes: c.notes || null,
          source: 'ocr',
          confidence: c.confidence,
        };
      });

      const res = await fetch('/api/companies/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: payload }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Impossible d’enregistrer les sociétés', true);
      } else {
        await onRefreshCompanies();
        setExtractedCards((prev) =>
          prev.map((c) =>
            selectedCards.some((sc) => sc.tempId === c.tempId) ? { ...c, saved: true } : c
          )
        );
        showToast(
          `${data.added || 0} nouvelle(s) société(s) et ${data.updated || 0} mise(s) à jour.`
        );
      }
    } catch (err: any) {
      showToast(`Erreur pendant l’enregistrement : ${err?.message}`, true);
    } finally {
      setIsSavingAll(false);
    }
  };

  const selectedCount = extractedCards.filter((c) => c.selected && !c.saved).length;
  const savedCount = extractedCards.filter((c) => c.saved).length;

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-white shadow-lg flex items-center gap-2.5 text-sm font-medium max-w-xl ${
            toast.isError ? 'bg-red-700' : 'bg-[#0B2240]'
          }`}
        >
          {toast.isError ? (
            <AlertCircle className="w-4 h-4 text-white shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#FF6B00] shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-[#FF6B00] text-xs font-bold uppercase tracking-wider mb-2 border border-orange-200">
            <Camera className="w-3.5 h-3.5" />
              <span>Scanner de cartes de visite</span>
          </div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tracking-tight">
            Lire des cartes et ajouter plusieurs sociétés
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Prenez ou choisissez des photos de cartes. Jimy trouve le nom, le contact, l’adresse, le téléphone, le courriel et le canton sans inventer les informations absentes.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToTargets}
          className="self-start sm:self-auto h-10 px-4 rounded-xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 text-[#0B2240] font-heading font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <Building2 className="w-4 h-4 text-[#FF6B00]" />
          <span>Voir les sociétés ({existingCompanies.length})</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelection(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelection(e.target.files)}
      />

      {/* UPLOAD & CAMERA CARD */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-300 shadow-md space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-[#FF6B00] border border-orange-200 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg text-[#0B2240]">
                1. Prendre ou choisir des photos de cartes
              </h2>
              <p className="text-xs text-slate-500">
                Vous pouvez choisir une carte, plusieurs cartes ou une photo avec plusieurs cartes.
              </p>
            </div>
          </div>

          {selectedImages.length > 0 && (
            <button
              type="button"
              onClick={clearAllImages}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Effacer les photos</span>
            </button>
          )}
        </div>

        {/* Action Buttons & Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileSelection(e.dataTransfer.files);
          }}
          className="border-2 border-dashed border-slate-300 hover:border-[#FF6B00] rounded-3xl p-8 text-center bg-slate-50/80 hover:bg-orange-50/30 transition-all space-y-4"
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="h-12 px-6 rounded-2xl bg-[#FF6B00] hover:bg-[#E05E00] text-white font-heading font-bold text-sm flex items-center gap-2.5 shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <Camera className="w-5 h-5" />
              <span>Prendre une photo</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-12 px-6 rounded-2xl bg-white hover:bg-slate-50 text-[#0B2240] border-2 border-slate-300 hover:border-[#0B2240] font-heading font-bold text-sm flex items-center gap-2.5 shadow-xs hover:shadow active:scale-95 transition-all cursor-pointer"
            >
              <Upload className="w-5 h-5 text-[#0B2240]" />
              <span>Choisir des photos</span>
            </button>
          </div>

          <p className="text-xs text-slate-500">
            ou déposez les photos ici (JPEG, PNG, HEIC, WebP)
          </p>
        </div>

        {/* Selected Photos Thumbnails */}
        {selectedImages.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#0B2240]">
              <span>
                Ready to Scan ({selectedImages.length} photo
                {selectedImages.length === 1 ? '' : 's'} selected):
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {selectedImages.map((img) => (
                <div
                  key={img.id}
                  className="relative group rounded-2xl overflow-hidden border-2 border-slate-200 aspect-video bg-slate-100 shadow-2xs"
                >
                  <img
                    src={img.preview}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                    title="Retirer la photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={handleScanCards}
                disabled={isScanning}
                className="h-13 px-8 rounded-2xl bg-[#0B2240] hover:bg-[#16365C] text-white font-heading font-bold text-sm sm:text-base flex items-center gap-3 shadow-lg hover:shadow-xl active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles
                  className={`w-5 h-5 text-[#FF6B00] ${isScanning ? 'animate-spin' : ''}`}
                />
                <span>
                  {isScanning
                    ? 'Lecture des cartes…'
                    : 'Lire les cartes avec Jimy'}
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* EXTRACTED CARDS REVIEW & BULK IMPORT */}
      {extractedCards.length > 0 && (
        <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-orange-300 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  ✓
                </span>
                <h2 className="font-heading font-bold text-xl text-[#0B2240]">
                  2. Vérifier et ajouter les sociétés ({extractedCards.length} trouvée(s))
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Verify the extracted details below. Cards without an email are saved as phone-only records until an email is verified.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-semibold text-slate-600 hover:text-[#0B2240] px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {extractedCards.every((c) => c.selected) ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>

              <button
                type="button"
                onClick={handleSaveAllSelected}
                disabled={isSavingAll || selectedCount === 0}
                className="h-12 px-6 rounded-2xl bg-[#059669] hover:bg-[#047857] text-white font-heading font-bold text-sm flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>
                  {isSavingAll
                    ? 'Enregistrement…'
                    : `Save Selected (${selectedCount}) to System`}
                </span>
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {extractedCards.map((card, idx) => {
              const isAlreadyInSystem = existingCompanies.some(
                (ec) =>
                  (card.email &&
                    ec.email &&
                    ec.email.toLowerCase() === card.email.toLowerCase()) ||
                  ec.name.toLowerCase() === card.name.toLowerCase()
              );
              const hasEmail = Boolean(card.email && card.email.includes('@'));

              return (
                <div
                  key={card.tempId}
                  className={`rounded-3xl p-5 sm:p-6 border-2 transition-all space-y-4 relative ${
                    card.saved
                      ? 'border-emerald-400 bg-emerald-50/40'
                      : card.selected
                      ? 'border-orange-300 bg-white shadow-sm'
                      : 'border-slate-200 bg-slate-50/60 opacity-80'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={card.selected}
                        disabled={card.saved}
                        onChange={() => toggleCardSelection(card.tempId)}
                        className="w-5 h-5 rounded-md text-[#FF6B00] focus:ring-[#FF6B00] border-slate-300 cursor-pointer"
                      />
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Card #{idx + 1}
                        </span>
                        <h3 className="font-heading font-bold text-base text-[#0B2240]">
                          {card.name}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {!hasEmail && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-semibold text-[11px] border border-amber-200">
                          Pas de courriel, téléphone seulement
                        </span>
                      )}
                      {card.saved ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1 border border-emerald-300">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Enregistré</span>
                        </span>
                      ) : isAlreadyInSystem ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-300">
                          Déjà dans la liste
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 font-mono font-bold text-xs border border-blue-200">
                          {((card.confidence || 0.85) * 100).toFixed(0)}% OCR
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => removeCard(card.tempId)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Retirer cette carte"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Editable Fields Form */}
                  <div className="space-y-3 text-xs pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">
                          Nom de la société *
                        </label>
                        <input
                          type="text"
                          value={card.name}
                          onChange={(e) =>
                            handleCardFieldChange(card.tempId, 'name', e.target.value)
                          }
                          className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-semibold text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">
                          Contact Person &amp; Role
                        </label>
                        <div className="relative">
                          <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={card.contact_person || ''}
                            placeholder="Ex. Marc Blanc, responsable du dépôt"
                            onChange={(e) =>
                              handleCardFieldChange(
                                card.tempId,
                                'contact_person',
                                e.target.value
                              )
                            }
                            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 font-medium text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">
                          Courriel vérifié (laisser vide s’il est absent)
                        </label>
                        <div className="relative">
                          <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="email"
                            value={card.email}
                            placeholder="Laisser vide si absent de la carte"
                            onChange={(e) =>
                              handleCardFieldChange(card.tempId, 'email', e.target.value)
                            }
                            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 font-mono text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">
                          Téléphone
                        </label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={card.phone || ''}
                            placeholder="+41 44 ..."
                            onChange={(e) =>
                              handleCardFieldChange(card.tempId, 'phone', e.target.value)
                            }
                            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 font-mono text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">
                          Canton
                        </label>
                        <select
                          value={card.canton}
                          onChange={(e) =>
                            handleCardFieldChange(card.tempId, 'canton', e.target.value)
                          }
                          className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-2 font-bold text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                        >
                          {ALL_SWISS_CANTONS.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code} — {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">
                          Code postal
                        </label>
                        <input
                          type="text"
                          value={card.postal_code || ''}
                          placeholder="1000"
                          onChange={(e) =>
                            handleCardFieldChange(card.tempId, 'postal_code', e.target.value)
                          }
                          className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-mono text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">
                          Ville
                        </label>
                        <input
                          type="text"
                          value={card.city || ''}
                          placeholder="Lausanne"
                          onChange={(e) =>
                            handleCardFieldChange(card.tempId, 'city', e.target.value)
                          }
                          className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">
                          Langue
                        </label>
                        <select
                          value={card.language}
                          onChange={(e) =>
                            handleCardFieldChange(card.tempId, 'language', e.target.value)
                          }
                          className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-2 font-bold text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                        >
                          <option value="de">DE (allemand)</option>
                          <option value="fr">FR (français)</option>
                          <option value="it">IT (italien)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">
                          Adresse
                        </label>
                        <div className="relative">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={card.address || ''}
                            placeholder="Rue de l'Industrie 12"
                            onChange={(e) =>
                              handleCardFieldChange(card.tempId, 'address', e.target.value)
                            }
                            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 font-medium text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-600 block mb-1">
                          Secteur et notes
                        </label>
                        <input
                          type="text"
                          value={card.notes || ''}
                          placeholder="Terrassement, pelles, notes sur le parc…"
                          onChange={(e) =>
                            handleCardFieldChange(card.tempId, 'notes', e.target.value)
                          }
                          className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-[#0B2240] focus:outline-none focus:border-[#0B2240]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500">
                      Langue du courriel : <strong>{card.language.toUpperCase()}</strong> ·{' '}
                      {hasEmail ? (
                        <span className="text-emerald-700 font-semibold">
                          Prête pour les courriels
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold">
                          Enregistrée pour vérification manuelle
                        </span>
                      )}
                    </span>

                    {!card.saved && (
                      <button
                        type="button"
                        onClick={() => handleSaveSingleCard(card)}
                        className="h-8 px-4 rounded-xl bg-white hover:bg-slate-50 border-2 border-slate-300 hover:border-[#0B2240] font-heading font-bold text-xs text-[#0B2240] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Enregistrer cette société</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {savedCount > 0 && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{savedCount} companies have been saved into your company list.</span>
              </div>
              <button
                type="button"
                onClick={onNavigateToTargets}
                className="h-9 px-4 rounded-xl bg-[#0B2240] hover:bg-[#16365C] text-white font-heading font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                <span>Voir la liste des sociétés</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#FF6B00]" />
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
