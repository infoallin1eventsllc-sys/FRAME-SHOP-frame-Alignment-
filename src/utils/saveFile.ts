/**
 * Hand the owner a file: a PDF invoice, a spreadsheet, a printable sheet.
 *
 * On the live site this is an ordinary browser download. Inside the Claude
 * preview (where the demo is shown) plain downloads are blocked, so the
 * viewer's own download feature is used instead: it asks the viewer to
 * confirm, then saves the file.
 */
type Downloads = { save(req: { filename: string; data: Blob }): Promise<unknown> };
type Viewer = { use(name: 'downloads'): Promise<Downloads | null> };

export type SaveOutcome = 'saved' | 'declined' | 'failed';

export async function saveFile(filename: string, data: Blob): Promise<SaveOutcome> {
  const viewer = (window as unknown as { claude?: Viewer }).claude;
  if (viewer?.use) {
    const downloads = await viewer.use('downloads').catch(() => null);
    if (downloads) {
      try {
        await downloads.save({ filename, data });
        return 'saved';
      } catch (err) {
        return (err as { code?: string })?.code === 'declined' ? 'declined' : 'failed';
      }
    }
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'saved';
}

/**
 * Open a printable page in its own window. Where pop-up windows are blocked
 * (the Claude preview always blocks them), offer the page as a file instead,
 * so it can still be opened and printed.
 */
export async function openPrintable(html: string, filename: string, width = 900, height = 1000): Promise<void> {
  const win = window.open('', '_blank', `width=${width},height=${height}`);
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    return;
  }
  const outcome = await saveFile(filename, new Blob([html], { type: 'text/html' }));
  if (outcome === 'failed') {
    alert('The print window was blocked. Allow pop-ups for this site and try again.');
  }
}
