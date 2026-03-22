import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RouteExtractor } from "../../../src/baseline/extractors/RouteExtractor.js";
import { SchemaExtractor } from "../../../src/baseline/extractors/SchemaExtractor.js";
import { ScreenExtractor } from "../../../src/baseline/extractors/ScreenExtractor.js";
import { SectionGenerator } from "../../../src/baseline/SectionGenerator.js";

describe("RouteExtractor", () => {
	it("extracts express and next app router routes", () => {
		const dir = mkdtempSync(join(tmpdir(), "anchor-routes-"));
		try {
			mkdirSync(join(dir, "src"), { recursive: true });
			mkdirSync(join(dir, "app", "api", "users"), { recursive: true });

			writeFileSync(
				join(dir, "src", "server.ts"),
				[
					"import express from 'express';",
					"const app = express();",
					"app.get('/health', (_req, res) => res.send('ok'));",
					"app.post('/users', (_req, res) => res.status(201).send({}));",
				].join("\n"),
				"utf8",
			);

			writeFileSync(
				join(dir, "app", "api", "users", "route.ts"),
				[
					"export async function GET() { return new Response('ok'); }",
					"export async function POST() { return new Response('ok'); }",
				].join("\n"),
				"utf8",
			);

			const routes = new RouteExtractor().extract(dir);
			const routeTitles = routes.map((route) => route.title);

			expect(routeTitles).toContain("GET /health");
			expect(routeTitles).toContain("POST /users");
			expect(routeTitles).toContain("GET /users");
			expect(routeTitles).toContain("POST /users");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("SchemaExtractor", () => {
	it("extracts prisma, zod, typeorm and json schema models", () => {
		const dir = mkdtempSync(join(tmpdir(), "anchor-schema-"));
		try {
			mkdirSync(join(dir, "prisma"), { recursive: true });
			mkdirSync(join(dir, "src"), { recursive: true });
			mkdirSync(join(dir, "schemas"), { recursive: true });

			writeFileSync(
				join(dir, "prisma", "schema.prisma"),
				"model User { id Int @id }\nmodel Post { id Int @id }\n",
				"utf8",
			);

			writeFileSync(
				join(dir, "src", "contracts.ts"),
				[
					"import { z } from 'zod';",
					"export const LoginPayload = z.object({ email: z.string() });",
					"@Entity()",
					"export class AccountEntity {}",
				].join("\n"),
				"utf8",
			);

			writeFileSync(
				join(dir, "schemas", "invoice.schema.json"),
				JSON.stringify({ title: "Invoice" }),
				"utf8",
			);

			const schemas = new SchemaExtractor().extract(dir);
			const names = schemas.map((schema) => schema.name);
			expect(names).toContain("User");
			expect(names).toContain("Post");
			expect(names).toContain("LoginPayload");
			expect(names).toContain("AccountEntity");
			expect(names).toContain("Invoice");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("ScreenExtractor", () => {
	it("extracts next pages and react screens", () => {
		const dir = mkdtempSync(join(tmpdir(), "anchor-screen-"));
		try {
			mkdirSync(join(dir, "app", "dashboard"), { recursive: true });
			mkdirSync(join(dir, "src", "screens"), { recursive: true });

			writeFileSync(
				join(dir, "app", "dashboard", "page.tsx"),
				"export default function DashboardPage() { return <div />; }",
				"utf8",
			);

			writeFileSync(
				join(dir, "src", "screens", "LoginScreen.tsx"),
				"export default function LoginScreen() { return <div />; }",
				"utf8",
			);

			const screens = new ScreenExtractor().extract(dir);
			const names = screens.map((screen) => screen.name);
			expect(names).toContain("dashboard");
			expect(names).toContain("LoginScreen");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("SectionGenerator", () => {
	it("includes api/data/screen outputs from extractors", () => {
		const dir = mkdtempSync(join(tmpdir(), "anchor-sections-"));
		try {
			mkdirSync(join(dir, "src"), { recursive: true });
			mkdirSync(join(dir, "app", "api", "orders"), { recursive: true });
			mkdirSync(join(dir, "prisma"), { recursive: true });

			writeFileSync(join(dir, "src", "server.ts"), "app.get('/orders', () => {});", "utf8");
			writeFileSync(
				join(dir, "app", "api", "orders", "route.ts"),
				"export function GET(){ return new Response('ok'); }",
				"utf8",
			);
			writeFileSync(join(dir, "prisma", "schema.prisma"), "model Order { id Int @id }", "utf8");
			writeFileSync(
				join(dir, "src", "OrdersScreen.tsx"),
				"export default function OrdersScreen() { return <div/>; }",
				"utf8",
			);

			const sections = new SectionGenerator().generate({ sourcePath: dir, targets: [] });
			const paths = sections.map((section) => section.path);

			expect(paths).toContain("api/endpoints.md");
			expect(paths).toContain("data/models.md");
			expect(paths.some((path) => path.startsWith("screens/"))).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
