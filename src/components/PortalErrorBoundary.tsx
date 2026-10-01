import React from 'react';

type Props = { onClose: () => void; children: React.ReactNode };

/**
 * If something inside the owner portal throws while drawing, React removes the
 * whole app from the page, not just the portal — Paul is left looking at a
 * white screen with no idea why. This keeps the failure inside the portal and
 * tells him what to do.
 *
 * The project has no React type definitions installed, so `props` and
 * `setState` are declared below.
 */
export class PortalErrorBoundary extends React.Component<Props, { failed: boolean }> {
  declare props: Props;
  declare setState: (s: { failed: boolean }) => void;
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Owner portal failed to display', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/95 font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-red-600/60 p-6 space-y-4 text-zinc-100">
          <h2 className="text-xl font-black uppercase italic">The portal hit a problem</h2>
          <p className="text-sm text-zinc-300">
            Something on this screen could not be displayed. Your bookings and payments are safe — nothing was changed.
            Reload the page and sign in again. If it keeps happening, tell Otis what you clicked just before.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.location.reload()} className="bg-orange-600 hover:bg-orange-500 text-white font-black px-4 py-2 text-xs uppercase tracking-wider cursor-pointer">
              Reload
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ failed: false });
                this.props.onClose();
              }}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 text-xs uppercase font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
}
