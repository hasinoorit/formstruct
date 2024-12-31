import type { JSONSchema7 as Schema, JSONSchema7Definition } from "./types";

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

export const createParser = <T = any>(schema: Schema) => {
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

export const adapter = <T = any>(schema: Schema) => {
  return createParser<T>(schema);
};
