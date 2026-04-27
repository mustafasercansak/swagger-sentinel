import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const sourceLogoPath = path.join(rootDir, "assets", "logo.png");
const targetLogoPath = path.join(rootDir, "assets", "logo-versioned.png");
const vscodeTargetLogoPath = path.join(
	rootDir,
	"packages",
	"vscode",
	"assets",
	"logo-versioned.png",
);

function readVersion() {
	const packageCandidates = [
		path.join(rootDir, "packages", "core", "package.json"),
		path.join(rootDir, "package.json"),
	];

	for (const packagePath of packageCandidates) {
		if (!fs.existsSync(packagePath)) continue;
		const parsed = JSON.parse(fs.readFileSync(packagePath, "utf8"));
		if (
			typeof parsed.version === "string" &&
			parsed.version.trim().length > 0
		) {
			return parsed.version.trim();
		}
	}

	throw new Error("Version not found in package.json files.");
}

function escapeXml(value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

async function main() {
	if (!fs.existsSync(sourceLogoPath)) {
		throw new Error(`Logo source not found: ${sourceLogoPath}`);
	}

	const version = `v${readVersion()}`;
	const image = sharp(sourceLogoPath);
	const metadata = await image.metadata();
	const width = metadata.width ?? 512;
	const height = metadata.height ?? 512;

	const fontSize = Math.max(10, Math.round(width * 0.037));
	const paddingX = Math.max(7, Math.round(fontSize * 0.6));
	const paddingY = Math.max(4, Math.round(fontSize * 0.38));
	const radius = Math.max(6, Math.round(fontSize * 0.7));
	const marginX = Math.max(10, Math.round(width * 0.04));
	const marginY = Math.max(6, Math.round(width * 0.038));
	const borderWidth = Math.max(1, Math.round(fontSize * 0.08 * 10) / 10);

	const labelText = "version";
	const versionText = escapeXml(version);

	const labelTextWidth = Math.round(labelText.length * fontSize * 0.58);
	const versionTextWidth = Math.round(version.length * fontSize * 0.63);

	const labelPartWidth = labelTextWidth + paddingX * 2;
	const versionPartWidth = versionTextWidth + paddingX * 2;
	const badgeHeight = fontSize + paddingY * 2;
	const badgeWidth = labelPartWidth + versionPartWidth;

	const badgeX = Math.max(marginX, width - badgeWidth - marginX);
	const badgeY = marginY;

	const labelCx = badgeX + labelPartWidth / 2;
	const versionCx = badgeX + labelPartWidth + versionPartWidth / 2;
	const textY = badgeY + badgeHeight / 2;

	const svgOverlay = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<filter id="badgeShadow" x="-40%" y="-40%" width="180%" height="200%">
			<feDropShadow dx="0" dy="2" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.45"/>
		</filter>
		<linearGradient id="labelGrad" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="#3A3A4A"/>
			<stop offset="100%" stop-color="#22222E"/>
		</linearGradient>
		<linearGradient id="versionGrad" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="#28C76F"/>
			<stop offset="100%" stop-color="#0A8A42"/>
		</linearGradient>
		<linearGradient id="glossGrad" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.12"/>
			<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
		</linearGradient>
		<clipPath id="badgeClip">
			<rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${radius}"/>
		</clipPath>
	</defs>

	<g filter="url(#badgeShadow)">
		<!-- Full badge background for shadow -->
		<rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${radius}" fill="#22222E"/>
	</g>

	<g clip-path="url(#badgeClip)">
		<!-- Label section -->
		<rect x="${badgeX}" y="${badgeY}" width="${labelPartWidth}" height="${badgeHeight}" fill="url(#labelGrad)"/>
		<!-- Version section -->
		<rect x="${badgeX + labelPartWidth}" y="${badgeY}" width="${versionPartWidth}" height="${badgeHeight}" fill="url(#versionGrad)"/>
		<!-- Gloss overlay -->
		<rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${Math.round(badgeHeight * 0.5)}" fill="url(#glossGrad)"/>
		<!-- Divider line -->
		<line x1="${badgeX + labelPartWidth}" y1="${badgeY}" x2="${badgeX + labelPartWidth}" y2="${badgeY + badgeHeight}" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="1"/>
	</g>

	<!-- Border -->
	<rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${radius}" fill="none" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="${borderWidth}"/>

	<!-- Texts -->
	<text x="${labelCx}" y="${textY}" text-anchor="middle" dominant-baseline="central"
		font-family="Segoe UI, Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="600"
		fill="#C8C8D8" letter-spacing="0.3">${labelText}</text>
	<text x="${versionCx}" y="${textY}" text-anchor="middle" dominant-baseline="central"
		font-family="Segoe UI, Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="700"
		fill="#FFFFFF" letter-spacing="0.3">${versionText}</text>
</svg>
`;

	await image
		.composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
		.png()
		.toFile(targetLogoPath);

	fs.mkdirSync(path.dirname(vscodeTargetLogoPath), { recursive: true });
	fs.copyFileSync(targetLogoPath, vscodeTargetLogoPath);

	console.log(`Versioned logo generated: ${targetLogoPath}`);
	console.log(`Versioned logo copied: ${vscodeTargetLogoPath}`);
}

main().catch((error) => {
	console.error(`Failed to generate versioned logo: ${error.message}`);
	process.exitCode = 1;
});
