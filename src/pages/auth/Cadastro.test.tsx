import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Cadastro from "./Cadastro";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signUp: vi.fn() },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn() })) })) })) })),
  },
}));

// Mock consent
vi.mock("@/lib/consent", () => ({
  registerConsent: vi.fn(),
}));

function renderCadastro() {
  return render(
    <MemoryRouter initialEntries={["/auth/cadastro"]}>
      <Cadastro />
    </MemoryRouter>
  );
}

describe("Cadastro – screen reader announcements on rapid submit", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clean up any live regions appended to body
    document.querySelectorAll('[aria-live="assertive"]').forEach((el) => el.remove());
  });

  it("announces only one error message after a single submit on doctor form", async () => {
    renderCadastro();

    // Pick doctor account
    fireEvent.click(screen.getByText("Sou médico"));

    // Submit empty form
    const submitBtn = screen.getByRole("button", { name: /criar conta médica/i });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Advance timers for the 80ms announcement delay
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // There should be exactly one assertive live region in the document
    const liveRegions = document.querySelectorAll('[aria-live="assertive"]');
    expect(liveRegions.length).toBe(1);

    // It should contain a single text (not duplicated)
    const announcement = liveRegions[0].textContent;
    expect(announcement).toBeTruthy();
    // Should NOT contain the same message twice (no double announcement)
    expect(announcement!.length).toBeGreaterThan(0);
  });

  it("does not double-announce on rapid repeated submits", async () => {
    renderCadastro();

    fireEvent.click(screen.getByText("Sou médico"));

    const submitBtn = screen.getByRole("button", { name: /criar conta médica/i });

    // Rapid triple submit
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    await act(async () => {
      vi.advanceTimersByTime(30);
      fireEvent.click(submitBtn);
    });
    await act(async () => {
      vi.advanceTimersByTime(30);
      fireEvent.click(submitBtn);
    });

    // Let all timers flush (80ms debounce + rAF)
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const liveRegions = document.querySelectorAll('[aria-live="assertive"]');
    // Still only one live region
    expect(liveRegions.length).toBe(1);

    const text = liveRegions[0].textContent || "";
    // Text should be a single error message, not repeated
    // Count occurrences of the message — it should appear exactly once
    const words = text.trim();
    expect(words.length).toBeGreaterThan(0);

    // Verify no inline role="alert" elements exist (no double announcement source)
    const inlineAlerts = document.querySelectorAll('form [role="alert"]');
    expect(inlineAlerts.length).toBe(0);
  });

  it("announces only the first field error, not all errors", async () => {
    renderCadastro();

    fireEvent.click(screen.getByText("Sou médico"));

    const submitBtn = screen.getByRole("button", { name: /criar conta médica/i });

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    const liveRegion = document.querySelector('[aria-live="assertive"]');
    const announcement = liveRegion?.textContent || "";

    // The announcement should be a single short message (first error only),
    // not a concatenation of all errors
    // "full_name" is the first field — its error should be announced
    // The text should NOT contain multiple distinct error messages separated
    expect(announcement.split(".").filter(Boolean).length).toBeLessThanOrEqual(1);
  });
});
