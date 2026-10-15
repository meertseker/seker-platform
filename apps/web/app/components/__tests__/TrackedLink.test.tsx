import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TrackedLink from '../TrackedLink';

document.addEventListener('click', (e) => e.preventDefault());

describe('TrackedLink', () => {
  beforeEach(() => {
    window.dataLayer = [];
  });
  afterEach(() => {
    cleanup();
    document.body.classList.remove('seker-editing');
  });

  it('ziyaretçide olayı gönderir', () => {
    render(<TrackedLink href="#x" event="cta_click" external>Git</TrackedLink>);
    fireEvent.click(screen.getByText('Git'));
    expect(window.dataLayer).toEqual([{ event: 'cta_click' }]);
  });

  it('düzenleme modunda olay göndermez', () => {
    document.body.classList.add('seker-editing');
    render(<TrackedLink href="#x" event="cta_click" external>Git</TrackedLink>);
    fireEvent.click(screen.getByText('Git'));
    expect(window.dataLayer).toEqual([]);
  });
});
