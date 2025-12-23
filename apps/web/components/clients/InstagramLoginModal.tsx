'use client';

type InstagramLoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const SCOPES = ["instagram_business_basic", "instagram_basic"];

export function InstagramLoginModal({ isOpen, onClose }: InstagramLoginModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl shadow-black/40">
        <button
          type="button"
          aria-label="Close Instagram login"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-deepGreen/20 bg-white/80 px-3 py-1 text-xs font-semibold text-deepGreen transition hover:border-deepGreen/50 hover:bg-white"
        >
          Close
        </button>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-deepGreen/50">Instagram</p>
            <h3 className="text-lg font-semibold text-deepGreen">Instagram Login (preview)</h3>
            <p className="text-sm text-deepGreen/70">
              We request Meta scopes only for review. When the backend callback is ready, this button will redirect to
              the official OAuth dialog.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {SCOPES.map((scope) => (
              <span
                key={scope}
                className="rounded-full border border-deepGreen/20 bg-offWhite px-3 py-1 text-xs font-semibold text-deepGreen"
              >
                {scope}
              </span>
            ))}
          </div>

          <ol className="list-decimal space-y-2 pl-5 text-sm text-deepGreen/80">
            <li>We start the login by redirecting to Meta OAuth with the scopes above.</li>
            <li>Meta returns a code to our backend callback URL for token exchange.</li>
            <li>We link the Instagram account to the current organization and cache insights for this client.</li>
          </ol>

          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
            Waiting for backend details (App ID, redirect URL, token exchange). This preview keeps the button disabled.
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled
              className="rounded-full bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 shadow-sm"
            >
              Start Instagram login (preview)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
