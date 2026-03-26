import { describe, it, expect } from 'vitest';
import { parseDocumentPath } from '../index.js';

describe('parseDocumentPath', () => {
  describe('blank input → null', () => {
    it('returns null for empty string', () => {
      expect(parseDocumentPath('', ['pdf'])).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(parseDocumentPath('   ', ['pdf'])).toBeNull();
    });
  });

  describe('valid extensions → trimmed path', () => {
    it('accepts .pdf when pdf is allowed', () => {
      expect(parseDocumentPath('portfolio.pdf', ['pdf'])).toBe('portfolio.pdf');
    });

    it('accepts .tex when tex is allowed', () => {
      expect(parseDocumentPath('resume.tex', ['pdf', 'tex'])).toBe('resume.tex');
    });

    it('accepts .pdf when both pdf and tex are allowed', () => {
      expect(parseDocumentPath('resume.pdf', ['pdf', 'tex'])).toBe('resume.pdf');
    });

    it('trims surrounding whitespace from the returned path', () => {
      expect(parseDocumentPath('  portfolio.pdf  ', ['pdf'])).toBe('portfolio.pdf');
    });
  });

  describe('invalid path shape → throws', () => {
    it('throws for a filename with no extension', () => {
      expect(() => parseDocumentPath('portfolio', ['pdf'])).toThrow();
    });

    it('throws for a dot-only extension like .pdf with no filename', () => {
      expect(() => parseDocumentPath('.pdf', ['pdf'])).toThrow();
    });
  });

  describe('invalid extension → throws', () => {
    it('throws for .docx when only pdf is allowed', () => {
      expect(() => parseDocumentPath('file.docx', ['pdf'])).toThrow();
    });

    it('throws for .md when pdf and tex are allowed', () => {
      expect(() => parseDocumentPath('resume.md', ['pdf', 'tex'])).toThrow();
    });

    it('error message includes the offending filename', () => {
      expect(() => parseDocumentPath('wrong.docx', ['pdf'])).toThrow('wrong.docx');
    });

    it('error message lists the allowed extensions', () => {
      expect(() => parseDocumentPath('wrong.docx', ['pdf', 'tex'])).toThrow('.pdf');
    });
  });
});
