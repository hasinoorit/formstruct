# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2024-12-31

### Fixed

- Fixed schema variable reference handling during optimization
  - Resolved issue with schema preprocessing that affected variable references
  - Improved schema optimization for better reference handling
  - Fixed edge cases in nested schema references

## [1.0.1] - 2024-12-31

### Added

- Added comprehensive JSDoc documentation to all functions in the codebase
  - Enhanced code documentation for `enhanceSchema`, `getByNext`, `getCurrentSchema`, `getDefault`, `parseValue`, `setNestedValue`, and `createParser` functions
  - Improved code maintainability and developer experience with detailed function descriptions, parameter documentation, and return value specifications
- Added support for JSON Schema `$ref` keyword
  - Implemented schema reference resolution with `resolveRef` and `normalizeSchema` functions
  - Allows using `$ref` to reference definitions within the schema
  - Improved schema handling by automatically resolving and normalizing references

## [1.0.0] - Initial Release

### Added

- Initial release of formstruct
- Core functionality to transform form data into structured objects using JSON Schema
- Support for nested objects and arrays
- Type conversion based on schema definitions
- Default value handling
- Schema enhancement utilities
