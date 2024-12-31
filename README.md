# FormStruct

A lightweight TypeScript library for parsing HTML form data into structured objects based on JSON Schema types. Designed to handle complex form inputs including multiselect, checkbox groups, and nullable fields.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Complete Form Example](#complete-form-example)
- [Form Input Types](#form-input-types)
- [Schema Validator Integration](#schema-validator-integration)
  - [Using with Zod](#using-with-zod)
  - [Using with Valibot](#using-with-valibot)
  - [Using with Yup](#using-with-yup)
- [Type Safety](#type-safety)
- [API Reference](#api-reference)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [Version Compatibility](#version-compatibility)
- [Default Values](#default-values)
- [Contributing](#contributing)
- [License](#license)

## Features

- Parse FormData into structured JavaScript objects
- Support for complex form inputs (multiselect, checkbox groups)
- Handle nested objects and arrays with dot notation
- High performance with schema preprocessing
- Support for nullable fields and default values
- Clean and type-safe API

## Installation

```bash
npm install formstruct
# or
yarn add formstruct
# or
pnpm add formstruct
```

## Basic Usage

```typescript
import { createParser } from "formstruct";

// Define your schema
const schema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
    email: {
      anyOf: [{ type: "string", format: "email" }, { type: "null" }],
    },
    preferences: {
      type: "object",
      properties: {
        newsletter: { type: "boolean" },
        theme: { type: "string", enum: ["light", "dark"] },
      },
      required: ["newsletter", "theme"],
    },
    books: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
        },
        required: ["title", "author"],
      },
    },
    languages: { type: "array", items: { type: "string" } },
  },
  required: ["name", "age", "email", "preferences", "books", "languages"],
};

// Create parser
const parser = createParser(schema);

// Parse form data
const formData = new FormData();
formData.append("name", "John Doe");
formData.append("age", "30");
formData.append("email", "john@example.com");
formData.append("preferences.newsletter", "true");
formData.append("preferences.theme", "dark");
formData.append("books[0].title", "Clean Code");
formData.append("books[0].author", "Robert Martin");
formData.append("books[1].title", "TypeScript Handbook");
formData.append("books[1].author", "Microsoft");
formData.append("languages", "typescript");
formData.append("languages", "rust");

const result = parser(formData);
/* Result:
{
  name: "John Doe",
  age: 30,
  email: "john@example.com",
  preferences: {
    newsletter: true,
    theme: "dark"
  },
  books: [
    {
      title: "Clean Code",
      author: "Robert Martin"
    },
    {
      title: "TypeScript Handbook",
      author: "Microsoft"
    }
  ],
  languages: ["typescript", "rust"]
}
*/
```

## Complete Form Example

```html
<form id="userProfileForm">
  <!-- Basic Fields -->
  <input type="text" name="name" required />
  <input type="number" name="age" required />

  <!-- Nullable Email -->
  <input type="email" name="email" />
  <!-- Can be empty -->

  <!-- Preferences (Required Object) -->
  <div>
    <input type="checkbox" name="preferences.newsletter" required />
    <select name="preferences.theme" required>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </div>

  <!-- Books Array (Required) -->
  <div>
    <input type="text" name="books[0].title" required />
    <input type="text" name="books[0].author" required />
    <!-- Add more book fields dynamically -->
  </div>

  <!-- Languages (Multiple Select) -->
  <select name="languages" multiple required>
    <option value="javascript">JavaScript</option>
    <option value="typescript">TypeScript</option>
    <option value="python">Python</option>
    <option value="rust">Rust</option>
  </select>
</form>
```

## Form Input Types

### Basic Fields

```html
<input type="text" name="name" required />
<input type="number" name="age" required />
```

### Nullable Fields

```html
<input type="email" name="email" />
<!-- Empty string will be parsed as null if schema allows -->
```

### Nested Objects

```html
<input type="checkbox" name="preferences.newsletter" required />
<select name="preferences.theme" required>
  <option value="light">Light</option>
  <option value="dark">Dark</option>
</select>
```

### Multiple Select

```html
<select name="languages" multiple required>
  <option value="typescript">TypeScript</option>
  <option value="rust">Rust</option>
</select>
```

## Schema Validator Integration

FormStruct can be used with popular schema validators by converting their schemas to JSON Schema. Here's how to use it with different validators:

### Using with Zod

```typescript
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createParser } from "formstruct";

const userSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email().nullable(),
  preferences: z.object({
    newsletter: z.boolean(),
    theme: z.enum(["light", "dark"]),
  }),
  books: z.array(
    z.object({
      title: z.string(),
      author: z.string(),
    })
  ),
  languages: z.array(z.string()),
});

// Create type-safe parser
const parser = createParser<z.infer<typeof userSchema>>(
  zodToJsonSchema(userSchema)
);

// Parse form data
const result = parser(formData);
```

### Using with Valibot

```typescript
import * as v from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";
import { createParser } from "formstruct";

const userSchema = v.object({
  name: v.string(),
  age: v.number(),
  email: v.nullable(v.pipe(v.string(), v.email())),
  preferences: v.object({
    newsletter: v.boolean(),
    theme: v.pipe(
      v.string(),
      v.enum({
        light: "light",
        dark: "dark",
      })
    ),
  }),
  books: v.array(
    v.object({
      title: v.string(),
      author: v.string(),
    })
  ),
  languages: v.array(v.string()),
});

// Create type-safe parser
const parser = createParser<v.Output<typeof userSchema>>(
  toJsonSchema(userSchema)
);

// Parse form data
const result = parser(formData);
```

### Using with Yup

```typescript
import * as yup from "yup";
import { convertSchema } from "@sodaru/yup-to-json-schema";
import { createParser } from "formstruct";

const userSchema = yup.object({
  name: yup.string().required(),
  age: yup.number().required(),
  email: yup.string().email().nullable().required(),
  preferences: yup
    .object({
      newsletter: yup.boolean().required(),
      theme: yup.string().oneOf(["light", "dark"]).required(),
    })
    .required(),
  books: yup
    .array()
    .of(
      yup.object({
        title: yup.string().required(),
        author: yup.string().required(),
      })
    )
    .required(),
  languages: yup.array().of(yup.string()).required(),
});

// Create type-safe parser
const parser = createParser<yup.InferType<typeof userSchema>>(
  convertSchema(userSchema)
);
```

## Type Safety

All schema validators provide full type inference, giving you:

- Type checking for form data structure
- Autocomplete for object properties
- Type errors if you try to access non-existent properties
- Proper types for nullable fields and enums

## API Reference

### `createParser(schema: JSONSchema7)`

Creates a parser function based on the provided JSON Schema.

#### Parameters

- `schema`: A valid JSON Schema (version 7) that describes the expected structure of your data.

#### Returns

- A parser function that takes `FormData` as input and returns a structured object.

### Form Data Naming Convention

- Use dot notation for nested objects: `preferences.theme`
- Use array notation for arrays: `books[0].title`
- Multiple values for the same name become arrays: `languages`

## Error Handling

FormStruct provides detailed error messages when parsing fails:

```typescript
try {
  const result = parser(formData);
} catch (error) {
  if (error instanceof ValidationError) {
    // Structured validation errors
    console.error("Validation failed:", error.errors);
    // Example: { field: "age", message: "Expected number, got string" }
  } else if (error instanceof SchemaError) {
    // Schema configuration errors
    console.error("Schema error:", error.message);
    // Example: "Invalid schema: missing required property type"
  } else {
    // Unexpected errors
    console.error("Parser error:", error);
  }
}
```

Common validation errors:

- Missing required fields
- Invalid field types
- Failed format validation (e.g., email)
- Array length constraints
- Enum value mismatches

## Troubleshooting

### Common Issues

1. **Form Data Not Parsing**

   ```typescript
   // ❌ Wrong
   formData.append("preferences", JSON.stringify({ theme: "dark" }));

   // ✅ Correct
   formData.append("preferences.theme", "dark");
   ```

2. **Array Handling**

   ```typescript
   // ❌ Wrong
   formData.append("books", JSON.stringify([{ title: "Book" }]));

   // ✅ Correct
   formData.append("books[0].title", "Book");
   ```

3. **Nullable Fields**

   ```typescript
   // ❌ Wrong: Schema doesn't allow null
   const schema = { email: { type: "string" } };

   // ✅ Correct: Schema allows null
   const schema = {
     email: { anyOf: [{ type: "string" }, { type: "null" }] },
   };
   ```

4. **Type Coercion**

   ```typescript
   // ❌ Wrong: String won't be coerced to number
   const schema = { age: { type: "string" } };

   // ✅ Correct: String will be coerced to number
   const schema = { age: { type: "number" } };
   ```

## Version Compatibility

| FormStruct | Node.js  | TypeScript |
| ---------- | -------- | ---------- |
| 1.x        | ≥ 12.0.0 | ≥ 4.5.0    |

### Browser Support

Supports all modern browsers that implement:

- FormData API (ES2017)
- Optional chaining and nullish coalescing (ES2020)
- Array methods (find, push)
- Template literals

Minimum versions:

- Chrome ≥ 85
- Firefox ≥ 88
- Safari ≥ 14
- Edge ≥ 85

For older browsers, you may need a polyfill for:

- Optional chaining (?.)
- Nullish coalescing (??)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
