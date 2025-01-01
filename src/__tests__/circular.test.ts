import { describe, it, expect } from "vitest";
import { createParser } from "../index";
import type { JSONSchema7 as Schema } from "../types";

describe("Circular Reference Tests", () => {
  it("should handle simple circular references in schema", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        next: { $ref: "#" }, // Self reference
      },
    };

    const parser = createParser(schema);
    const formData = new FormData();
    formData.append("name", "Root");
    formData.append("next.name", "Child");
    formData.append("next.next.name", "GrandChild");
    formData.append("next.next.next.name", "GreatGrandChild");

    const result = parser(formData);
    expect(result).toEqual({
      name: "Root",
      next: {
        name: "Child",
        next: {
          name: "GrandChild",
          next: {
            name: "GreatGrandChild",
          },
        },
      },
    });
  });

  it("should handle complex circular references with multiple paths", () => {
    const schema: Schema = {
      type: "object",
      definitions: {
        node: {
          type: "object",
          properties: {
            value: { type: "string" },
            left: { $ref: "#/definitions/node" },
            right: { $ref: "#/definitions/node" },
          },
        },
      },
      properties: {
        root: { $ref: "#/definitions/node" },
      },
    };

    const parser = createParser(schema);
    const formData = new FormData();
    formData.append("root.value", "Root");
    formData.append("root.left.value", "Left");
    formData.append("root.right.value", "Right");
    formData.append("root.left.left.value", "LeftLeft");
    formData.append("root.right.right.value", "RightRight");

    const result = parser(formData);
    expect(result).toEqual({
      root: {
        value: "Root",
        left: {
          value: "Left",
          left: {
            value: "LeftLeft",
          },
        },
        right: {
          value: "Right",
          right: {
            value: "RightRight",
          },
        },
      },
    });
  });

  it("should handle circular references with additional properties", () => {
    const schema: Schema = {
      type: "object",
      definitions: {
        comment: {
          type: "object",
          properties: {
            text: { type: "string" },
            author: { type: "string" },
            replies: {
              type: "array",
              items: { $ref: "#/definitions/comment" },
            },
          },
        },
      },
      properties: {
        comments: {
          type: "array",
          items: { $ref: "#/definitions/comment" },
        },
      },
    };

    const parser = createParser(schema);
    const formData = new FormData();
    formData.append("comments[0].text", "Parent comment");
    formData.append("comments[0].author", "John");
    formData.append("comments[0].replies[0].text", "Reply 1");
    formData.append("comments[0].replies[0].author", "Jane");
    formData.append("comments[0].replies[0].replies[0].text", "Nested reply");
    formData.append("comments[0].replies[0].replies[0].author", "Bob");

    const result = parser(formData);
    expect(result).toEqual({
      comments: [
        {
          text: "Parent comment",
          author: "John",
          replies: [
            {
              text: "Reply 1",
              author: "Jane",
              replies: [
                {
                  text: "Nested reply",
                  author: "Bob",
                  replies: [],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("should handle circular references with default values", () => {
    const schema: Schema = {
      type: "object",
      definitions: {
        node: {
          type: "object",
          properties: {
            value: { type: "string", default: "default" },
            metadata: {
              type: "object",
              properties: {
                created: { type: "string" },
              },
            },
            next: { $ref: "#/definitions/node" },
          },
        },
      },
      properties: {
        root: { $ref: "#/definitions/node" },
      },
    };

    const parser = createParser(schema);
    const formData = new FormData();
    formData.append("root.value", "Custom");
    formData.append("root.next.metadata.created", "yesterday");

    const result = parser(formData);
    expect(result).toEqual({
      root: {
        value: "Custom",
        next: {
          value: "default",
          metadata: {
            created: "yesterday",
          },
        },
      },
    });
  });
});
