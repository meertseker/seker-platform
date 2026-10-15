import sanitizeHtml from 'sanitize-html';

const BASE_TAGS = ['p', 'br', 'b', 'strong', 'i', 'em', 'a', 'ul', 'ol', 'li'];

function options(opts?: { allowHeadings?: boolean }): sanitizeHtml.IOptions {
  return {
    allowedTags: opts?.allowHeadings ? [...BASE_TAGS, 'h2'] : BASE_TAGS,
    allowedAttributes: { a: ['href', 'rel', 'target'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
    transformTags: {
      // transformTags şema filtresinden önce çalışır; izinsiz şemalı href'i burada düşürürüz ki rel/target da eklenmesin.
      a: (_tag, attribs): sanitizeHtml.Tag => ({
        tagName: 'a',
        attribs: /^(https?:|mailto:|tel:)/i.test(attribs.href ?? '')
          ? { href: attribs.href, rel: 'noopener noreferrer', target: '_blank' }
          : {},
      }),
    },
    exclusiveFilter: (frame) => frame.tag === 'p' && !frame.text.trim() && !frame.mediaChildren.length,
  };
}

export function sanitizeRich(html: string, opts?: { allowHeadings?: boolean }): string {
  return sanitizeHtml(html, options(opts)).trim();
}

export function richToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
}
