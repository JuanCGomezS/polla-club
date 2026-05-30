import { useState } from 'react';
import TermsAndConditionsModal from './TermsAndConditionsModal';

export default function HomeTermsCard() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="mt-10 max-w-5xl mx-auto">
      <div className="rounded-2xl border border-[color:var(--pc-main-dark)]/60 bg-[color:var(--pc-surface)]/80 p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg md:text-xl font-semibold text-[color:var(--pc-text-on-dark)]">
              Términos y condiciones
            </h3>
            <p className="mt-1 text-sm text-[color:var(--pc-muted)]">
              Conoce las reglas de uso, pagos y política de reembolsos de PollaClub.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 bg-[color:var(--pc-accent)] text-[color:var(--pc-text-strong)] font-semibold hover:bg-[color:var(--pc-accent-dark)]"
          >
            Ver términos
          </button>
        </div>
      </div>

      <TermsAndConditionsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </section>
  );
}
