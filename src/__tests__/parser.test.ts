import { createParser } from "../index";
import type { JSONSchema7 as Schema } from "../types";
import { describe, it, expect } from "vitest";

describe("createParser", () => {
  it("should parse simple object schema", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
        isStudent: { type: "boolean" },
      },
    };

    const formData = new FormData();
    formData.append("name", "John Doe");
    formData.append("age", "25");
    formData.append("isStudent", "true");

    const parser = createParser(schema);
    const result = parser(formData);

    expect(result).toEqual({
      name: "John Doe",
      age: 25,
      isStudent: true,
    });
  });

  it("should handle nullable fields with oneOf", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: {
          oneOf: [{ type: "integer" }, { type: "null" }],
        },
        address: {
          oneOf: [
            {
              type: "object",
              properties: {
                street: { type: "string" },
                city: { type: "string" },
              },
            },
            { type: "null" },
          ],
        },
      },
    };

    const formData = new FormData();
    formData.append("name", "John");
    formData.append("address.street", "123 Main St");
    formData.append("address.city", "Boston");

    const parser = createParser(schema);
    const result = parser(formData);

    expect(result).toEqual({
      name: "John",
      age: null,
      address: {
        street: "123 Main St",
        city: "Boston",
      },
    });
  });

  it("should parse complex nested objects with arrays", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              roles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    permissions: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
              metadata: {
                type: "object",
                properties: {
                  lastLogin: { type: "string" },
                  settings: {
                    type: "object",
                    properties: {
                      notifications: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            enabled: { type: "boolean" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const formData = new FormData();
    formData.append("users[0].name", "John");
    formData.append("users[0].roles[0].name", "Admin");
    formData.append("users[0].roles[0].permissions[0]", "read");
    formData.append("users[0].roles[0].permissions[1]", "write");
    formData.append("users[0].metadata.lastLogin", "2023-01-01");
    formData.append(
      "users[0].metadata.settings.notifications[0].type",
      "email"
    );
    formData.append(
      "users[0].metadata.settings.notifications[0].enabled",
      "true"
    );
    formData.append("users[1].name", "Jane");
    formData.append("users[1].roles[0].name", "User");
    formData.append("users[1].roles[0].permissions[0]", "read");
    formData.append("users[1].metadata.settings.notifications[0].type", "sms");
    formData.append(
      "users[1].metadata.settings.notifications[0].enabled",
      "false"
    );

    const parser = createParser(schema);
    const result = parser(formData);

    expect(result).toEqual({
      users: [
        {
          name: "John",
          roles: [
            {
              name: "Admin",
              permissions: ["read", "write"],
            },
          ],
          metadata: {
            lastLogin: "2023-01-01",
            settings: {
              notifications: [
                {
                  type: "email",
                  enabled: true,
                },
              ],
            },
          },
        },
        {
          name: "Jane",
          roles: [
            {
              name: "User",
              permissions: ["read"],
            },
          ],
          metadata: {
            settings: {
              notifications: [
                {
                  type: "sms",
                  enabled: false,
                },
              ],
            },
          },
        },
      ],
    });
  });

  it("should handle arrays with primitive values", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        strings: {
          type: "array",
          items: { type: "string" },
        },
        numbers: {
          type: "array",
          items: { type: "number" },
        },
        booleans: {
          type: "array",
          items: { type: "boolean" },
        },
        mixed: {
          type: "array",
          items: {
            oneOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
            ],
          },
        },
      },
    };

    const formData = new FormData();
    formData.append("strings[0]", "first");
    formData.append("strings[1]", "second");
    formData.append("numbers[0]", "123");
    formData.append("numbers[1]", "456.78");
    formData.append("booleans[0]", "true");
    formData.append("booleans[1]", "false");
    formData.append("mixed[0]", "string");
    formData.append("mixed[1]", "123");
    formData.append("mixed[2]", "true");

    const parser = createParser(schema);
    const result = parser(formData);

    expect(result).toEqual({
      strings: ["first", "second"],
      numbers: [123, 456.78],
      booleans: [true, false],
      mixed: ["string", "123", "true"],
    });
  });

  it("should handle default values", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string", default: "Anonymous" },
        age: { type: "integer", default: 0 },
        isActive: { type: "boolean", default: false },
        preferences: {
          type: "object",
          default: {
            theme: "light",
          },
        },
      },
    };

    const formData = new FormData();
    formData.append("name", "John Doe");

    const parser = createParser(schema);
    const result = parser(formData);

    expect(result).toEqual({
      name: "John Doe",
      age: 0,
      isActive: false,
      preferences: {
        theme: "light",
      },
    });
  });

  it("should handle oneOf/anyOf schemas", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        notification: {
          oneOf: [
            {
              type: "object",
              properties: {
                type: { type: "string", default: "email" },
                email: { type: "string" },
                subject: { type: "string" },
              },
            },
            {
              type: "object",
              properties: {
                type: { type: "string", default: "sms" },
                phone: { type: "string" },
                message: { type: "string" },
              },
            },
          ],
        },
      },
    };

    const formData = new FormData();
    formData.append("notification.type", "email");
    formData.append("notification.email", "test@example.com");
    formData.append("notification.subject", "Test Subject");

    const parser = createParser(schema);
    const result = parser(formData);

    expect(result).toEqual({
      notification: {
        type: "email",
        email: "test@example.com",
        subject: "Test Subject",
      },
    });

    // Test SMS notification
    const formData2 = new FormData();
    formData2.append("notification.type", "sms");
    formData2.append("notification.phone", "+1234567890");
    formData2.append("notification.message", "Test Message");

    const result2 = parser(formData2);

    expect(result2).toEqual({
      notification: {
        type: "sms",
        phone: "+1234567890",
        message: "Test Message",
      },
    });
  });

  it("should parse nested object schema", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            address: {
              type: "object",
              properties: {
                street: { type: "string" },
                number: { type: "integer" },
              },
            },
          },
        },
      },
    };

    const formData = new FormData();
    formData.append("user.name", "John Doe");
    formData.append("user.address.street", "Main St");
    formData.append("user.address.number", "123");

    const parser = createParser(schema);
    const result = parser(formData);

    expect(result).toEqual({
      user: {
        name: "John Doe",
        address: {
          street: "Main St",
          number: 123,
        },
      },
    });
  });

  it("should parse array schema", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
        },
        scores: {
          type: "array",
          items: { type: "number" },
        },
      },
    };

    const formData = new FormData();
    formData.append("tags[0]", "typescript");
    formData.append("tags[1]", "javascript");
    formData.append("scores[0]", "95");
    formData.append("scores[1]", "88");

    const parser = createParser(schema);
    const result = parser(formData);

    expect(result).toEqual({
      tags: ["typescript", "javascript"],
      scores: [95, 88],
    });
  });
});
