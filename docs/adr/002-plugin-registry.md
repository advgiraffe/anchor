# ADR 002: Plugin Registry And Strategy-Based Extractors

## Status

Accepted

## Context

Baseline extraction must support multiple frameworks and languages over time.
Packing every framework rule into one extractor class is not maintainable and leads
to fragile heuristics. Recent findings showed that convention-only approaches (for
example class-name assumptions) miss real-world projects, especially mixed
repositories that combine ASP.NET Core APIs and Razor Pages frontends.

## Decision

Anchor adopts a plugin registry with strategy-based extractors:

1. Extraction logic is split into focused strategies (routes, schemas, screens)
	per framework.
2. Strategies must use framework-declared evidence as primary signals
	(API mapping calls, routing directives, schema artifacts), not naming
	conventions.
3. Built-in strategies include Node/TypeScript ecosystems and ASP.NET Core
	endpoint routing + Razor Pages.
4. Additional ecosystems can be registered without modifying core extractor
	classes.
5. Cross-language subprocess extractors (JSON-over-stdin) remain the extensibility
	path for broader language support in a later phase.

## Consequences

### Positive

- Better precision in real repositories where naming conventions are inconsistent.
- Clear extension path for new frameworks without creating a monolithic extractor.
- Improved support for mixed mono-repos with multiple project types.

### Tradeoffs

- More moving parts than a single extractor file.
- Requires registry wiring and strategy ordering rules.
- Needs test coverage per strategy to avoid silent detection gaps.

## Follow-up Requirements

1. Baseline docs must specify evidence-first detection rules.
2. Route detection must include ASP.NET Core endpoint mapping patterns.
3. Screen detection must include Razor Pages default and templated routing.
4. Schema detection must prioritize migration/schema artifacts over class names.
