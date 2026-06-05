export async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export async function copyHtmlToClipboard(html, fallbackText) {
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([fallbackText], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
      return;
    } catch (error) {
      // Fall through to DOM selection copy, which preserves HTML for Outlook in more browsers.
    }
  }

  if (copyHtmlWithSelectionFallback(html)) {
    return;
  }

  await copyTextToClipboard(fallbackText);
}

function copyHtmlWithSelectionFallback(html) {
  if (typeof document === 'undefined' || !document.body) return false;

  const container = document.createElement('div');
  container.innerHTML = html;
  container.contentEditable = 'true';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';

  document.body.appendChild(container);

  const range = document.createRange();
  range.selectNodeContents(container);

  const selection = window.getSelection();
  if (!selection) {
    document.body.removeChild(container);
    return false;
  }

  selection.removeAllRanges();
  selection.addRange(range);

  let successful = false;
  try {
    successful = document.execCommand('copy');
  } finally {
    selection.removeAllRanges();
    document.body.removeChild(container);
  }

  return successful;
}
