import markdownit from "markdown-it";

/**
 * Tests for SmartQAMessageItem component logic.
 *
 * Since the project does not have React Testing Library, these tests verify
 * the core markdown rendering logic used by the component.
 */

// Mirror the markdown-it configuration from SmartQAMessageItem
const md = markdownit({
  html: false,
  linkify: true,
  typographer: false,
  breaks: true,
});

describe("SmartQAMessageItem Markdown Rendering", () => {
  describe("headings", () => {
    it("renders h1-h3 headings", () => {
      const result = md.render("# Title\n## Subtitle\n### Section");
      expect(result).toContain("<h1>Title</h1>");
      expect(result).toContain("<h2>Subtitle</h2>");
      expect(result).toContain("<h3>Section</h3>");
    });
  });

  describe("lists", () => {
    it("renders unordered lists", () => {
      const result = md.render("- Item 1\n- Item 2\n- Item 3");
      expect(result).toContain("<ul>");
      expect(result).toContain("<li>Item 1</li>");
      expect(result).toContain("<li>Item 2</li>");
      expect(result).toContain("<li>Item 3</li>");
      expect(result).toContain("</ul>");
    });

    it("renders ordered lists", () => {
      const result = md.render("1. First\n2. Second\n3. Third");
      expect(result).toContain("<ol>");
      expect(result).toContain("<li>First</li>");
      expect(result).toContain("<li>Second</li>");
      expect(result).toContain("</ol>");
    });
  });

  describe("code blocks", () => {
    it("renders inline code", () => {
      const result = md.render("Use `console.log()` for debugging");
      expect(result).toContain("<code>console.log()</code>");
    });

    it("renders fenced code blocks", () => {
      const result = md.render("```javascript\nconst x = 1;\n```");
      expect(result).toContain("<pre>");
      expect(result).toContain("<code");
      expect(result).toContain("const x = 1;");
      expect(result).toContain("</code>");
      expect(result).toContain("</pre>");
    });
  });

  describe("links", () => {
    it("renders markdown links", () => {
      const result = md.render("[Outline](https://getoutline.com)");
      expect(result).toContain('<a href="https://getoutline.com"');
      expect(result).toContain("Outline</a>");
    });

    it("auto-linkifies URLs with linkify enabled", () => {
      const result = md.render("Visit https://example.com for more");
      expect(result).toContain('<a href="https://example.com"');
    });
  });

  describe("paragraphs and line breaks", () => {
    it("renders paragraphs", () => {
      const result = md.render("First paragraph\n\nSecond paragraph");
      expect(result).toContain("<p>First paragraph</p>");
      expect(result).toContain("<p>Second paragraph</p>");
    });

    it("renders line breaks with breaks: true", () => {
      const result = md.render("Line one\nLine two");
      expect(result).toContain("<br>");
    });
  });

  describe("blockquotes", () => {
    it("renders blockquotes", () => {
      const result = md.render("> This is a quote");
      expect(result).toContain("<blockquote>");
      expect(result).toContain("This is a quote");
      expect(result).toContain("</blockquote>");
    });
  });

  describe("html safety", () => {
    it("does not render raw HTML when html: false", () => {
      const result = md.render('<script>alert("xss")</script>');
      expect(result).not.toContain("<script>");
    });

    it("escapes HTML entities", () => {
      const result = md.render("<div>Not a div</div>");
      expect(result).not.toContain("<div>");
      expect(result).toContain("&lt;div&gt;");
    });
  });

  describe("empty and whitespace content", () => {
    it("returns minimal output for empty string", () => {
      const result = md.render("");
      expect(result.trim()).toBe("");
    });

    it("renders whitespace-only content as empty", () => {
      const result = md.render("   ");
      // markdown-it treats whitespace-only as empty
      expect(result.trim()).toBe("");
    });
  });
});
