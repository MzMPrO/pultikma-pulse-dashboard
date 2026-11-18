import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MiniMarkdown } from "./MiniMarkdown";

describe("MiniMarkdown", () => {
  it("renders **bold** as strong text without raw asterisks", () => {
    const { container } = render(<MiniMarkdown text="Итог: **57 баллов**" />);
    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("57 баллов");
    expect(container.textContent).not.toContain("**");
  });

  it("renders ## heading as an h2 without the hash marks", () => {
    const { container } = render(<MiniMarkdown text="## Результат" />);
    const h2 = container.querySelector("h2");
    expect(h2?.textContent).toBe("Результат");
    expect(container.textContent).not.toContain("#");
  });

  it("renders bullet and numbered lists as list items", () => {
    const { container } = render(
      <MiniMarkdown text={"- первый\n- второй\n\n1. раз\n2. два"} />,
    );
    const ul = container.querySelector("ul");
    const ol = container.querySelector("ol");
    expect(ul?.querySelectorAll("li")).toHaveLength(2);
    expect(ul?.querySelector("li")?.textContent).toBe("первый");
    expect(ol?.querySelectorAll("li")).toHaveLength(2);
    expect(container.textContent).not.toContain("- первый");
  });

  it("renders <script> text as plain text, never as an element", () => {
    const { container } = render(<MiniMarkdown text="<script>alert(1)</script>" />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
});
