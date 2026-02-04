/**
 * MedWard Pro - Medical Response Formatter
 * Converts raw Markdown/text from AI into styled clinical HTML
 * Provides UpToDate-grade rendering with clinical alerts, severity chips, and structured sections
 */

/**
 * Format raw AI response text into clinical HTML
 * @param {string} text - Raw AI response (Markdown)
 * @returns {string} - Formatted HTML string
 */
export function formatMedicalResponse(text) {
  if (!text || typeof text !== 'string') return '';

  let html = text;

  // 1. Escape HTML entities first (prevent XSS), then apply formatting
  html = escapeHtml(html);

  // 2. Convert headers (## / ### / #)
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // 3. Convert bold (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 4. Convert italic (*text*)
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');

  // 5. Detect and wrap RED FLAGS / CRITICAL sections as clinical alerts
  html = html.replace(
    /(<h[234]>.*?(?:RED FLAG|CRITICAL|IMMEDIATE ACTION|URGENT|WARNING:).*?<\/h[234]>)/gi,
    '</p><div class="clinical-alert clinical-alert--critical"><div class="clinical-alert__content"><div class="clinical-alert__title">$1</div><div class="clinical-alert__body">'
  );

  // Close alert blocks at next header or double newline
  html = html.replace(
    /(<div class="clinical-alert__body">)([\s\S]*?)(?=<h[234]>|$)/g,
    (match, open, content) => {
      // Only close if we opened an alert
      if (content.includes('</div></div></div>')) return match;
      return open + content + '</div></div></div><p>';
    }
  );

  // 6. Convert bullet lists (- item or * item)
  html = html.replace(/^[-\u2022]\s+(.+)$/gm, '<li>$1</li>');
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.+<\/li>\s*)+)/g, '<ul>$1</ul>');

  // 7. Convert numbered lists (1. item)
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // 8. Convert line breaks to paragraphs
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // 9. Wrap in paragraph
  html = '<p>' + html + '</p>';

  // 10. Clean up empty paragraphs and fix nesting
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[234]>)/g, '$1');
  html = html.replace(/(<\/h[234]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<div class="clinical-alert)/g, '$1');

  // 11. Auto-detect severity terms and convert to chips
  const severityTerms = [
    { pattern: /\b(Septic Shock|Cardiac Arrest|Code Blue)\b/gi, level: 'critical' },
    { pattern: /\b(Life[\s-]threatening|ICU Criteria|Emergent)\b/gi, level: 'critical' },
    { pattern: /\b(MRSA Risk|High Risk|Severe CAP|Severe Sepsis)\b/gi, level: 'warning' },
    { pattern: /\b(Moderate Risk|Caution)\b/gi, level: 'warning' },
    { pattern: /\b(Outpatient|Stable|Resolved|Low Risk)\b/gi, level: 'success' },
    { pattern: /\b(Step[\s-]down|De[\s-]escalat(?:e|ion))\b/gi, level: 'info' },
  ];

  severityTerms.forEach(({ pattern, level }) => {
    html = html.replace(pattern, `<span class="severity-chip severity-chip--${level}">$1</span>`);
  });

  return html;
}

/**
 * Render a complete clinical response with container and footer
 * @param {string} responseText - Raw AI response text
 * @param {string} [disclaimer] - Optional disclaimer text
 * @returns {string} - Complete HTML with response container
 */
export function renderClinicalResponse(responseText, disclaimer) {
  const content = formatMedicalResponse(responseText);
  const disclaimerText = disclaimer || 'Based on current clinical guidelines. Always verify with local protocols and clinical judgment.';

  return `
    <div class="clinical-response">
      ${content}
      <div class="clinical-response__footer">
        ${escapeHtml(disclaimerText)}
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS - preserves Markdown syntax
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
