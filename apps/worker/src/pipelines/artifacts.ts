import fs from "node:fs";
import path from "node:path";
import type { JudgeResult } from "./base.pipeline.js";

export function collectArtifacts(artifactsDir: string): JudgeResult["artifacts"] {
	const artifacts: JudgeResult["artifacts"] = [];

	if (!fs.existsSync(artifactsDir)) {
		return artifacts;
	}

	const realArtifactsDir = fs.realpathSync(artifactsDir);
	const entries = fs.readdirSync(artifactsDir, {
		recursive: true,
		withFileTypes: false
	}) as string[];

	for (const entry of entries) {
		const fullPath = path.join(artifactsDir, entry);
		const stat = fs.lstatSync(fullPath);
		if (stat.isSymbolicLink() || !stat.isFile()) {
			continue;
		}

		const realPath = fs.realpathSync(fullPath);
		if (realPath !== realArtifactsDir && !realPath.startsWith(`${realArtifactsDir}${path.sep}`)) {
			continue;
		}

		const ext = path.extname(entry).toLowerCase();
		const type = ext === ".png" || ext === ".jpg" ? ("screenshot" as const) : ("log" as const);
		artifacts.push({ type, name: entry, localPath: realPath });
	}

	return artifacts;
}
