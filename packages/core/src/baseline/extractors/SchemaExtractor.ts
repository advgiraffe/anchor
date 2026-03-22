import { basename } from "node:path";
import { BaseExtractor, type ExtractedItem } from "./BaseExtractor.js";

export interface ExtractedSchema extends ExtractedItem {
	name: string;
	kind: "prisma-model" | "zod-object" | "typeorm-entity" | "json-schema";
}

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json", ".prisma"];

export class SchemaExtractor extends BaseExtractor {
	extract(sourcePath: string): ExtractedSchema[] {
		const files = this.listFiles(sourcePath, SOURCE_EXTENSIONS);
		const models: ExtractedSchema[] = [];

		for (const filePath of files) {
			const content = this.readTextFile(sourcePath, filePath);
			models.push(...this.extractPrismaModels(filePath, content));
			models.push(...this.extractZodSchemas(filePath, content));
			models.push(...this.extractTypeOrmEntities(filePath, content));
			models.push(...this.extractJsonSchemas(filePath, content));
		}

		return dedupeSchemas(models);
	}

	private extractPrismaModels(filePath: string, content: string): ExtractedSchema[] {
		if (!filePath.endsWith(".prisma")) return [];
		const out: ExtractedSchema[] = [];
		const re = /^\s*model\s+([A-Za-z0-9_]+)\s*\{/gm;
		let match: RegExpExecArray | null;
		while ((match = re.exec(content)) !== null) {
			out.push(this.makeSchema(filePath, match[1], "prisma-model"));
		}
		return out;
	}

	private extractZodSchemas(filePath: string, content: string): ExtractedSchema[] {
		if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) return [];
		const out: ExtractedSchema[] = [];
		const re = /(?:const|export\s+const)\s+([A-Za-z0-9_]+)\s*=\s*z\.object\s*\(/g;
		let match: RegExpExecArray | null;
		while ((match = re.exec(content)) !== null) {
			out.push(this.makeSchema(filePath, match[1], "zod-object"));
		}
		return out;
	}

	private extractTypeOrmEntities(filePath: string, content: string): ExtractedSchema[] {
		if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) return [];
		const out: ExtractedSchema[] = [];
		const re = /@Entity\s*\([^)]*\)?[\s\S]{0,120}?class\s+([A-Za-z0-9_]+)/g;
		let match: RegExpExecArray | null;
		while ((match = re.exec(content)) !== null) {
			out.push(this.makeSchema(filePath, match[1], "typeorm-entity"));
		}
		return out;
	}

	private extractJsonSchemas(filePath: string, content: string): ExtractedSchema[] {
		if (!filePath.endsWith(".json")) return [];
		const lower = filePath.toLowerCase();
		if (!lower.includes("schema")) return [];

		const titleMatch = content.match(/"title"\s*:\s*"([^"]+)"/);
		const name = titleMatch?.[1] ?? basename(filePath, ".json");
		return [this.makeSchema(filePath, name, "json-schema")];
	}

	private makeSchema(sourcePath: string, name: string, kind: ExtractedSchema["kind"]): ExtractedSchema {
		return {
			id: this.toId("schema", `${kind}-${name}`),
			title: name,
			sourcePath,
			name,
			kind,
			summary: `${name} (${kind})`,
			metadata: { kind },
		};
	}
}

function dedupeSchemas(schemas: ExtractedSchema[]): ExtractedSchema[] {
	const seen = new Set<string>();
	const out: ExtractedSchema[] = [];
	for (const schema of schemas) {
		const key = `${schema.kind}:${schema.name}`.toLowerCase();
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		out.push(schema);
	}
	return out;
}
