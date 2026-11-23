"use client";

export function SkipLink() {
  return (
    <a href="#main" className="skip-link" onClick={event => {
      const content = document.querySelector<HTMLElement>("[data-skip-target]") ?? document.getElementById("main");
      if (!content) return;
      event.preventDefault();
      content.focus();
    }}>
      Skip to content
    </a>
  );
}
