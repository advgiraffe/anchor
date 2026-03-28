import { basename } from "node:path";
import { BaseExtractor, type ExtractedItem } from "./BaseExtractor.js";

export interface ExtractedSchema extends ExtractedItem {
	name: string;
	kind:
		| "prisma-model"
		| "zod-object"
		| "typeorm-entity"
		| "json-schema"
		| "ef-migration"
		| "sql-schema"
		| "openapi-schema"
		| "dotnet-contract";
}

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json", ".prisma", ".cs", ".sql", ".yaml", ".yml"];

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
			models.push(...this.extractEfMigrations(filePath, content));
			models.push(...this.extractSqlSchemas(filePath, content));
			models.push(...this.extractOpenApiSchemas(filePath, content));
			models.push(...this.extractDotNetContracts(filePath, content));
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

	private extractEfMigrations(filePath: string, content: string): ExtractedSchema[] {
		if (!filePath.toLowerCase().endsWith(".cs")) {
			return [];
		}

		const lower = filePath.toLowerCase();
		if (!lower.includes("/migrations/")) {
			return [];
		}

		const out: ExtractedSchema[] = [];
		const createTableRe = /CreateTable\s*\(\s*(?:name\s*:\s*)?["`]([A-Za-z0-9_]+)["`]/g;
		let createTableMatch: RegExpExecArray | null;
		while ((createTableMatch = createTableRe.exec(content)) !== null) {
			out.push(this.makeSchema(filePath, createTableMatch[1], "ef-migration"));
		}

		const modelSnapshotEntityRe = /\.Entity\s*\(\s*"[A-Za-z0-9_.]+\.([A-Za-z0-9_]+)"/g;
		let entityMatch: RegExpExecArray | null;
		while ((entityMatch = modelSnapshotEntityRe.exec(content)) !== null) {
			out.push(this.makeSchema(filePath, entityMatch[1], "ef-migration"));
		}

		return out;
	}

	private extractSqlSchemas(filePath: string, content: string): ExtractedSchema[] {
		if (!filePath.toLowerCase().endsWith(".sql")) {
			return [];
		}

		const lower = filePath.toLowerCase();
		if (!lower.includes("migration") && !lower.includes("schema")) {
			return [];
		}

		const out: ExtractedSchema[] = [];
		const createTableRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:\[[^\]]+\]\.)?(?:\[([^\]]+)\]|`([^`]+)`|"([^"]+)"|([A-Za-z0-9_]+))/gi;
		let match: RegExpExecArray | null;
		while ((match = createTableRe.exec(content)) !== null) {
			const table = match[1] ?? match[2] ?? match[3] ?? match[4];
			if (!table) continue;
			out.push(this.makeSchema(filePath, table, "sql-schema"));
		}

		return out;
	}

	private extractOpenApiSchemas(filePath: string, content: string): ExtractedSchema[] {
		const lower = filePath.toLowerCase();
		const isOpenApiLike =
			lower.includes("openapi") ||
			lower.endsWith("swagger.json") ||
			lower.endsWith("swagger.yaml") ||
			lower.endsWith("swagger.yml");
		if (!isOpenApiLike) {
			return [];
		}

		const out: ExtractedSchema[] = [];
		if (lower.endsWith(".json")) {
			const schemaNameRe = /"schemas"\s*:\s*\{([\s\S]*?)\}/g;
			let schemasBlock: RegExpExecArray | null;
			while ((schemasBlock = schemaNameRe.exec(content)) !== null) {
				const keyRe = /"([A-Za-z0-9_.-]+)"\s*:/g;
				let keyMatch: RegExpExecArray | null;
				while ((keyMatch = keyRe.exec(schemasBlock[1])) !== null) {
					out.push(this.makeSchema(filePath, keyMatch[1], "openapi-schema"));
				}
			}
		} else {
			const yamlSchemaNameRe = /^\s{2,}([A-Za-z0-9_.-]+):\s*$/gm;
			let keyMatch: RegExpExecArray | null;
			while ((keyMatch = yamlSchemaNameRe.exec(content)) !== null) {
				out.push(this.makeSchema(filePath, keyMatch[1], "openapi-schema"));
			}
		}

		return out;
	}

	private extractDotNetContracts(filePath: string, content: string): ExtractedSchema[] {
		if (!filePath.toLowerCase().endsWith(".cs")) {
			return [];
		}

		const lower = filePath.toLowerCase();
		if (
			!lower.includes("/contracts/") &&
			!lower.includes("/dto/") &&
			!lower.includes("/dtos/") &&
			!lower.includes("/viewmodels/")
		) {
			return [];
		}

		const out: ExtractedSchema[] = [];
		const typeRe = /\b(?:public|internal)\s+(?:partial\s+)?(?:record|class)\s+([A-Za-z0-9_]+)/g;
		let match: RegExpExecArray | null;
		while ((match = typeRe.exec(content)) !== null) {
			out.push(this.makeSchema(filePath, match[1], "dotnet-contract"));
		}

		return out;
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
