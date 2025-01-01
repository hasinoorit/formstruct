import type { JSONSchema7 as Schema, JSONSchema7Definition } from "./types";
/**
 * Creates a parser that can be used to transform form data into structured objects based on the provided JSON schema.
 * @param schema - The JSON schema to use for parsing.
 * @returns A parser function that takes a FormData object and returns a parsed object conforming to the schema.
 * @throws If the schema is invalid.
 */

const resolveRef = (
  schema: JSONSchema7Definition,
  rootSchema: JSONSchema7Definition,
  visited: Set<JSONSchema7Definition> = new Set()
): void => {
  if (
    typeof schema !== "object" ||
    typeof rootSchema !== "object" ||
    visited.has(schema)
  ) {
    return;
  }
  visited.add(schema);
  if ("$ref" in schema && typeof schema.$ref === "string") {
    const ref = schema.$ref;
    if (ref === "#") {
      Object.setPrototypeOf(schema, rootSchema);
      return;
    }
    // Handle circular references
    // If the $ref is a relative reference (starts with '#')
    if (ref.startsWith("#")) {
      // Resolve the reference within the root schema
      const path = ref.slice(2).split("/"); // Remove "#/" and split by '/'
      let resolved = rootSchema;

      // Traverse through the root schema based on the path
      for (const segment of path) {
        resolved = resolved[segment];
        if (!resolved) {
          throw new Error(`Unable to resolve reference: ${ref}`);
        }
      }

      // Replace the $ref with the resolved schema
      Object.setPrototypeOf(schema, resolved);
      delete schema.$ref; // Remove $ref from the schema as it's now resolved
    }
  }

  // Recursively traverse the schema
  for (const key in schema) {
    const subSchema = schema[key];
    if (subSchema && typeof subSchema === "object") {
      if (Array.isArray(subSchema)) {
        subSchema.forEach((item: any) => resolveRef(item, rootSchema, visited));
      } else {
        resolveRef(subSchema, rootSchema, visited);
      }
    }
  }
};

/**
 * Enhances a JSON Schema by adding additional metadata and default values.
 * Handles object properties, arrays, and adds prefilled values for certain types.
 *
 * @param schema - The JSON Schema to enhance
 */
const enhanceSchema = (schema: JSONSchema7Definition) => {
  if (typeof schema === "boolean") {
    return schema;
  }
  if (schema.type === "object" && schema.properties) {
    const prefilled: Record<string, any> = {};
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (typeof subSchema === "boolean") continue;
      if (subSchema.anyOf || subSchema.oneOf || subSchema.allOf) {
        const nullable = (
          subSchema.anyOf ||
          subSchema.oneOf ||
          subSchema.allOf
        )?.some((s) => typeof s === "object" && s.type === "null");
        if (nullable) {
          prefilled[key] = null;
          subSchema.nullable = true;
        }
      } else if (subSchema.type === "null") {
        prefilled[key] = null;
      } else if (subSchema.type === "boolean") {
        prefilled[key] = false;
      } else if (subSchema.type === "array") {
        Object.defineProperty(prefilled, key, {
          get() {
            return [];
          },
          enumerable: true,
        });
      }
      if ("default" in subSchema) {
        prefilled[key] = JSON.parse(JSON.stringify(subSchema.default));
      }
    }
    schema.prefilled = prefilled;
  } else if (schema.type === "array" && schema.items) {
    if (Array.isArray(schema.items)) {
      schema.items.forEach((item) => enhanceSchema(item));
    } else {
      enhanceSchema(schema.items);
    }
  }
  if ("$defs" in schema && typeof schema.$defs === "object") {
    for (const [_, value] of Object.entries(schema.$defs)) {
      enhanceSchema(value);
    }
  }
  if ("definitions" in schema && typeof schema.definitions === "object") {
    for (const [_, value] of Object.entries(schema.definitions)) {
      enhanceSchema(value);
    }
  }
};

/**
 * Gets a schema from an array of schemas based on the next key/index.
 *
 * @param schema - The schema or array of schemas to search through
 * @param next - Optional next key or index to help determine which schema to return
 * @returns The matching schema or an empty object if none found
 */
function getByNext(schema: Schema[] | Schema, next?: number | string): Schema {
  if (!Array.isArray(schema)) {
    return schema;
  }
  if (typeof next === "undefined") {
    return schema[0] || {};
  }
  if (typeof next === "number") {
    return schema.find((s) => !!s.items) || {};
  }
  return schema.find((s) => !!s.properties?.[next]) || {};
}

/**
 * Gets the current schema for a given key path, handling nested objects and arrays.
 *
 * @param schema - The parent schema to search in
 * @param key - The current key or index being accessed
 * @param nextKey - Optional next key in the path for better schema resolution
 * @returns The schema for the current key path
 */
const getCurrentSchema = (
  schema: Schema,
  key: number | string,
  nextKey?: number | string
): Schema => {
  // if (schema.anyOf || schema.oneOf || schema.allOf) {
  //   return getByNext(schema.anyOf || schema.oneOf || schema.allOf!, nextKey);
  // }
  if (
    schema.type === "object" &&
    schema.properties &&
    key in schema.properties
  ) {
    const _schema = schema.properties[key] as Schema;
    const fromMultiple = _schema.anyOf || _schema.oneOf || _schema.allOf;
    if (fromMultiple) {
      const nullable = !!_schema.nullable;
      return { ...getByNext(fromMultiple as Schema[], nextKey), nullable };
    }
    return _schema;
  }
  if (schema.type === "array" && schema.items) {
    return getByNext(schema.items as any, nextKey);
  }
  return {};
};

/**
 * Gets the default value for a schema based on its type and properties.
 *
 * @param schema - The schema to get the default value for
 * @returns The default value for the schema, or undefined if no default can be determined
 */
const getDefault = (schema: Schema) => {
  if (schema.prefilled) {
    return { ...schema.prefilled };
  }
  if (typeof schema === "object") {
    if (typeof schema.default !== "undefined") {
      return schema.default;
    }
    if (schema.type === "object") {
      const props = schema.properties || {};
      const defaults: Record<string, any> = {};
      for (const key in props) {
        if (Object.prototype.hasOwnProperty.call(props, key)) {
          const element = props[key];
          if (typeof element === "boolean") {
            continue;
          }
          if (typeof element.default !== "undefined") {
            defaults[key] = element.default;
          } else if (element.type === "boolean") {
            defaults[key] = false;
          } else if (element.anyOf || element.oneOf || element.allOf) {
            const nullable = (
              element.anyOf ||
              element.oneOf ||
              element.allOf
            )?.some((s) => typeof s === "object" && s.type === "null");
            if (nullable) {
              defaults[key] = null;
            }
          }
        }
      }
      return defaults;
    }
    if (schema.type === "array") {
      return [];
    }
  }
};

/**
 * Parses a form data value according to the schema type.
 *
 * @param schema - The schema defining the expected type
 * @param value - The form data value to parse
 * @returns The parsed value according to the schema type
 */
const parseValue = (schema: Schema, value: FormDataEntryValue) => {
  if (schema.nullable && value === "") {
    return null;
  }
  if (typeof schema === "object" && schema.type) {
    switch (schema.type) {
      case "boolean":
        return value == "on" || value == "true";
      case "integer":
      case "number":
        return Number(value);
      case "string":
        return value.toString();
      case "array":
        return parseValue(getByNext(schema.items as any) as Schema, value);
      default:
        return value;
    }
  }
  return value;
};

/**
 * Sets a nested value in an object based on an array of keys.
 * Creates intermediate objects/arrays as needed and handles type conversion.
 *
 * @param schema - The schema for type validation
 * @param rootObject - The root object to set the value in
 * @param keys - Array of keys representing the path to the value
 * @param value - The form data value to set
 */
const setNestedValue = (
  schema: Schema,
  rootObject: any,
  keys: (string | number)[],
  value: FormDataEntryValue
) => {
  let current = rootObject;
  let currentSchema = schema;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];
    currentSchema = getCurrentSchema(currentSchema, key, nextKey);
    if (!current[key]) {
      const defaultValue = getDefault(currentSchema);
      if (defaultValue) {
        current[key] = defaultValue;
      } else {
        current[key] = Number.isInteger(Number(nextKey)) ? [] : {};
      }
    }
    current = current[key];
  }
  const key = keys[keys.length - 1];
  const finalSchema = getCurrentSchema(currentSchema, key);
  if (
    (finalSchema.type === "array" || finalSchema.type === "object") &&
    !current[key]
  ) {
    current[key] = getDefault(finalSchema);
  }
  const parsedValue = parseValue(finalSchema, value);
  if (Array.isArray(current[key])) {
    current[key].push(parsedValue);
  } else {
    current[key] = parsedValue;
  }
};

/**
 * Creates a form data parser based on a JSON Schema.
 * The parser converts FormData into a typed object structure.
 *
 * @param schema - The JSON Schema to use for parsing
 * @returns A function that converts FormData into the schema-defined type T
 * @template T - The type of the resulting parsed object
 */
export const createParser = <T = any>(schema: Schema) => {
  resolveRef(schema, schema);
  enhanceSchema(schema);
  return (formData: FormData): T => {
    const root: any = getDefault(schema);
    formData.forEach((value, key) => {
      const keys = key.replace(/\[(\d+)]/g, ".$1").split(".");
      setNestedValue(schema, root, keys, value);
    });
    return root as T;
  };
};
