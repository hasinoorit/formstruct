import type { JSONSchema7 as Schema, JSONSchema7Definition } from "./types";

/**
 * Resolves a $ref within a schema using the root schema.
 *
 * @param ref - The $ref string to resolve.
 * @param rootSchema - The root schema containing all definitions.
 * @returns The resolved schema.
 */
function resolveRef(ref: string, rootSchema: Schema): Schema {
  const refPath = ref.replace(/^#\//, "").split("/");
  let resolvedSchema: any = rootSchema;
  for (const key of refPath) {
    resolvedSchema = resolvedSchema[key];
    if (!resolvedSchema) {
      throw new Error(`Unable to resolve $ref: ${ref}`);
    }
  }
  return resolvedSchema;
}

/**
 * Recursively resolves $ref and normalizes a schema.
 *
 * @param schema - The schema to resolve.
 * @param rootSchema - The root schema containing all definitions.
 * @returns The normalized schema.
 */
function resolve(schema: Schema, rootSchema: Schema): Schema {
  if (schema.$ref) {
    const resolvedSchema = resolveRef(schema.$ref, rootSchema);
    return {
      ...resolve(resolvedSchema, rootSchema),
      ...schema,
      $ref: undefined,
    };
  }

  if (schema.type === "object" && schema.properties) {
    const normalizedProperties: Record<string, Schema> = {};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      normalizedProperties[key] = resolve(propSchema as Schema, rootSchema);
    }
    return { ...schema, properties: normalizedProperties };
  }

  if (schema.type === "array" && schema.items) {
    return { ...schema, items: resolve(schema.items as Schema, rootSchema) };
  }

  return schema;
}

/**
 * Normalizes a JSON Schema by resolving all $ref references.
 *
 * @param schema - The JSON Schema to normalize.
 * @param rootSchema - The root schema containing all definitions.
 * @returns The normalized schema.
 */
function normalizeSchema(schema: Schema, rootSchema: Schema): Schema {
  return resolve(schema, rootSchema);
}

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
        prefilled[key] = [];
      }
      if (Object.prototype.hasOwnProperty.call(subSchema, "default")) {
        prefilled[key] = subSchema.default;
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
  const _schema = normalizeSchema(schema, schema);
  enhanceSchema(_schema);
  return (formData: FormData): T => {
    const root: any = getDefault(_schema);
    formData.forEach((value, key) => {
      const keys = key.replace(/\[(\d+)]/g, ".$1").split(".");
      setNestedValue(_schema, root, keys, value);
    });
    return root as T;
  };
};
