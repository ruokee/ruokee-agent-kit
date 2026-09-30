/**
 * Regenerate the committed host template from the owned strategy source.
 *
 * Maintainer step, run after editing `src/prompt-template.md`. The artifact is
 * what users hand to the host through its own template mechanism; a test keeps
 * it in step with the source.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { buildHostTemplate, HOST_TEMPLATE_FILE_NAME } from "../src/host-template.ts";

const source = readFileSync(new URL("../src/prompt-template.md", import.meta.url), "utf8");
const template = buildHostTemplate(source);
if (template === null) {
  console.error("error: the owned template cannot be bound to host data; artifact unchanged");
  process.exit(1);
}
writeFileSync(new URL(`../${HOST_TEMPLATE_FILE_NAME}`, import.meta.url), template.text);
console.log(
  `wrote ${HOST_TEMPLATE_FILE_NAME}: ${Buffer.byteLength(template.text)} bytes, ${template.anchors.length} anchors`,
);
