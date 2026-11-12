import React, { useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Building2, Search, ShieldCheck } from 'lucide-react';

interface ZefixEntry {
  name: string;
  legalForm?: string;
  uid?: string;
  status?: string;
  city?: string;
}

interface ZefixCheckerScreenProps {
  zefixConfigured: boolean;
}

export const ZefixCheckerScreen: React.FC<ZefixCheckerScreenProps> = ({
  zefixConfigured,
}) => {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<ZefixEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  // The name actually searched. The empty state quotes this, not the live
  // field — otherwise clearing the field after a search renders « ».
  const [searchedName, setSearchedName] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = query.trim();
    if (!name) return;
    setIsSearching(true);
    setError(null);
    setSearchedName(name);
    try {
      const res = await fetch('/api/zefix/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `La recherche a échoué (HTTP ${res.status}).`);
      }
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setHasSearched(true);
    } catch (err: any) {
      setEntries([]);
      setHasSearched(true);
      setError(err?.message || 'La recherche a échoué.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Page Header */}
      <div className="pt-1">
        <div className="mb-2">
          <Badge label="Registre du commerce suisse" variant="orange" />
        </div>
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[#0B2240] tracking-tight">
          Vérifier une société
        </h1>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl">
          Cherchez une société par son nom dans Zefix, le registre du commerce
          suisse, et voyez si elle y est inscrite et active.
        </p>
      </div>

      {!zefixConfigured ? (
        <Banner
          status="warning"
          container="card"
          collapsible={false}
          title="Zefix n’est pas configuré"
          description="Les accès Zefix (ZEFIX_USERNAME / ZEFIX_PASSWORD) ne sont pas définis sur ce serveur, la vérification est donc indisponible pour le moment."
        />
      ) : (
        <>
          {/* Search Card */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-300 shadow-md space-y-5">
            <form onSubmit={handleSearch} className="space-y-4">
              <TextInput
                label="Nom de la société"
                value={query}
                onChange={setQuery}
                placeholder="Nom de la société (ex. Implenia)"
                hasAutoFocus
              />
              {!query.trim() && (
                <p className="text-sm text-slate-500">
                  Saisissez un nom de société pour lancer la recherche.
                </p>
              )}
              <Button
                label="Vérifier dans Zefix"
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSearching}
                isDisabled={!query.trim()}
                icon={<Search className="w-4 h-4" />}
              />
            </form>
          </section>

          {/* Error */}
          {error && (
            <Banner
              status="error"
              container="card"
              collapsible={false}
              title={error}
            />
          )}

          {/* Empty state */}
          {!error && hasSearched && entries.length === 0 && searchedName && (
            <Banner
              status="info"
              container="card"
              collapsible={false}
              title="Aucune société active trouvée"
              description={`Aucune inscription active ne correspond à « ${searchedName} » dans le registre du commerce suisse.`}
            />
          )}

          {/* Results */}
          {!error && entries.length > 0 && (
            <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-300 shadow-md space-y-4">
              <h2 className="font-heading font-bold text-lg text-[#0B2240]">
                {entries.length} société{entries.length > 1 ? 's' : ''} trouvée
                {entries.length > 1 ? 's' : ''}
              </h2>
              <ul className="divide-y divide-slate-200">
                {entries.map((entry) => (
                  <li key={entry.uid || entry.name} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 shrink-0 rounded-2xl bg-orange-100 text-[#FF6B00] border border-orange-200 flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[#0B2240]">{entry.name}</p>
                        <p className="text-sm text-slate-600">
                          {[entry.legalForm, entry.city].filter(Boolean).join(' · ') ||
                            '—'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {[entry.uid ? `UID ${entry.uid}` : null, entry.status]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Independent-check note */}
      <div className="flex items-start gap-2 text-xs text-slate-500 max-w-2xl">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#FF6B00]" />
        <p>
          Vérification indépendante dans le registre du commerce suisse (Zefix,
          Office fédéral de la justice). Elle ne modifie rien : elle ne lance
          pas la découverte, n’ajoute aucune société et n’envoie aucun e-mail.
        </p>
      </div>
    </div>
  );
};
