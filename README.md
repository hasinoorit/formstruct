# FormStruct

A lightweight TypeScript library for parsing HTML form data into structured objects based on JSON Schema types. Designed to handle complex form inputs including multiselect, checkbox groups, and nullable fields.

## 📚 Table of Contents

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
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Version Compatibility](#version-compatibility)
- [Default Values](#default-values)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

- Parse FormData into structured JavaScript objects
- Support for complex form inputs (multiselect, checkbox groups)
- Handle nested objects and arrays with dot notation
- High performance with schema preprocessing
- Support for nullable fields and default values
- Clean and type-safe API

## 🚀 Installation

```bash
npm install formstruct
# or
yarn add formstruct
# or
pnpm add formstruct
```

## 🎯 Basic Usage

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

## 📝 Complete Form Example

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

## 🔧 Form Input Types

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

## 🔌 Schema Validator Integration

FormStruct can be used with popular schema validators by converting their schemas to JSON Schema. Here's how to use it with different validators:

### Using with Zod

```typescript
import { z } from "zod";
import { createParser } from "formstruct";
import { zodToJsonSchema } from "zod-to-json-schema";

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
      year: z.number(),
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

💡 **Tip**: Create a reusable Zod adapter:

```typescript
import type { z } from "zod";
import { createParser } from "formstruct";
import { zodToJsonSchema } from "zod-to-json-schema";

export const adapter = <T extends z.ZodType>(schema: T) => {
  return createParser<z.infer<T>>(zodToJsonSchema(schema));
};

// Usage
const parser = adapter(userSchema);
const result = parser(formData);
```

### Using with Valibot

```typescript
import * as v from "valibot";
import { createParser } from "formstruct";
import { toJsonSchema } from "@valibot/to-json-schema";

const userSchema = v.object({
  name: v.string(),
  age: v.number(),
  email: v.nullable(v.pipe(v.string(), v.email())),
  preferences: v.object({
    newsletter: v.boolean(),
    theme: v.union([v.literal("light"), v.literal("dark")]),
  }),
  books: v.array(
    v.object({
      title: v.string(),
      year: v.number(),
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

💡 **Tip**: Create a reusable Valibot adapter:

```typescript
import type { BaseSchema, Output } from "valibot";
import { createParser } from "formstruct";
import { toJsonSchema } from "@valibot/to-json-schema";

export const adapter = <T extends BaseSchema>(schema: T) => {
  return createParser<Output<T>>(toJsonSchema(schema));
};

// Usage
const parser = adapter(userSchema);
const result = parser(formData);
```

### Using with Yup

```typescript
import * as yup from "yup";
import { createParser } from "formstruct";
import { convertSchema } from "@sodaru/yup-to-json-schema";

const userSchema = yup.object({
  name: yup.string().required(),
  age: yup.number().required(),
  email: yup.string().email().nullable(),
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
        year: yup.number().required(),
      })
    )
    .required(),
  languages: yup.array().of(yup.string()).required(),
});

// Create type-safe parser
const parser = createParser<yup.InferType<typeof userSchema>>(
  convertSchema(userSchema)
);

// Parse form data
const result = parser(formData);
```

💡 **Tip**: Create a reusable Yup adapter:

```typescript
import type { Schema, InferType } from "yup";
import { createParser } from "formstruct";
import { convertSchema } from "@sodaru/yup-to-json-schema";

export const adapter = <T extends Schema>(schema: T) => {
  return createParser<InferType<T>>(convertSchema(schema));
};

// Usage
const parser = adapter(userSchema);
const result = parser(formData);
```

## 🛡️ Type Safety

All schema validators provide full type inference, giving you:

- Type checking for form data structure
- Autocomplete for object properties
- Type errors if you try to access non-existent properties
- Proper types for nullable fields and enums

## 📖 API Reference

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

## ❓ Troubleshooting

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

## 🚫 Limitations

FormStruct is designed to be a lightweight form data parser, not a full schema validator. Here are some important limitations to be aware of:

### Compound Schema Types (anyOf/oneOf/allOf)

- For primitive types (string, number, boolean), the parser will use the first schema from anyOf/oneOf/allOf
- For object/array types, it attempts to match the first schema based on property names
- If no matching schema is found for an object/array, the field will not be transformed

### Object Initialization

- Child objects are only initialized when at least one of their properties is present in the form data
- Default values in nested objects won't trigger object initialization if no form data is provided for that object path
- Nested default values are only applied when their parent object is initialized by form data

### Validation

- FormStruct does not perform schema validation
- It only handles data transformation according to the schema types

💡 **Tip**: For conditional validation, transform the data before passing it to a validator (FormData → FormStruct → Transform → Validate)

### Type Coercion

- Basic type coercion is performed (string to number/boolean)
- Complex type coercion (e.g., string to date) is not supported
- Custom formats are not validated

## 🔄 Version Compatibility

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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT
