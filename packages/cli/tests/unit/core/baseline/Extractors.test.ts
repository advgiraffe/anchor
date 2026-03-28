import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RouteExtractor } from "../../../../src/core/baseline/extractors/RouteExtractor.js";
import { SchemaExtractor } from "../../../../src/core/baseline/extractors/SchemaExtractor.js";
import { ScreenExtractor } from "../../../../src/core/baseline/extractors/ScreenExtractor.js";
import { SectionGenerator } from "../../../../src/core/baseline/SectionGenerator.js";

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

	it("extracts ASP.NET minimal API routes and Razor pages", () => {
		const dir = mkdtempSync(join(tmpdir(), "anchor-routes-dotnet-"));
		try {
			mkdirSync(join(dir, "Api"), { recursive: true });
			mkdirSync(join(dir, "Web", "Pages", "Accounts"), { recursive: true });

			writeFileSync(
				join(dir, "Api", "Program.cs"),
				[
					"var api = app.MapGroup(\"/api\");",
					"api.MapGet(\"/health\", () => Results.Ok());",
					"api.MapPost(\"/orders\", () => Results.Ok());",
					"app.MapMethods(\"/status\", [\"GET\", \"HEAD\"], () => Results.Ok());",
				].join("\n"),
				"utf8",
			);

			writeFileSync(
				join(dir, "Web", "Pages", "Accounts", "Login.cshtml"),
				["@page \"/signin\"", "<h1>Sign in</h1>"].join("\n"),
				"utf8",
			);

			const routes = new RouteExtractor().extract(dir);
			const routeTitles = routes.map((route) => route.title);

			expect(routeTitles).toContain("GET /api/health");
			expect(routeTitles).toContain("POST /api/orders");
			expect(routeTitles).toContain("GET /status");
			expect(routeTitles).toContain("HEAD /status");
			expect(routeTitles).toContain("GET /signin");
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

	it("extracts migration-first schemas and contract DTOs for .NET projects", () => {
		const dir = mkdtempSync(join(tmpdir(), "anchor-schema-dotnet-"));
		try {
			mkdirSync(join(dir, "Api", "Migrations"), { recursive: true });
			mkdirSync(join(dir, "Api", "Contracts"), { recursive: true });
			mkdirSync(join(dir, "db", "migrations"), { recursive: true });
			mkdirSync(join(dir, "Api", "openapi"), { recursive: true });

			writeFileSync(
				join(dir, "Api", "Migrations", "20260301_AddUsers.cs"),
				[
					"public partial class AddUsers : Migration",
					"{",
					"    protected override void Up(MigrationBuilder migrationBuilder)",
					"    {",
					"        migrationBuilder.CreateTable(name: \"Users\", columns: table => new { });",
					"    }",
					"}",
				].join("\n"),
				"utf8",
			);

			writeFileSync(
				join(dir, "db", "migrations", "001_init.sql"),
				"CREATE TABLE Orders (Id INT PRIMARY KEY);",
				"utf8",
			);

			writeFileSync(
				join(dir, "Api", "Contracts", "OrderDto.cs"),
				"public record OrderDto(int Id, decimal Total);",
				"utf8",
			);

			writeFileSync(
				join(dir, "Api", "openapi", "openapi.yaml"),
				[
					"openapi: 3.0.0",
					"components:",
					"  schemas:",
					"    TradeRequest:",
					"      type: object",
				].join("\n"),
				"utf8",
			);

			const schemas = new SchemaExtractor().extract(dir);
			const names = schemas.map((schema) => schema.name);
			expect(names).toContain("Users");
			expect(names).toContain("Orders");
			expect(names).toContain("OrderDto");
			expect(names).toContain("TradeRequest");
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

	it("extracts Razor pages, MVC views, and Blazor components", () => {
		const dir = mkdtempSync(join(tmpdir(), "anchor-screen-dotnet-"));
		try {
			mkdirSync(join(dir, "Web", "Pages", "Trades"), { recursive: true });
			mkdirSync(join(dir, "Web", "Views", "Reports"), { recursive: true });
			mkdirSync(join(dir, "Web", "Components"), { recursive: true });

			writeFileSync(
				join(dir, "Web", "Pages", "Trades", "Index.cshtml"),
				"@page\n<h1>Trades</h1>",
				"utf8",
			);

			writeFileSync(
				join(dir, "Web", "Views", "Reports", "Summary.cshtml"),
				"<h1>Summary</h1>",
				"utf8",
			);

			writeFileSync(
				join(dir, "Web", "Components", "Dashboard.razor"),
				"<h1>Dashboard</h1>",
				"utf8",
			);

			const screens = new ScreenExtractor().extract(dir);
			const kinds = screens.map((screen) => screen.kind);
			expect(kinds).toContain("razor-page");
			expect(kinds).toContain("razor-view");
			expect(kinds).toContain("blazor-component");
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
